import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncYouTubeStatsToVideo } from "@/lib/youtube-live-chat";
import { autoriserCron } from "@/lib/cron-auth";

/**
 * GET /api/cron/sync-youtube-stats — ⭐ V4.21 : DÉCLENCHEMENT MANUEL UNIQUEMENT.
 *
 * Ce cron a été RETIRÉ de vercel.json : il réveillait la base Neon selon
 * une horloge (toutes les 6 h, autrefois 30 min) pour rafraîchir des stats
 * que personne ne regardait à ces moments-là — l'une des causes de la
 * facture 158 $/3 mois.
 *
 * La synchro est désormais « PARESSEUSE » : elle part d'un VRAI spectateur
 * (GET /api/live/[id]/stats pollé pendant un direct → syncYouTubeStats-
 * Paresseuse, throttle 10 min par live). Cf. src/lib/sync-youtube-
 * paresseux.ts.
 *
 * CETTE ROUTE RESTE pour un balayage complet À LA DEMANDE :
 *   curl -H "X-Cron-Secret: $CRON_SECRET" https://www.mouvementchristlibere.com/api/cron/sync-youtube-stats
 *
 * Sécurité : Authorization Bearer (Vercel Cron) OU X-Cron-Secret (manuel).
 * CRON_SECRET non configuré (dev) → autorisé.
 *
 * Pour chaque live YouTube (en cours ou terminé < 24 h) :
 *  - Récupère viewCount, likeCount, commentCount depuis YouTube
 *  - Met à jour Video.views et LiveStream.viewerCount
 *  - Importe les commentaires YouTube dans LiveChatMessage
 */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // ⭐ V3.39 — Vérifier le secret cron (Bearer Vercel OU X-Cron-Secret)
  if (!autoriserCron(req)) {
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
