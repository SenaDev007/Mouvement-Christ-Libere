/**
 * ⭐ V4.17 — COMPTEURS VIDÉO (vues + likes réels) SUR LES DEUX PLATEFORMES.
 *
 * Retour pasteur : « le nombre de vues sur les vidéos, tant sur mobile que
 * sur le web, [doit] apparaître. Le nombre de likes aussi. » Or les
 * compteurs étaient vides : seules 2 vidéos sur 1 463 avaient des vues
 * (et 0 likes) — la colonne Video.views n'était remplie QUE par la sync
 * des lives YouTube, jamais pour les vidéos publiées.
 *
 * Ce module orchestre les DEUX sources de vérité :
 *  · YouTube (759 vidéos) : videos.list par lots de 50 (1 unité de quota
 *    par lot via l'OAuth déjà configuré pour les lives) → viewCount et
 *    likeCount RÉELS de chaque vidéo ;
 *  · TikTok (702 vidéos) : tikwm (déjà le résolveur du backfill MP4)
 *    renvoie play_count et digg_count → cf. tiktok-video.ts.
 *
 * Règles d'écriture :
 *  · views = compteur de la plateforme (rien de local ne l'incrémente) ;
 *  · likes = max(nos likes, likes de la plateforme) — les « j'aime » posés
 *    sur notre plateforme ne sont JAMAIS effacés par une synchronisation.
 *
 * Chaque update fait bouger Video.updatedAt → le hash du bundle mobile
 * (/api/app/content, fnv des updatedAt) change → les applications
 * resynchronisent automatiquement leurs compteurs.
 *
 * Déclencheurs :
 *  · POST /api/videos/sync-stats (bouton back-office « Actualiser les
 *    compteurs » — boucle de lots) ;
 *  · rafraichirStatsThrottlees() : passe opportuniste throttlée 6 h
 *    déclenchée en after() par GET /api/videos (visiteurs du site).
 */

import { db } from "@/lib/db";
import { fetchYouTubeStatsLot } from "@/lib/youtube-live-chat";
import { synchroniserStatsTiktok } from "@/lib/tiktok-video";

export interface ResultatStatsYouTube {
  traitées: number;
  misesAJour: number;
  restantes: number;
  /** ⭐ V4.17b — première erreur API rencontrée (diagnostic back-office). */
  erreur?: string | null;
}

/** Extrait l'ID YouTube d'une videoUrl (mêmes regex que /api/videos). */
function extraireIdYouTube(videoUrl: string): string | null {
  return (
    videoUrl.match(/v=([a-zA-Z0-9_-]{11})/)?.[1] ||
    videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1] ||
    null
  );
}

/**
 * Synchronise les compteurs des vidéos YouTube : lots de 50 ID via
 * videos.list, puis update par vidéo (views = viewCount réel,
 * likes = max(nôtre, likeCount)). Idempotent — relancer ne refait rien de
 * visible, les compteurs ne font qu'avancer vers les valeurs réelles.
 */
export async function synchroniserStatsYouTube(params?: {
  limite?: number;
}): Promise<ResultatStatsYouTube> {
  const limite = Math.min(Math.max(params?.limite ?? 200, 1), 800);

  // Candidates : vidéos YouTube avec un ID extractible, populaires
  // d'abord (celles qui ont déjà des vues sont les plus regardées —
  // garder leurs compteurs à jour est le plus utile).
  const toutes = await db.video.findMany({
    where: { videoUrl: { not: null } },
    select: { id: true, videoUrl: true, views: true, likes: true },
  });
  const candidates = toutes
    .map((v) => ({
      id: v.id,
      youtubeId: extraireIdYouTube(v.videoUrl || ""),
      views: v.views,
      likes: v.likes,
    }))
    .filter((v) => v.youtubeId)
    .sort((a, b) => b.views - a.views);

  let traitees = 0;
  let misesAJour = 0;
  let erreurAPI: string | null = null;
  for (let i = 0; i < candidates.length && traitees < limite; i += 50) {
    const lot = candidates.slice(i, i + 50);
    const { stats: statsParId, erreur } = await fetchYouTubeStatsLot(
      lot.map((v) => v.youtubeId)
    );
    if (erreur && !erreurAPI) erreurAPI = erreur;
    if (statsParId.size === 0) continue; // erreur API → lot suivant
    for (const v of lot) {
      const stats = v.youtubeId ? statsParId.get(v.youtubeId) : undefined;
      if (!stats) continue; // vidéo supprimée/privée sur YouTube
      traitees++;
      const data: { views?: number; likes?: number } = {};
      if (stats.viewCount > v.views) data.views = stats.viewCount;
      if (stats.likeCount > v.likes) data.likes = stats.likeCount;
      if (Object.keys(data).length > 0) {
        await db.video.updateMany({ where: { id: v.id }, data });
        misesAJour++;
      }
    }
  }

  return {
    traitées: traitees,
    misesAJour,
    restantes: Math.max(0, candidates.length - traitees),
    erreur: erreurAPI,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Passe opportuniste throttlée (6 h) — table runtime dédiée
// ─────────────────────────────────────────────────────────────────────

let tableStatsOk = false;
let inflightTableStats: Promise<void> | null = null;

/** Table runtime VideoStatsRuntime (SQL brut — zéro impact Prisma). */
async function ensureVideoStatsRuntimeTable(): Promise<void> {
  if (tableStatsOk) return;
  if (!inflightTableStats) {
    inflightTableStats = db
      .$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "VideoStatsRuntime" (' +
          '"cle" TEXT PRIMARY KEY, "last_at" TIMESTAMP NOT NULL)'
      )
      .then(() => {
        tableStatsOk = true;
      })
      .catch((e: unknown) => {
        console.error(
          "[video-stats] CREATE TABLE VideoStatsRuntime impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightTableStats = null;
      });
  }
  return inflightTableStats;
}

const CLE_THROTTLE = "stats-videos-last-at";
const INTERVALLE_MS = 6 * 60 * 60 * 1000; // 6 heures

/**
 * ⭐ V4.17 — Passe opportuniste : appelée en after() par GET /api/videos
 * (jamais dans le chemin de réponse — zéro latence ajoutée). Au plus une
 * fois toutes les 6 h : YouTube (≤ 200 vidéos = 4 lots = 4 unités de
 * quota) + TikTok (≤ 15 vidéos via tikwm). Best-effort total — aucune
 * erreur ne remonte.
 */
export async function rafraichirStatsThrottlees(): Promise<void> {
  try {
    await ensureVideoStatsRuntimeTable();
    if (!tableStatsOk) return;

    // Throttle : lire-comparer-écrire en un seul UPDATE atomique —
    // renvoie le nombre de lignes réellement mises à jour (1 = on a la
    // main, 0 = une autre instance l'a déjà fait récemment).
    const prises = await db.$executeRawUnsafe(
      `UPDATE "VideoStatsRuntime" SET "last_at" = NOW()` +
        ` WHERE "cle" = '${CLE_THROTTLE}'` +
        ` AND ("last_at" IS NULL OR "last_at" < NOW() - INTERVAL '6 hours')`
    );
    if (prises === 0) {
      // Première exécution de la table : semer la ligne puis re-tester.
      const semees = await db.$executeRawUnsafe(
        `INSERT INTO "VideoStatsRuntime" ("cle", "last_at")` +
          ` VALUES ('${CLE_THROTTLE}', NOW())` +
          ` ON CONFLICT ("cle") DO NOTHING`
      );
      if (semees === 0) return; // déjà semée + throttled → rien à faire
    }

    await Promise.allSettled([
      synchroniserStatsYouTube({ limite: 200 }),
      synchroniserStatsTiktok({ limite: 15, budgetMs: 60_000 }),
    ]);
  } catch {
    // best-effort total
  }
}
