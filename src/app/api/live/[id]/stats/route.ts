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
 *   youtubeConfigured: boolean
 * }
 */

const PRESENCE_WINDOW_MS = 90_000;

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

    // ─── Stats YouTube (si OAuth configuré) ───
    let youtube: { viewCount: number; likeCount: number; commentCount: number } | null = null;
    let youtubeConfigured = false;
    if (live.youtubeUrl) {
      try {
        const { isYouTubeOAuthConfigured } = await import("@/lib/youtube");
        youtubeConfigured = isYouTubeOAuthConfigured();
        if (youtubeConfigured) {
          const { fetchYouTubeStats } = await import("@/lib/youtube-live-chat");
          const videoId = live.youtubeUrl.match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
          )?.[1];
          if (videoId) {
            youtube = await fetchYouTubeStats(videoId);
            // Persister sur le LiveStream (page d'accueil, archives)
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

    return NextResponse.json({
      status: live.status,
      startedAt: live.startedAt?.toISOString() ?? null,
      endedAt: live.endedAt?.toISOString() ?? null,
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
