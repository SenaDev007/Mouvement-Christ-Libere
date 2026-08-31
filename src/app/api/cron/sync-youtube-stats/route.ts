import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncYouTubeStatsToVideo } from "@/lib/youtube-live-chat";

/**
 * GET /api/cron/sync-youtube-stats
 *
 * Cron automatique (toutes les 30 min) qui synchronise les stats YouTube
 * pour tous les lives en cours ou récemment terminés (24h).
 *
 * Sécurité : header X-Cron-Secret requis (configuré sur Vercel Cron).
 *
 * Pour chaque live YouTube :
 *  - Récupère viewCount, likeCount, commentCount depuis YouTube
 *  - Met à jour Video.views et LiveStream.viewerCount
 *  - Importe les commentaires YouTube dans LiveChatMessage
 */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Vérifier le secret cron
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    // Trouver tous les lives YouTube en cours ou terminés dans les 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lives = await db.liveStream.findMany({
      where: {
        youtubeUrl: { not: null },
        OR: [
          { status: "LIVE" },
          {
            status: "ENDED",
            endedAt: { gte: since },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        youtubeUrl: true,
        status: true,
        servantId: true,
      },
      take: 20, // max 20 lives par run (quota API)
    });

    let synced = 0;
    let failed = 0;

    for (const live of lives) {
      if (!live.youtubeUrl) continue;

      // Trouver le replay associé
      const replayVideo = await db.video.findFirst({
        where: {
          servantId: live.servantId,
          title: { startsWith: `${live.title} (Replay)` },
        },
        select: { id: true },
      });

      const result = await syncYouTubeStatsToVideo(
        live.youtubeUrl,
        replayVideo?.id || live.id,
        live.id
      );

      if (result) {
        synced++;
        console.log(`[cron] Live ${live.id}: ${result.viewCount} vues, ${result.likeCount} likes, ${result.commentsSynced} commentaires sync`);
      } else {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      total: lives.length,
      synced,
      failed,
    });
  } catch (error) {
    console.error("[cron/sync-youtube-stats] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
