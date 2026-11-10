import { db } from "@/lib/db";
import { fetchYouTubeStats, syncYouTubeCommentsToDb } from "@/lib/youtube-live-chat";

/**
 * ⭐ V4.21 — SYNC YOUTUBE « PARESSEUSE » (remplace le cron /api/cron/sync-youtube-stats).
 * ============================================================================
 *
 * CONTEXTE FACTURE NEON (158 $ / 3 mois) : l'ancien cron Vercel réveillait
 * la base toutes les 6 h (avant : 30 min) pour rafraîchir des stats que
 * PERSONNE ne regardait à ces heures-là. Chaque réveil = du compute Neon
 * facturé pour rien.
 *
 * PRINCIPE — « pull, pas push » : la synchro ne part PLUS d'une horloge
 * mais d'une requête d'un VRAI spectateur. Elle est appelée uniquement par
 * GET /api/live/[id]/stats — route pollée par le studio et les viewers
 * pendant un direct (et quelques minutes après la fin). Par construction :
 *   · PERSONNE ne regarde   → la route n'est pas appelée → la base dort ;
 *   · QUELQU'UN regarde     → la base est déjà éveillée (il l'utilise) →
 *                            la synchro en arrière-plan est « gratuite ».
 *
 * GARDES :
 *   - Throttle mémoire par live (10 min) : studio + N viewers qui pollent
 *     toutes les 3-5 s ne déclenchent qu'UNE synchro par tranche de 10 min
 *     (par instance serverless) — le budget quota YouTube reste maîtrisé ;
 *   - Mêmes critères d'éligibilité que l'ancien cron : live EN COURS ou
 *     terminé depuis moins de 24 h, avec URL YouTube ;
 *   - BEST-EFFORT : tout échec est loggué et avalé — la lecture des stats
 *     par le spectateur (cache 30 s de la route) prime toujours.
 *
 * Ce que fait la synchro (identique à l'ancien cron) :
 *   ① viewCount/likeCount/commentCount récupérés de YouTube ;
 *   ② Video.views du replay + LiveStream.viewerCount mis à jour ;
 *   ③ commentaires YouTube importés dans LiveChatMessage → ils apparaissent
 *     dans le chat de la plateforme pendant le direct et sur le replay.
 *
 * Déclenchement manuel conservé : POST/GET /api/cron/sync-youtube-stats
 * (X-Cron-Secret) reste disponible pour un balayage complet à la demande.
 */

/** Une synchro au plus toutes les 10 minutes par live et par instance. */
const THROTTLE_MS = 10 * 60_000;

/** Fenêtre d'éligibilité après la fin d'un direct (comme l'ancien cron). */
const FENETRE_APRES_FIN_MS = 24 * 60 * 60_000;

// Pattern identique à celui de la route /stats (extraction de l'ID vidéo).
const RE_ID_YOUTUBE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

// Stocké sur globalThis : survit aux re-rendus HMR et partagé par tous les
// appels d'une même instance serverless (même astuce que le cache 30 s de
// la route /stats et le throttle de réconciliation V3.36).
const g = globalThis as unknown as { __syncYtParesseuse?: Map<string, number> };
if (!g.__syncYtParesseuse) g.__syncYtParesseuse = new Map();
const dernierSyncParLive: Map<string, number> = g.__syncYtParesseuse;

/**
 * Synchro arrière-plan des stats + commentaires YouTube d'un live.
 * À appeler dans un `after()` de la route /stats (jamais awaited dans la
 * réponse au spectateur). Ne fait rien si le throttle est actif, si le
 * live n'existe plus, ou s'il n'est plus éligible.
 */
export async function syncYouTubeStatsParesseuse(liveId: string): Promise<void> {
  // Throttle d'abord : zéro requête DB tant que la fenêtre n'est pas écoulée.
  const dernier = dernierSyncParLive.get(liveId) ?? 0;
  if (Date.now() - dernier < THROTTLE_MS) return;
  // Réserver AVANT le premier await : les polls concurrents (3-5 s) doivent
  // tous voir la réservation, pas lancer N synchros en parallèle.
  dernierSyncParLive.set(liveId, Date.now());

  try {
    const live = await db.liveStream.findUnique({
      where: { id: liveId },
      select: {
        id: true,
        title: true,
        servantId: true,
        youtubeUrl: true,
        status: true,
        endedAt: true,
      },
    });
    if (!live?.youtubeUrl) return;

    // Éligibilité : en cours, ou terminé depuis moins de 24 h (l'ancien cron
    // couvrait exactement cette fenêtre — au-delà, les stats du replay
    // n'évoluent plus assez pour justifier des appels API).
    const finieRecemment =
      live.status === "ENDED" &&
      !!live.endedAt &&
      Date.now() - new Date(live.endedAt).getTime() < FENETRE_APRES_FIN_MS;
    if (live.status !== "LIVE" && !finieRecemment) return;

    const videoId = live.youtubeUrl.match(RE_ID_YOUTUBE)?.[1] ?? null;
    if (!videoId) return;

    const stats = await fetchYouTubeStats(videoId);
    if (!stats) return;

    // Replay associé (même recherche que l'ancien cron : titre du live +
    // suffixe « (Replay) », même serviteur). Absent → on met seulement à
    // jour le LiveStream (pas d'erreur sur un Video inexistant).
    const replay = await db.video
      .findFirst({
        where: {
          servantId: live.servantId,
          title: { startsWith: `${live.title} (Replay)` },
        },
        select: { id: true },
      })
      .catch(() => null);

    if (replay) {
      await db.video
        .update({ where: { id: replay.id }, data: { views: stats.viewCount } })
        .catch(() => {});
    }
    await db.liveStream
      .update({ where: { id: live.id }, data: { viewerCount: stats.viewCount } })
      .catch(() => {});

    // Commentaires YouTube → chat de la plateforme (direct + replay).
    try {
      const comments = await syncYouTubeCommentsToDb(videoId, live.id);
      if (comments > 0) {
        console.log(
          `[sync-youtube-paresseuse] ${comments} commentaires importés pour le live ${live.id}`
        );
      }
    } catch {
      // OAuth absent/quota dépassé — la synchro des stats a déjà été faite.
    }
  } catch (e) {
    // Best-effort : un échec n'affecte jamais le spectateur.
    console.warn(
      "[sync-youtube-paresseuse] Synchro impossible :",
      e instanceof Error ? e.message : e
    );
  }
}
