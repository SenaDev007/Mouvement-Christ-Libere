/**
 * lib/youtube-sync.ts — ⭐ V4.24 Synchronisation AUTOMATIQUE de la chaîne
 * YouTube liée au back-office.
 *
 * ============================================================================
 * POURQUOI CE FICHIER
 * ============================================================================
 * Le compte YouTube du pasteur est déjà lié via OAuth 2.0
 * (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN —
 * mêmes variables que la récupération des replays de lives). Ce module
 * exploite CE lien pour récupérer les dernières vidéos PUBLIÉES sur la
 * chaîne et importer automatiquement celles qui manquent au module Vidéos
 * du back-office (elles apparaissent aussitôt sur la page publique /videos).
 *
 * Directives couvertes : « quand le pasteur publie une vidéo sur YouTube,
 * qu'elle soit récupérée de façon automatique dans le module vidéo ».
 *
 * DÉCLENCHEURS :
 *   ① Bouton « Synchroniser YouTube » du module Vidéos (back-office) ;
 *   ② Cron Vercel 2×/jour (/api/cron/sync-youtube — vercel.json).
 *
 * COÛT API YouTube (quota 10 000 unités/jour) :
 *   - channels.list (mine)      = 1 unité
 *   - playlistItems.list        = 1 unité
 *   - videos.list (≤ 50 ids)    = 1 unité
 *   → 3 unités par synchronisation complète.
 *
 * GARDES :
 *   - Idempotent : les vidéos déjà en base (par ID YouTube, toutes formes
 *     d'URL confondues) ne sont jamais dupliquées ;
 *   - ⭐ V3.86 (mémoire des suppressions) : une vidéo volontairement
 *     supprimée du back-office n'est JAMAIS ré-importée par la synchro ;
 *   - Les lives à venir (premières/upcoming) sont ignorés ;
 *   - Best-effort : un échec YouTube renvoie un compte-rendu, jamais
 *     d'exception non gérée.
 */

import { google } from "googleapis";
import { db } from "@/lib/db";
import {
  extractYoutubeId,
  getYoutubeVideoUrl,
  getYouTubeOAuthClientForServant,
  listerComptesYouTubeActifs,
} from "@/lib/youtube";
import { estVideoSupprimee } from "@/lib/suppression-video";
import { rubriquesDe } from "@/lib/video-rubrics";

export interface ResultatSyncYouTube {
  /** Vidéos importées (nouvelles sur la chaîne, absentes du module). */
  ajoutees: number;
  /** Vidéos de la chaîne déjà présentes dans le module. */
  ignorees: number;
  /** Vidéos volontairement supprimées du back-office — jamais ré-importées. */
  sautees: number;
  /** Titres des vidéos importées (compte-rendu au pasteur). */
  titres: string[];
  /** Nom de la chaîne synchronisée (information). */
  chaine?: string;
  /** Message d'erreur (OAuth absent, quota dépassé…) — jamais d'exception. */
  erreur?: string;
}

/** Convertit une durée ISO 8601 YouTube (PT1H24M30S) → « 1:24:30 ». */
function dureeIsoVersLisible(iso?: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return "";
  const [, j, h, min, s] = m.map((x) => (x ? parseInt(x, 10) : 0)) as number[];
  const heures = (j || 0) * 24 + (h || 0);
  const minutes = min || 0;
  const secondes = s || 0;
  if (!heures && !minutes && !secondes) return ""; // P0D (live) → vide
  return heures > 0
    ? `${heures}:${String(minutes).padStart(2, "0")}:${String(secondes).padStart(2, "0")}`
    : `${minutes}:${String(secondes).padStart(2, "0")}`;
}

/**
 * Synchronise la chaîne YouTube liée à un serviteur : importe les vidéos
 * publiées qui manquent au module Vidéos.
 *
 * ⭐ V4.26 — MULTI-COMPTES : la résolution des credentials se fait via
 * `getYouTubeOAuthClientForServant(servantCode)` qui consulte d'abord
 * la table `YoutubeAccount` (refresh token chiffré par serviteur), puis
 * repli sur les variables d'environnement YOUTUBE_* (mono-compte).
 *
 * @param opts.servantCode  code du serviteur ("afrika" | "kongo") auquel
 *                          attribuer les nouvelles vidéos. Défaut : variable
 *                          d'environnement YOUTUBE_SYNC_SERVANT_CODE, sinon
 *                          « afrika » (toutes les vidéos YouTube actuelles
 *                          sont les siennes).
 */
export async function syncYouTubeChannel(opts?: {
  servantCode?: string | null;
}): Promise<ResultatSyncYouTube> {
  // Serviteur d'attribution : onglet actif > variable d'env > afrika.
  const codeServiteur =
    opts?.servantCode ||
    process.env.YOUTUBE_SYNC_SERVANT_CODE ||
    "afrika";

  const servant = await db.servant.findFirst({
    where: { code: { equals: codeServiteur, mode: "insensitive" } },
    select: { id: true, shortName: true },
  });
  if (!servant) {
    return {
      ajoutees: 0,
      ignorees: 0,
      sautees: 0,
      titres: [],
      erreur: `Serviteur « ${codeServiteur} » introuvable en base.`,
    };
  }

  // ⭐ V4.26 — Résolution multi-comptes (DB > ENV).
  const credentials = await getYouTubeOAuthClientForServant(codeServiteur);
  if (!credentials) {
    return {
      ajoutees: 0,
      ignorees: 0,
      sautees: 0,
      titres: [],
      erreur:
        "OAuth YouTube non configuré pour ce serviteur. Reliez le compte via " +
        "/admin/youtube-accounts (multi-comptes) ou /admin/youtube-setup " +
        "(mono-compte via variables d'environnement).",
    };
  }

  const { client: auth, compte } = credentials;

  try {
    const youtube = google.youtube({ version: "v3", auth });

    // ① La chaîne liée : titre (compte-rendu) + playlist « uploads ».
    const resChannel = await youtube.channels.list({
      part: ["snippet", "contentDetails"],
      mine: true,
    });
    const chaine = resChannel.data.items?.[0];
    const playlistUploads =
      chaine?.contentDetails?.relatedPlaylists?.uploads || null;
    if (!playlistUploads) {
      await marquerDerniereErreur(compte.compteId, "Playlist « uploads » introuvable.");
      return {
        ajoutees: 0,
        ignorees: 0,
        sautees: 0,
        titres: [],
        erreur: "Playlist « uploads » introuvable sur la chaîne YouTube liée.",
      };
    }

    // ② Les dernières vidéos publiées (playlistItems = 1 unité, 50 max).
    const resItems = await youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId: playlistUploads,
      maxResults: 50,
    });
    const items = resItems.data.items || [];

    // ③ Détails (durée, miniatures, stats) en UN appel videos.list.
    const ids = items
      .map((it) => it.contentDetails?.videoId)
      .filter((v): v is string => !!v);
    const details = new Map<
      string,
      { duree: string; miniature: string | null; vues: number; likes: number; aVenir: boolean }
    >();
    if (ids.length > 0) {
      const resVideos = await youtube.videos.list({
        part: ["snippet", "contentDetails", "statistics"],
        id: ids,
        maxResults: 50,
      });
      for (const v of resVideos.data.items || []) {
        if (!v.id) continue;
        const miniatures = v.snippet?.thumbnails || {};
        details.set(v.id, {
          duree: dureeIsoVersLisible(v.contentDetails?.duration),
          miniature:
            miniatures.maxres?.url ||
            miniatures.standard?.url ||
            miniatures.high?.url ||
            miniatures.medium?.url ||
            null,
          vues: parseInt(v.statistics?.viewCount || "0", 10) || 0,
          likes: parseInt(v.statistics?.likeCount || "0", 10) || 0,
          // Live programmé non démarré (première) → rien à importer.
          aVenir: v.snippet?.liveBroadcastContent === "upcoming",
        });
      }
    }

    // ④ Vidéos déjà présentes en base (par ID YouTube — toutes formes
    // d'URL confondues : watch?v=, youtu.be, embed, shorts…).
    const existantes = await db.video.findMany({
      where: { videoUrl: { not: null } },
      select: { videoUrl: true },
    });
    const idsExistants = new Set<string>();
    for (const v of existantes) {
      const id = extractYoutubeId(v.videoUrl);
      if (id) idsExistants.add(id);
    }

    let ajoutees = 0;
    let ignorees = 0;
    let sautees = 0;
    const titres: string[] = [];

    // ⭐ V4.26 — Catégorie par défaut = rubrique SIGNATURE du serviteur,
    // pour garantir qu'aucune vidéo d'Afrika ne se retrouve dans la section
    // Pasteur Kongo (et inverse versa). Sans cela, category: null déclencherait
    // la catégorisation automatique par mots-clés du titre — risqué :
    // un titre comme "Prière de délivrance" pourrait être deviné dans
    // "Prière & Délivrance" (catégorie commune aux deux serviteurs) et
    // s'afficher dans les deux sections sur /videos.
    //   · Afrika       → "Saint-Esprit réponds-moi" (sa seule rubrique signature)
    //   · Pasteur Kongo → "Rhema du matin" (première de ses deux rubriques)
    // L'admin peut ensuite affiner manuellement la catégorie dans le back-office.
    const rubriqueParDefaut = rubriquesDe(codeServiteur)[0] || null;

    // Ordre chronologique (la playlist est « plus récent d'abord » — on
    // insère du plus ancien au plus récent pour un tri propre).
    for (const item of [...items].reverse()) {
      const videoId = item.contentDetails?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet?.title) continue;

      // Déjà dans le module → ignorer (idempotence).
      if (idsExistants.has(videoId)) {
        ignorees++;
        continue;
      }

      const url = getYoutubeVideoUrl(videoId);

      // ⭐ V3.86 — vidéo volontairement supprimée du back-office : la
      // synchro automatique ne fait JAMAIS revenir une vidéo supprimée.
      if (await estVideoSupprimee(url)) {
        sautees++;
        continue;
      }

      // Live programmé non démarré (première) → rien à afficher.
      const detail = details.get(videoId);
      if (detail?.aVenir) continue;

      const datePublication = snippet.publishedAt
        ? new Date(snippet.publishedAt)
        : new Date();

      await db.video.create({
        data: {
          servantId: servant.id,
          title: snippet.title,
          description:
            (snippet.description || "").slice(0, 5000) ||
            `Vidéo de ${servant.shortName} — ${snippet.title}`,
          duration: detail?.duree || "",
          videoUrl: url,
          thumbnailUrl:
            detail?.miniature || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          views: detail?.vues || 0,
          likes: detail?.likes || 0,
          isLive: false,
          // ⭐ V4.26 — Rubrique signature du serviteur (cf. commentaire plus haut).
          category: rubriqueParDefaut,
          publishedAt: datePublication,
        },
      });
      idsExistants.add(videoId);
      ajoutees++;
      titres.push(snippet.title);
    }

    await marquerSucces(compte.compteId);

    return {
      ajoutees,
      ignorees,
      sautees,
      titres: titres.slice(0, 5),
      chaine: chaine?.snippet?.title || compte.channelTitle || undefined,
    };
  } catch (e) {
    const message = e instanceof Error ? `API YouTube : ${e.message}` : "Erreur inconnue de l'API YouTube.";
    await marquerDerniereErreur(compte.compteId, message);
    return {
      ajoutees: 0,
      ignorees: 0,
      sautees: 0,
      titres: [],
      erreur: message,
    };
  }
}

/**
 * Met à jour le `dernierSyncAt` et efface `derniereErreur` pour un compte
 * YouTube en base (best-effort, jamais bloquant).
 */
async function marquerSucces(compteId: string | null): Promise<void> {
  if (!compteId) return;
  try {
    await db.youtubeAccount.update({
      where: { id: compteId },
      data: { dernierSyncAt: new Date(), derniereErreur: null },
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Persiste la dernière erreur de synchro sur le compte YouTube en base.
 */
async function marquerDerniereErreur(compteId: string | null, message: string): Promise<void> {
  if (!compteId) return;
  try {
    await db.youtubeAccount.update({
      where: { id: compteId },
      data: { dernierSyncAt: new Date(), derniereErreur: message.slice(0, 2000) },
    });
  } catch {
    /* best-effort */
  }
}

// ─────────────────────────────────────────────────────────────────────
// ⭐ V4.26 — SYNC MULTI-COMPTES (cron)
// ─────────────────────────────────────────────────────────────────────
// Utilisé par /api/cron/sync-youtube pour synchroniser TOUS les comptes
// YouTube actifs en base en une seule passe (Afrika + Pasteur Kongo).
//
// Compat ascendante : si la base ne contient AUCUN YoutubeAccount, on
// conserve le comportement historique (appel à syncYouTubeChannel() qui
// repli sur YOUTUBE_* env vars).
// ─────────────────────────────────────────────────────────────────────

export interface ResultatSyncMultiYouTube {
  /** Nombre total de comptes synchronisés (1 si repli env mono-compte). */
  comptes: number;
  /** Total des vidéos ajoutées tous comptes confondus. */
  ajoutees: number;
  /** Total des vidéos déjà présentes (ignorées). */
  ignorees: number;
  /** Total des vidéos supprimées volontairement (sautées). */
  sautees: number;
  /** Détail par compte (pour le log cron). */
  details: Array<{
    servantCode: string;
    chaine?: string;
    ajoutees: number;
    ignorees: number;
    sautees: number;
    titres: string[];
    erreur?: string;
  }>;
}

/**
 * Synchronise TOUS les comptes YouTube actifs en base.
 * Si aucun compte n'existe en base, repli sur syncYouTubeChannel() (env vars).
 */
export async function syncTousComptesYouTube(): Promise<ResultatSyncMultiYouTube> {
  const comptes = await listerComptesYouTubeActifs();

  // Aucun compte en base → repli mono-compte (compat ascendante).
  if (comptes.length === 0) {
    const r = await syncYouTubeChannel({
      servantCode: process.env.YOUTUBE_SYNC_SERVANT_CODE || null,
    });
    return {
      comptes: 1,
      ajoutees: r.ajoutees,
      ignorees: r.ignorees,
      sautees: r.sautees,
      details: [
        {
          servantCode: process.env.YOUTUBE_SYNC_SERVANT_CODE || "afrika",
          chaine: r.chaine,
          ajoutees: r.ajoutees,
          ignorees: r.ignorees,
          sautees: r.sautees,
          titres: r.titres,
          erreur: r.erreur,
        },
      ],
    };
  }

  // Multi-comptes : on sync chaque compte séquentiellement (évite la
  // concurrence sur les quotas API YouTube et les écritures DB).
  const details: ResultatSyncMultiYouTube["details"] = [];
  let ajouteesTotal = 0;
  let ignoreesTotal = 0;
  let sauteesTotal = 0;

  for (const compte of comptes) {
    const r = await syncYouTubeChannel({ servantCode: compte.servantCode });
    details.push({
      servantCode: compte.servantCode,
      chaine: r.chaine,
      ajoutees: r.ajoutees,
      ignorees: r.ignorees,
      sautees: r.sautees,
      titres: r.titres,
      erreur: r.erreur,
    });
    ajouteesTotal += r.ajoutees;
    ignoreesTotal += r.ignorees;
    sauteesTotal += r.sautees;
  }

  return {
    comptes: comptes.length,
    ajoutees: ajouteesTotal,
    ignorees: ignoreesTotal,
    sautees: sauteesTotal,
    details,
  };
}
