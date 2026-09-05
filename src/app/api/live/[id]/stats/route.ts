import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * ⭐ V2.9 — GET /api/live/[id]/stats — Statistiques TEMPS RÉEL du live.
 *
 * Contexte : le studio affichait des bitrates/latence FAUX (random) et un
 * compteur de viewers rarement juste ; les stats YouTube n'étaient lues
 * que par un cron toutes les 30 min. Le studio et la page viewer pollent
 * cette route toutes les 5 s pendant la diffusion.
 *
 * Réponse :
 * {
 *   status, startedAt, isPaused, pausedAt,
 *   viewerCount,          // présence fraîche (< 90 s) — LiveViewer
 *   chatMessageCount,     // messages de chat (type "message")
 *   reactionCount,        // réactions
 *   likesTotal,           // somme des likeCount des messages
 *   youtube: { viewCount, likeCount, commentCount } | null
 *                          // si OAuth YouTube configuré + youtubeUrl
 *   youtubeConfigured: boolean,
 *   youtubeUrl            // ⭐ V3.33 — fraîche (bascule embed viewer)
 * }
 */

const PRESENCE_WINDOW_MS = 90_000;

// ⭐ V3.26 — CACHE des stats YouTube (30 s) : le viewer poll désormais
// /stats (au lieu de /next — réparation « direct terminé » faux), or la
// route interrogeait l'API YouTube À CHAQUE appel : N viewers × 1 appel/3 s
// = des dizaines de milliers d'unités de quota YouTube par jour (quota
// quotidien : 10 000). Avec ce cache mémoire partagé (studio + viewers,
// par instance serverless), on retombe à ≤ 2 appels API/minute — et la
// persistance du viewerCount sur le LiveStream suit le même rythme.
const YOUTUBE_STATS_TTL_MS = 30_000;
const ytStatsGlobal = globalThis as unknown as {
  __ytStatsCache?: Map<string, { stats: { viewCount: number; likeCount: number; commentCount: number } | null; fetchedAt: number }>;
};
if (!ytStatsGlobal.__ytStatsCache) ytStatsGlobal.__ytStatsCache = new Map();
const ytStatsCache: NonNullable<typeof ytStatsGlobal.__ytStatsCache> = ytStatsGlobal.__ytStatsCache;

// ─── ⭐ V3.36 — RÉCONCILIATION DE L'ID YOUTUBE PENDANT LE DIRECT ───
// Anomalie pasteur : « le live est bien en direct sur YouTube, mais le
// viewer public affiche un écran noir — vidéo supprimée par l'utilisateur ».
// Cause racine : le broadcast pré-créé au /start (Tier C) n'était PAS celui
// alimenté par l'egress (qui poussait vers la clé RTMP du serviteur) →
// l'URL stockée pointait sur un broadcast « zombie » jamais diffusé.
// La réconciliation : pendant le LIVE, si les stats YouTube de l'ID stocké
// sont INTROUVABLES (vidéo inexistante) ou si aucune URL n'est connue, on
// interroge la chaîne (liveBroadcasts.list, 1 unité) pour trouver le
// broadcast réellement EN DIRECT et on corrige LiveStream.youtubeUrl.
// Le viewer, qui poll cette route toutes les 3 s, bascule alors
// automatiquement sur le VRAI embed (logique V3.33).
//
// Throttle mémoire (30 s par live) : même si studio + N viewers pollent
// toutes les 3-5 s, une seule tentative de réconciliation par demi-minute
// et par instance serverless — le budget quota YouTube reste maîtrisé.
const RECONCILE_THROTTLE_MS = 30_000;
const reconcileGlobal = globalThis as unknown as {
  __liveYtReconcile?: Map<string, number>;
};
if (!reconcileGlobal.__liveYtReconcile) reconcileGlobal.__liveYtReconcile = new Map();
const reconcileLastAt: Map<string, number> = reconcileGlobal.__liveYtReconcile;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const live = await db.liveStream.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        isPaused: true,
        pausedAt: true,
        youtubeUrl: true,
        streamToYoutube: true,
      },
    });
    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    // ─── Présence fraîche ───
    const since = new Date(Date.now() - PRESENCE_WINDOW_MS);
    const [viewerCount, chatMessageCount, reactionCount, likesAgg] = await Promise.all([
      db.liveViewer.count({
        where: { liveId: id, isActive: true, lastSeenAt: { gte: since } },
      }),
      db.liveChatMessage.count({ where: { liveId: id, type: "message" } }),
      db.liveChatMessage.count({ where: { liveId: id, type: "reaction" } }),
      db.liveChatMessage.aggregate({
        where: { liveId: id },
        _sum: { likeCount: true },
      }),
    ]);

    // ─── Stats YouTube (si OAuth configuré) — ⭐ V3.26 via cache 30 s ───
    let youtube: { viewCount: number; likeCount: number; commentCount: number } | null = null;
    let youtubeConfigured = false;
    let youtubeUrlOut = live.youtubeUrl;

    const storedVideoId = live.youtubeUrl?.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    )?.[1] ?? null;

    if (live.youtubeUrl && storedVideoId) {
      try {
        const { isYouTubeOAuthConfigured } = await import("@/lib/youtube");
        youtubeConfigured = isYouTubeOAuthConfigured();
        if (youtubeConfigured) {
          const cached = ytStatsCache.get(storedVideoId);
          if (cached && Date.now() - cached.fetchedAt < YOUTUBE_STATS_TTL_MS) {
            youtube = cached.stats;
          } else {
            const { fetchYouTubeStats } = await import("@/lib/youtube-live-chat");
            youtube = await fetchYouTubeStats(storedVideoId);
            ytStatsCache.set(storedVideoId, { stats: youtube, fetchedAt: Date.now() });
            // Persister sur le LiveStream (page d'accueil, archives) —
            // au rythme du cache, plus à chaque poll.
            if (youtube) {
              await db.liveStream.update({
                where: { id },
                data: { viewerCount: youtube.viewCount },
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn("[live/stats] YouTube indisponible:", e instanceof Error ? e.message : e);
      }
    }

    // ─── ⭐ V3.36 — RÉCONCILIATION pendant le direct ───
    // Déclenchée UNIQUEMENT si le live est LIVE, diffusé vers YouTube, que
    // l'OAuth est configuré, ET que (a) aucune URL n'est connue, ou (b) les
    // stats de l'ID stocké sont introuvables (broadcast zombie → la vidéo
    // n'existe pas). La vraie vidéo du direct (clé du serviteur ou ingest
    // Tier C) est alors retrouvée sur la chaîne et propagée aux viewers.
    if (live.status === "LIVE" && live.streamToYoutube && (!storedVideoId || youtube === null)) {
      // NB : isYouTubeOAuthConfigured() est un simple contrôle de variables
      // d'environnement (zéro appel réseau) — on le réévalue ici car il
      // n'est rempli ci-dessus QUE lorsqu'une URL était déjà connue.
      let oauthOk = youtubeConfigured;
      if (!oauthOk) {
        const { isYouTubeOAuthConfigured } = await import("@/lib/youtube");
        oauthOk = isYouTubeOAuthConfigured();
      }
      if (oauthOk) {
        const last = reconcileLastAt.get(live.id) ?? 0;
        if (Date.now() - last > RECONCILE_THROTTLE_MS) {
          reconcileLastAt.set(live.id, Date.now());
          try {
            const { findActiveBroadcastVideoId, getYoutubeVideoUrl } = await import("@/lib/youtube");
            const activeId = await findActiveBroadcastVideoId();
            if (activeId && activeId !== storedVideoId) {
              const nouvelleUrl = getYoutubeVideoUrl(activeId);
              console.log(
                `[live/stats] Réconciliation YouTube : ${storedVideoId ?? "(aucun)"} → ${activeId} (le viewer va basculer sur le VRAI direct)`
              );
              await db.liveStream
                .update({ where: { id }, data: { youtubeUrl: nouvelleUrl } })
                .catch(() => {});
              youtubeUrlOut = nouvelleUrl;
              // Invalider le cache de stats de l'ancien ID et pré-charger les
              // stats du vrai (le prochain poll les affichera immédiatement).
              if (storedVideoId) ytStatsCache.delete(storedVideoId);
              try {
                const { fetchYouTubeStats } = await import("@/lib/youtube-live-chat");
                const stats = await fetchYouTubeStats(activeId);
                ytStatsCache.set(activeId, { stats, fetchedAt: Date.now() });
                if (stats) youtube = stats;
              } catch {}
            }
          } catch (e) {
            console.warn(
              "[live/stats] Réconciliation YouTube impossible :",
              e instanceof Error ? e.message : e
            );
          }
        }
      }
    }

    return NextResponse.json({
      status: live.status,
      startedAt: live.startedAt?.toISOString() ?? null,
      endedAt: live.endedAt?.toISOString() ?? null,
      // ⭐ V3.33 — youtubeUrl : le viewer public ne le connaît qu'au rendu
      // SSR initial (null s'il a ouvert la page AVANT le début du direct).
      // Sans cette valeur fraîche, il ne basculait JAMAIS sur l'embed
      // YouTube et restait sur « En attente du diffuseur » alors que le
      // broadcast était pourtant lancé (anomalie « préparation du flux »
      // éternelle côté site public).
      // ⭐ V3.36 — peut être CORRIGÉE en direct par la réconciliation
      // ci-dessus (broadcast zombie → vraie vidéo du direct).
      youtubeUrl: youtubeUrlOut,
      isPaused: live.isPaused,
      pausedAt: live.pausedAt?.toISOString() ?? null,
      viewerCount,
      chatMessageCount,
      reactionCount,
      likesTotal: likesAgg._sum.likeCount ?? 0,
      youtube,
      youtubeConfigured,
    });
  } catch (error) {
    console.error("[live/stats] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
