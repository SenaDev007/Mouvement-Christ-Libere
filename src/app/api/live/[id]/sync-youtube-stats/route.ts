import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { syncYouTubeStatsToVideo } from "@/lib/youtube-live-chat";

/**
 * POST /api/live/[id]/sync-youtube-stats
 *
 * Récupère les stats YouTube (vues, likes, commentaires) d'un live/vidéo
 * et les persiste en DB Christ Libère.
 *
 * - Met à jour Video.views avec le viewCount YouTube
 * - Met à jour LiveStream.viewerCount avec le viewCount YouTube
 * - Importe les commentaires YouTube dans LiveChatMessage (type "youtube_comment")
 *
 * Réservé aux admins (appel manuel) ou au cron automatique.
 *
 * Response: { success, stats: { viewCount, likeCount, commentCount, commentsSynced } }
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    // Accepter les appels sans auth si c'est le cron (header X-Cron-Secret)
    const cronSecret = _req.headers.get("x-cron-secret");
    const isCron = cronSecret === process.env.CRON_SECRET;

    if (!isCron && (!sessionToken || !verifySessionToken(sessionToken))) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;

    // Récupérer le live avec son youtubeUrl
    const live = await db.liveStream.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        youtubeUrl: true,
        status: true,
      },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    if (!live.youtubeUrl) {
      return NextResponse.json({
        success: false,
        error: "Ce live n'a pas d'URL YouTube",
      }, { status: 400 });
    }

    // Trouver la vidéo replay associée (titre se termine par "(Replay)")
    const replayVideo = await db.video.findFirst({
      where: {
        servantId: (await db.liveStream.findUnique({
          where: { id },
          select: { servantId: true },
        }))?.servantId,
        title: { startsWith: `${live.title} (Replay)` },
      },
      select: { id: true },
    });

    // Sync les stats YouTube vers la DB
    const result = await syncYouTubeStatsToVideo(
      live.youtubeUrl,
      replayVideo?.id || live.id, // fallback vers liveId si pas de replay
      live.id
    );

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "Impossible de récupérer les stats YouTube (OAuth configuré ?)",
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      liveId: id,
      stats: result,
    });
  } catch (error) {
    console.error("[sync-youtube-stats] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
