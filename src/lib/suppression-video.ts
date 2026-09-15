/**
 * ⭐ V3.86 — SUPPRESSION DÉFINITIVE DES VIDÉOS (« tombstones »).
 * ============================================================================
 *
 * Anomalie remontée par le pasteur : « quand on supprime une vidéo (même
 * issue d'un lien YouTube ou TikTok), elle revient ensuite ». Cause racine
 * (prouvée en production) : les flux de RÉ-INSERTION ne distinguent pas une
 * vidéo « jamais intégrée » d'une vidéo « volontairement supprimée » :
 *   · scripts d'import/correction (inserer-tiktok-v363, v377, corriger-titres-
 *     saint-esprit-v378 — ils insèrent tout média de la liste absent de la
 *     base : un média supprimé par le pasteur est « absent » → ré-inséré) ;
 *   · récupération des replays YouTube (lib/live-replay-recovery.ts — la
 *     Passe 1 recrée l'entrée « X (Replay) » de tout live ENDED avec URL
 *     connue, sans fenêtre temporelle) ;
 *   · POST /admin/api/videos (aucune garde — n'importe quelle URL acceptée).
 *
 * Solution — MÉMOIRE DES SUPPRESSIONS : quand une vidéo est supprimée du
 * back-office, son URL est enregistrée dans la table « volante »
 * SuppressionVideo (SQL brut, même approche que CallSignal/WebRTCSignal —
 * AUCUNE modification du modèle Prisma). Toute re-création (POST manuel,
 * script, récupération de replay, webhook LiveKit) est alors REFUSÉE (409)
 * tant que la réintégration n'est pas EXPLICITEMENT confirmée (drapeau
 * `reintegration: true` — le modal « Nouvelle vidéo » le demande en clair).
 *
 * La clé de comparaison est CANONIQUE (une même vidéo YouTube sous ses
 * formes watch?v= / youtu.be / embed / shorts / live est UNE seule clé ;
 * une même vidéo TikTok sous /video/ ou /photo/ également) — impossible de
 * contourner la mémoire en changeant la forme de l'URL.
 *
 * Toutes les fonctions sont best-effort : un échec de la table n'entrave
 * JAMAIS la suppression en elle-même (qui reste un DELETE SQL physique et
 * définitif — vérifié en production).
 */
import { db } from "@/lib/db";

// ────────────────────────────────────────────────────────────────
// Clé média canonique
// ────────────────────────────────────────────────────────────────

/** Identifiant YouTube (11 caractères) — toutes les formes d'URL connues. */
function extraireIdYoutube(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/** Identifiant TikTok (vidéo OU diaporama /photo/ — même identifiant). */
function extraireIdTiktok(url: string): string | null {
  const m = url.match(/tiktok\.com\/@[^/\s]+\/(?:video|photo)\/(\d{5,25})/);
  return m ? m[1] : null;
}

/**
 * Clé canonique d'une vidéo à partir de son URL :
 *   · YouTube  → « youtube:<id 11> »
 *   · TikTok   → « tiktok:<id numérique> »
 *   · autre http(s) → « url:<hôte><chemin> » (requête/fragment retirés —
 *     les URLs R2 signées par exemple pointent le même fichier)
 *   · null / data URL / URL relative → null (rien à mémoriser).
 */
export function cleMediaDe(videoUrl?: string | null): string | null {
  if (!videoUrl || typeof videoUrl !== "string") return null;
  const u = videoUrl.trim();
  if (!u || u.startsWith("data:")) return null;

  const yt = extraireIdYoutube(u);
  if (yt) return `youtube:${yt}`;

  const tt = extraireIdTiktok(u);
  if (tt) return `tiktok:${tt}`;

  if (/^https?:\/\//i.test(u)) {
    try {
      const p = new URL(u);
      let chemin = p.pathname.replace(/\/+$/, "");
      return `url:${p.hostname.toLowerCase()}${chemin}`;
    } catch {
      return null;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// Table volante SuppressionVideo (idempotente + mémoïsée)
// ────────────────────────────────────────────────────────────────

let suppressionOk = false;
let inflightSuppression: Promise<void> | null = null;

/** S'assure que la table existe (CREATE TABLE IF NOT EXISTS, pattern du
 * projet — cf. ensureCallSignalTable). Échec DDL purement loggué : les
 * gardes deviennent alors inopérantes mais AUCUNE route ne casse. */
export function ensureSuppressionVideoTable(): Promise<void> {
  if (suppressionOk) return Promise.resolve();
  if (!inflightSuppression) {
    inflightSuppression = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SuppressionVideo" (
          "id" TEXT NOT NULL,
          "cleMedia" TEXT NOT NULL,
          "videoUrl" TEXT,
          "titre" TEXT,
          "servantId" TEXT,
          "videoId" TEXT,
          "supprimeAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "SuppressionVideo_pkey" PRIMARY KEY ("id")
        )`
      );
      // Une seule ligne par média : supprimer → réintégrer → re-supprimer
      // met à jour la même ligne (date rafraîchie).
      await db.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "SuppressionVideo_cleMedia_key" ON "SuppressionVideo"("cleMedia")'
      );
    })()
      .then(() => {
        suppressionOk = true;
        console.log("[suppression-video] V3.86 : table SuppressionVideo vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[suppression-video] DDL SuppressionVideo impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightSuppression = null;
      });
  }
  return inflightSuppression;
}

// ────────────────────────────────────────────────────────────────
// Écriture / lecture / levée
// ────────────────────────────────────────────────────────────────

/** Nouvel identifiant de ligne (crypto.randomUUID — Node 18+). */
function nouvelId(): string {
  return globalThis.crypto?.randomUUID?.() || `suppr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface InfosSuppression {
  /** ISO 8601 — quand la vidéo a été supprimée. */
  supprimeLe: string;
  /** Titre au moment de la suppression (indicatif). */
  titre: string | null;
  /** URL d'origine telle que stockée. */
  videoUrl: string | null;
}

/**
 * Enregistre (ou rafraîchit) la mémoire de suppression d'une vidéo.
 * Best-effort ABSOLU : un échec est loggué, jamais remonté — la suppression
 * en base reste effective quoi qu'il arrive.
 */
export async function enregistrerSuppressionVideo(params: {
  videoId: string;
  videoUrl?: string | null;
  titre?: string | null;
  servantId?: string | null;
}): Promise<void> {
  try {
    const cle = cleMediaDe(params.videoUrl);
    if (!cle) return; // URL locale/data/absente → rien à mémoriser.
    await ensureSuppressionVideoTable();
    if (!suppressionOk) return; // DDL impossible → garde désactivée silencieusement.
    await db.$executeRawUnsafe(
      `INSERT INTO "SuppressionVideo" ("id", "cleMedia", "videoUrl", "titre", "servantId", "videoId", "supprimeAt")
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT ("cleMedia") DO UPDATE SET
         "videoUrl" = EXCLUDED."videoUrl",
         "titre"    = EXCLUDED."titre",
         "servantId"= EXCLUDED."servantId",
         "videoId"  = EXCLUDED."videoId",
         "supprimeAt" = now()`,
      nouvelId(),
      cle,
      params.videoUrl ?? null,
      params.titre ?? null,
      params.servantId ?? null,
      params.videoId
    );
  } catch (e) {
    console.warn(
      "[suppression-video] Mémorisation impossible (non bloquant) :",
      e instanceof Error ? e.message : e
    );
  }
}

/**
 * La mémoire de suppression connaît-elle cette URL ? (recherche par clé
 * canonique — les formes d'URL différentes d'un même média sont couvertes.)
 * Retourne null si la vidéo n'a jamais été supprimée (ou si la table est
 * indisponible — la garde s'efface alors sans casser l'appelant).
 */
export async function verifierSuppressionVideo(
  videoUrl?: string | null
): Promise<InfosSuppression | null> {
  try {
    const cle = cleMediaDe(videoUrl);
    if (!cle) return null;
    await ensureSuppressionVideoTable();
    if (!suppressionOk) return null;
    const lignes = await db.$queryRawUnsafe<
      Array<{ supprimeAt: Date; titre: string | null; videoUrl: string | null }>
    >(
      `SELECT "supprimeAt", "titre", "videoUrl" FROM "SuppressionVideo" WHERE "cleMedia" = $1 LIMIT 1`,
      cle
    );
    const l = lignes[0];
    if (!l) return null;
    return {
      supprimeLe: new Date(l.supprimeAt).toISOString(),
      titre: l.titre,
      videoUrl: l.videoUrl,
    };
  } catch {
    return null;
  }
}

/** Raccourci booléen (récupération de replays, webhooks…). */
export async function estVideoSupprimee(videoUrl?: string | null): Promise<boolean> {
  return (await verifierSuppressionVideo(videoUrl)) !== null;
}

/**
 * Lève la mémoire de suppression (réintégration EXPLICITE — drapeau
 * `reintegration: true` confirmé par l'administrateur dans le modal).
 */
export async function leverSuppressionVideo(videoUrl?: string | null): Promise<void> {
  try {
    const cle = cleMediaDe(videoUrl);
    if (!cle) return;
    await ensureSuppressionVideoTable();
    if (!suppressionOk) return;
    await db.$executeRawUnsafe(
      `DELETE FROM "SuppressionVideo" WHERE "cleMedia" = $1`,
      cle
    );
  } catch (e) {
    console.warn(
      "[suppression-video] Levée impossible (non bloquant) :",
      e instanceof Error ? e.message : e
    );
  }
}
