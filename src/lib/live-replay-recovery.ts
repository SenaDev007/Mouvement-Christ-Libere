/**
 * ⭐ V3.34 — AUTO-RÉCUPÉRATION DES REPLAYS YOUTUBE APRÈS UN LIVE.
 * ============================================================================
 *
 * Anomalie remontée par le pasteur : « quand on finit le live, l'upload du
 * replay vers R2 échoue (access denied) — on avait prévu la récupération
 * automatique de l'ID YouTube en fallback, mais ça ne marche pas : la vidéo
 * n'apparaît pas dans Vidéos alors qu'elle est bien enregistrée sur
 * YouTube. »
 *
 * Causes racines (corrigées par V3.34) :
 *  1. /api/live/stop archivait le replay APRÈS le nettoyage LiveKit (lent :
 *     éjection des participants, arrêt des egress, suppression de la room) ;
 *     si la fonction serverless mourait avant d'y arriver, l'entrée Vidéo
 *     (Replay) n'était JAMAIS créée → rien dans le module Vidéos ;
 *  2. la tentative de récupération YouTube dans /api/live/stop est
 *     INSTANTANÉE or YouTube met 30 s à 5 min à publier le replay après la
 *     fin du flux → l'unique tentative échoue presque toujours ;
 *  3. /api/live/[id]/youtube-replay ne mettait à jour QUE
 *     LiveStream.youtubeUrl, JAMAIS l'entrée Vidéo (Replay) — même en mode
 *     manuel (URL collée par l'admin).
 *
 * Solution — ce module répare les replays manquants DE FAÇON DIFFÉRÉE et
 * throttlée, déclenchée opportunistement quand quelqu'un consulte le module
 * Vidéos (back-office via /admin/videos, site public via /api/videos) :
 *
 *  - Passe 1 (base seule, instantanée) : lives ENDED dont l'URL YouTube est
 *    déjà connue (broadcast Tier C pré-créé) mais dont l'entrée Vidéo
 *    (Replay) manque ou est sans videoUrl → pose de l'URL + miniature,
 *    création de l'entrée si absente (couvre le cas « fonction morte avant
 *    l'archivage »).
 *  - Passe 2 (API YouTube, ≤ 4 lives par passage) : lives ENDED diffusés
 *    vers YouTube SANS URL connue, terminés depuis moins de 7 jours →
 *    resolveYoutubeReplayUrl (liveBroadcasts.list, 1 unité/appel).
 *    Throttle en base : ≥ 30 s entre deux tentatives pour un même live,
 *    ≤ 60 tentatives au total — colonnes youtubeRecoveryAttempts /
 *    youtubeRecoveryLastAt posées au RUNTIME (ALTER TABLE IF NOT EXISTS,
 *    même approche que la table LiveOverlayState V3.33 : AUCUNE modification
 *    du modèle Prisma, zéro risque pour les requêtes existantes qui
 *    sélectionnent toutes les colonnes de LiveStream).
 *
 * Garanties : idempotent, mémoïsé par process (un seul passage à la fois),
 * échecs purement loggués — la consultation des vidéos ne doit JAMAIS être
 * bloquée ni cassée par la récupération.
 *
 * ⚠️ Ce module n'importe PAS "@/lib/youtube" statiquement (googleapis est
 * lourd et alourdirait chaque page serveur qui l'utilise) : les fonctions
 * YouTube sont importées dynamiquement à l'usage.
 */
import { db } from "@/lib/db";

/** Regex locale — identique à extractYoutubeId de lib/youtube.ts, sans
 *  l'import googleapis. */
function extraireIdYoutube(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

const MAX_CANDIDATS_PAR_PASSAGE = 4;
const MAX_TENTATIVES = 60;
/** Intervalles SQL (PostgreSQL) — throttle et fenêtre de récupération. */
const DELAI_MIN_ENTRE_TENTATIVES = "30 seconds";
const FENETRE_RECOVERY = "7 days";
// ⭐ V3.36 — Passe 2bis (vérification des URL déjà stockées) : moins
// prioritaire que la récupération d'URL manquantes → throttle plus espacé
// et lot plus petit (chaque candidat coûte 2 appels API : stats de l'URL
// stockée + éventuellement re-résolution).
const MAX_VERIFICATIONS_PAR_PASSAGE = 2;
const DELAI_MIN_ENTRE_VERIFICATIONS = "5 minutes";

let colonnesOk = false;
let passageEnCours: Promise<number> | null = null;

/**
 * Pose les colonnes de throttle sur "LiveStream" (idempotent, mémoïsé).
 * Échec DDL purement loggué : les requêtes brutes qui suivent échoueront
 * alors proprement et la récupération sera désactivée silencieusement
 * (comme tous les helpers ensure-schema).
 */
async function assurerColonnesRecovery(): Promise<void> {
  if (colonnesOk) return;
  await db.$executeRawUnsafe(
    'ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "youtubeRecoveryAttempts" INTEGER NOT NULL DEFAULT 0'
  );
  await db.$executeRawUnsafe(
    'ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "youtubeRecoveryLastAt" TIMESTAMP'
  );
  // ⭐ V3.36 — throttle de la passe de VÉRIFICATION des URL déjà stockées.
  await db.$executeRawUnsafe(
    'ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "youtubeVerifyLastAt" TIMESTAMP'
  );
  colonnesOk = true;
  console.log("[replay-recovery] Colonnes LiveStream.youtubeRecovery* / youtubeVerifyLastAt vérifiées/créées ✓");
}

/** Durée lisible (h:mm:ss ou mm:ss) entre deux dates — même format que
 *  /api/live/stop. */
function dureeLisible(debut: Date | null, fin: Date | null): string {
  if (!debut) return "0:00";
  const finMs = fin ? fin.getTime() : Date.now();
  const dureeMs = finMs - debut.getTime();
  if (dureeMs <= 0) return "0:00";
  const h = Math.floor(dureeMs / 3_600_000);
  const m = Math.floor((dureeMs % 3_600_000) / 60_000);
  const s = Math.floor((dureeMs % 60_000) / 1000);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Applique une URL YouTube de replay sur le LiveStream ET sur l'entrée
 * Vidéo (Replay) — crée l'entrée si elle manque (cas « fonction morte avant
 * l'archivage »), sinon met à jour videoUrl (+ miniature si absente).
 *
 * Ne JAMAIS toucher aux compteurs (views/likes) : ils ne reflètent que les
 * interactions réelles (V3.26).
 *
 * Utilisé par : /api/live/stop (Tier B), /api/live/[id]/youtube-replay
 * (modes auto ET manuel), et la récupération différée de ce module.
 */
export async function appliquerUrlReplaySurLiveEtVideo(
  liveId: string,
  youtubeUrl: string
): Promise<boolean> {
  const live = await db.liveStream.findUnique({
    where: { id: liveId },
    select: {
      id: true,
      title: true,
      description: true,
      servantId: true,
      startedAt: true,
      endedAt: true,
      thumbnailUrl: true,
    },
  });
  if (!live) return false;

  await db.liveStream.update({
    where: { id: liveId },
    data: { youtubeUrl },
  });

  const videoId = extraireIdYoutube(youtubeUrl);
  const miniatureYoutube = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  const replayExistant = await db.video.findFirst({
    where: {
      servantId: live.servantId,
      title: { startsWith: `${live.title} (Replay)` },
    },
  });

  if (replayExistant) {
    await db.video.update({
      where: { id: replayExistant.id },
      data: {
        videoUrl: youtubeUrl,
        // Ne pas écraser une miniature existante — remplir seulement si absente.
        ...(replayExistant.thumbnailUrl ? {} : { thumbnailUrl: miniatureYoutube }),
      },
    });
    console.log(`[replay-recovery] Replay mis à jour pour ${liveId} → ${youtubeUrl}`);
  } else {
    const dateLive = new Date(live.startedAt || live.endedAt || Date.now());
    const dateStr = dateLive.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    await db.video.create({
      data: {
        servantId: live.servantId,
        title: `${live.title} (Replay)`,
        description: `Replay du live du ${dateStr}${live.description ? ` — ${live.description}` : ""}`,
        duration: dureeLisible(live.startedAt, live.endedAt),
        views: 0,
        isLive: false,
        videoUrl: youtubeUrl,
        thumbnailUrl: live.thumbnailUrl || miniatureYoutube,
        publishedAt: live.endedAt || new Date(),
      },
    });
    console.log(
      `[replay-recovery] Replay CRÉÉ pour ${liveId} → ${youtubeUrl} (l'entrée Vidéo manquait)`
    );
  }
  return true;
}

/**
 * Nombre de lives ENDED (diffusés vers YouTube, sans URL connue, < 7 jours)
 * encore récupérables — sert au bandeau d'attente du back-office Vidéos.
 * Retourne 0 si l'OAuth YouTube n'est pas configuré (aucune récupération
 * auto possible → pas de bandeau).
 */
export async function compterReplaysEnAttente(): Promise<number> {
  try {
    const { isYouTubeOAuthConfigured } = await import("@/lib/youtube");
    if (!isYouTubeOAuthConfigured()) return 0;
    await assurerColonnesRecovery();
    const rows = await db.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT COUNT(*)::int AS n
         FROM "LiveStream"
        WHERE "status" = 'ENDED'
          AND "streamToYoutube" = true
          AND ("youtubeUrl" IS NULL OR "youtubeUrl" = '')
          AND "startedAt" IS NOT NULL
          AND COALESCE("endedAt", "startedAt") >= now() - interval '${FENETRE_RECOVERY}'
          AND COALESCE("youtubeRecoveryAttempts", 0) < ${MAX_TENTATIVES}`
    );
    return rows[0]?.n ?? 0;
  } catch (e) {
    console.warn(
      "[replay-recovery] Comptage en attente impossible :",
      e instanceof Error ? e.message : e
    );
    return 0;
  }
}

/**
 * ⭐ V3.35 — Statut complet de la récupération pour le back-office Vidéos :
 * lives en attente + OAuth configuré ou non.
 *
 * Contexte (pasteur) : « on avait prévu la récupération automatique de l'ID
 * de la vidéo YouTube… ça ne marche pas, l'identifiant YouTube n'est pas
 * disponible ». Quand des lives attendent MAIS que l'OAuth YouTube est
 * absent, la récupération auto ne peut JAMAIS aboutir (broadcast non
 * pré-créé au départ + impossible d'interroger l'API) — le bandeau
 * « récupération en cours » avec auto-refresh mentait alors au pasteur.
 * Désormais le back-office affiche un bandeau de CONFIGURATION explicite
 * (variables manquantes) au lieu de faire attendre indéfiniment.
 */
export async function statutRecuperationReplays(): Promise<{
  enAttente: number;
  oauthConfigures: boolean;
}> {
  const { isYouTubeOAuthConfigured } = await import("@/lib/youtube");
  const oauthConfigures = isYouTubeOAuthConfigured();
  const enAttente = oauthConfigures
    ? await compterReplaysEnAttente().catch(() => 0)
    : await compterLivesEndedSansUrl().catch(() => 0);
  return { enAttente, oauthConfigures };
}

/** Variante «sans OAuth» du comptage : lives ENDED diffusés vers YouTube
 * sans URL — utilisée uniquement pour AFFICHER le bandeau de configuration
 * (aucune tentative de récupération n'aura lieu tant que l'OAuth manque). */
async function compterLivesEndedSansUrl(): Promise<number> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT COUNT(*)::int AS n
         FROM "LiveStream"
        WHERE "status" = 'ENDED'
          AND "streamToYoutube" = true
          AND ("youtubeUrl" IS NULL OR "youtubeUrl" = '')
          AND "startedAt" IS NOT NULL
          AND COALESCE("endedAt", "startedAt") >= now() - interval '${FENETRE_RECOVERY}'`
    );
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Passage de récupération (mémoïsé : un seul à la fois par process — les
 * appels simultanés attendent le même passage).
 *
 * @returns nombre de replays récupérés avec succès lors de CE passage.
 */
export async function recupererReplaysManquants(): Promise<number> {
  if (passageEnCours) return passageEnCours.catch(() => 0);
  const tache = passerRecovery().catch((e) => {
    console.error("[replay-recovery] Passage échoué :", e instanceof Error ? e.message : e);
    return 0;
  });
  passageEnCours = tache;
  const resultat = await tache;
  passageEnCours = null;
  return resultat;
}

async function passerRecovery(): Promise<number> {
  let recuperees = 0;
  await assurerColonnesRecovery();

  // ─── Passe 1 (base seule, zéro appel API) : URL YouTube déjà connue
  //     (broadcast Tier C pré-créé) mais entrée Vidéo absente ou sans
  //     videoUrl → réparation immédiate. Couvre le cas « la fonction
  //     /api/live/stop est morte avant l'archivage du replay » (cause
  //     racine n°1 de l'anomalie). ───
  try {
    const livesAvecUrl = await db.liveStream.findMany({
      where: { status: "ENDED", streamToYoutube: true, youtubeUrl: { not: null } },
      orderBy: [{ endedAt: "desc" }],
      take: 10,
      select: { id: true, servantId: true, title: true, youtubeUrl: true },
    });
    for (const l of livesAvecUrl) {
      try {
        const replay = await db.video.findFirst({
          where: {
            servantId: l.servantId,
            title: { startsWith: `${l.title} (Replay)` },
          },
          select: { id: true, videoUrl: true },
        });
        if (!replay || !replay.videoUrl) {
          await appliquerUrlReplaySurLiveEtVideo(l.id, l.youtubeUrl as string);
          recuperees++;
        }
      } catch (e) {
        console.warn(
          "[replay-recovery] Passe 1 : live", l.id, "→", e instanceof Error ? e.message : e
        );
      }
    }
  } catch (e) {
    console.warn("[replay-recovery] Passe 1 impossible :", e instanceof Error ? e.message : e);
  }

  // ─── Passe 2bis (⭐ V3.36 — API YouTube, throttlée 5 min) : lives ENDED
  //     diffusés vers YouTube AVEC une URL stockée, mais dont la vidéo
  //     N'EXISTE PAS (broadcast « zombie » jamais alimenté — anomalie
  //     « vidéo non disponible / supprimée » dans le module Vidéos alors
  //     que la vraie vidéo est bien sur YouTube). On vérifie l'ID (stats
  //     récupérables ?) et, s'il est mort, on RETROUVE la vraie vidéo du
  //     direct (broadcast terminé le plus récent après startedAt) et on
  //     remplace l'URL sur le LiveStream ET l'entrée Vidéo (Replay). ───
  //     Les vues/likes suivent : la passe est la même que le /stop, elle
  //     guérit les replays déjà cassés en base (anomalie passée).
  try {
    const { isYouTubeOAuthConfigured } = await import("@/lib/youtube");
    if (isYouTubeOAuthConfigured()) {
      const aVerifier = await db.$queryRawUnsafe<
        Array<{ id: string; youtubeUrl: string; startedAt: Date }>
      >(
        `SELECT "id", "youtubeUrl", "startedAt"
           FROM "LiveStream"
          WHERE "status" = 'ENDED'
            AND "streamToYoutube" = true
            AND "youtubeUrl" IS NOT NULL
            AND "youtubeUrl" <> ''
            AND "startedAt" IS NOT NULL
            AND COALESCE("endedAt", "startedAt") >= now() - interval '${FENETRE_RECOVERY}'
            AND ("youtubeVerifyLastAt" IS NULL
                 OR "youtubeVerifyLastAt" <= now() - interval '${DELAI_MIN_ENTRE_VERIFICATIONS}')
          ORDER BY "endedAt" DESC NULLS LAST
          LIMIT ${MAX_VERIFICATIONS_PAR_PASSAGE}`
      );

      for (const c of aVerifier) {
        // Marquer la vérification AVANT les appels API (throttle même en
        // cas de crash).
        await db.$executeRawUnsafe(
          `UPDATE "LiveStream" SET "youtubeVerifyLastAt" = now() WHERE "id" = $1`,
          c.id
        );
        try {
          const idStocke = extraireIdYoutube(c.youtubeUrl);
          if (!idStocke) continue;
          const { fetchYouTubeStats } = await import("@/lib/youtube-live-chat");
          const stats = await fetchYouTubeStats(idStocke);
          if (stats) continue; // L'URL est bonne — rien à faire.
          // URL morte (broadcast zombie) → retrouver la vraie vidéo.
          const { findLatestBroadcastVideoId, getYoutubeVideoUrl } = await import("@/lib/youtube");
          const vrai = await findLatestBroadcastVideoId(new Date(c.startedAt));
          if (vrai && vrai.videoId !== idStocke) {
            // Ne proposer QUE une vidéo qui existe réellement.
            const statsVrai = await fetchYouTubeStats(vrai.videoId);
            if (statsVrai) {
              await appliquerUrlReplaySurLiveEtVideo(c.id, getYoutubeVideoUrl(vrai.videoId));
              recuperees++;
              console.log(
                `[replay-recovery] Replay GUÉRI pour ${c.id} : ${idStocke} (zombie) → ${vrai.videoId}`
              );
            }
          }
        } catch (e) {
          console.warn(
            "[replay-recovery] Passe 2bis : live", c.id, "→", e instanceof Error ? e.message : e
          );
        }
      }
    }
  } catch (e) {
    console.warn("[replay-recovery] Passe 2bis impossible :", e instanceof Error ? e.message : e);
  }

  // ─── Passe 2 (API YouTube, throttlée en base) : lives diffusés vers
  //     YouTube (streamToYoutube) sans URL connue, terminés depuis moins de
  //     7 jours → le replay existe SUR YOUTUBE (« la vidéo est bien
  //     enregistrée au niveau de YouTube ») mais l'ID n'a jamais été
  //     récupéré → resolveYoutubeReplayUrl (liveBroadcasts.list, 1 unité). ───
  const { isYouTubeOAuthConfigured } = await import("@/lib/youtube");
  if (!isYouTubeOAuthConfigured()) return recuperees;

  try {
    const candidats = await db.$queryRawUnsafe<
      Array<{ id: string; title: string; startedAt: Date }>
    >(
      `SELECT "id", "title", "startedAt"
         FROM "LiveStream"
        WHERE "status" = 'ENDED'
          AND "streamToYoutube" = true
          AND ("youtubeUrl" IS NULL OR "youtubeUrl" = '')
          AND "startedAt" IS NOT NULL
          AND COALESCE("endedAt", "startedAt") >= now() - interval '${FENETRE_RECOVERY}'
          AND ("youtubeRecoveryLastAt" IS NULL
               OR "youtubeRecoveryLastAt" <= now() - interval '${DELAI_MIN_ENTRE_TENTATIVES}')
          AND COALESCE("youtubeRecoveryAttempts", 0) < ${MAX_TENTATIVES}
        ORDER BY "endedAt" DESC NULLS LAST
        LIMIT ${MAX_CANDIDATS_PAR_PASSAGE}`
    );

    for (const c of candidats) {
      // Marquer la tentative AVANT l'appel API (throttle même en cas de crash).
      await db.$executeRawUnsafe(
        `UPDATE "LiveStream"
            SET "youtubeRecoveryAttempts" = COALESCE("youtubeRecoveryAttempts", 0) + 1,
                "youtubeRecoveryLastAt" = now()
          WHERE "id" = $1`,
        c.id
      );
      try {
        const { resolveYoutubeReplayUrl } = await import("@/lib/youtube");
        const resultat = await resolveYoutubeReplayUrl(c.startedAt, null, c.title);
        if (resultat) {
          await appliquerUrlReplaySurLiveEtVideo(c.id, resultat.url);
          recuperees++;
          console.log(
            `[replay-recovery] Replay YouTube récupéré pour ${c.id} (${resultat.source}) : ${resultat.url}`
          );
        }
      } catch (e) {
        console.warn(
          "[replay-recovery] Passe 2 : live", c.id, "→", e instanceof Error ? e.message : e
        );
      }
    }
  } catch (e) {
    console.warn("[replay-recovery] Passe 2 impossible :", e instanceof Error ? e.message : e);
  }

  return recuperees;
}
