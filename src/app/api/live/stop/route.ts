import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "wss://christ-libere.livekit.cloud";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { liveId, recordingUrl } = await req.json();
    if (!liveId) {
      return NextResponse.json({ error: "liveId requis" }, { status: 400 });
    }

    const live = await db.liveStream.findUnique({
      where: { id: liveId },
      include: { servant: true },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    // Arrêter les egress RTMP (best effort) — utiliser EgressClient
    try {
      const { EgressClient } = await import("livekit-server-sdk");
      const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

      if (live.livekitRoomName) {
        try {
          const egresses = await egressClient.listEgress({ roomName: live.livekitRoomName });
          for (const egress of egresses) {
            try {
              await egressClient.stopEgress(egress.egressId);
              console.log(`[live/stop] Stopped egress ${egress.egressId}`);
            } catch (err) {
              console.error(`[live/stop] Failed to stop egress ${egress.egressId}:`, err);
            }
          }
        } catch (err) {
          console.error("[live/stop] Failed to list/stop egresses:", err);
        }
      }
    } catch (e) {
      console.error("[live/stop] EgressClient not available:", e);
    }

    // Calculer la durée du live
    const now = new Date();
    let durationStr = "";
    // (C7) Si startedAt est null (par ex. /api/live/start a échoué), estimer
    // la durée avec scheduledAt comme point de départ. Si aucune estimation
    // n'est possible ou si la durée calculée est négative, mettre "0:00" au
    // lieu de laisser une chaîne vide.
    const startForDuration = live.startedAt || live.scheduledAt;
    if (startForDuration) {
      const durationMs = now.getTime() - new Date(startForDuration).getTime();
      if (durationMs > 0) {
        const h = Math.floor(durationMs / 3600000);
        const m = Math.floor((durationMs % 3600000) / 60000);
        const s = Math.floor((durationMs % 60000) / 1000);
        durationStr = h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      } else {
        durationStr = "0:00";
      }
    } else {
      durationStr = "0:00";
    }

    // Mettre à jour le live : statut ENDED + endedAt
    // (YT-pause) Réinitialiser isPaused/pausedAt pour éviter qu'un viewer
    // arrivant sur la page après l'arrêt ne voie un écran "en pause".
    await db.liveStream.update({
      where: { id: liveId },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        recordingUrl: recordingUrl || null,
        isPaused: false,
        pausedAt: null,
      },
    });

    // ─── Toujours archiver le replay en tant que vidéo ───
    // Même sans recordingUrl, on crée l'entrée pour qu'elle apparaisse dans le module vidéo
    //
    // (YouTube-replay) Si pas de recordingUrl (R2) ET que le live était streamé vers
    // YouTube, on tente de récupérer automatiquement l'URL YouTube du replay via
    // l'API YouTube Data. Cela évite de stocker le replay sur R2 (économie de
    // stockage — le free tier R2 est 10GB).
    let youtubeReplayUrl = live.youtubeUrl;

    if (!recordingUrl && live.streamToYoutube && !youtubeReplayUrl) {
      // YouTube met 30s à 5min pour publier le replay après la fin du RTMP.
      // On tente une récupération — si elle échoue, le replay aura videoUrl=null
      // et l'admin pourra le récupérer manuellement via /api/live/[id]/youtube-replay.
      try {
        const { resolveYoutubeReplayUrl, isYouTubeOAuthConfigured } = await import("@/lib/youtube");
        if (isYouTubeOAuthConfigured() && live.startedAt) {
          console.log("[live/stop] Tentative de récupération auto YouTube replay...");
          const ytResult = await resolveYoutubeReplayUrl(
            live.startedAt,
            live.youtubeUrl,
            live.title
          );
          if (ytResult) {
            youtubeReplayUrl = ytResult.url;
            // Persister l'URL YouTube pour les futurs appels
            await db.liveStream.update({
              where: { id: liveId },
              data: { youtubeUrl: ytResult.url },
            });
            console.log(`[live/stop] YouTube replay récupéré: ${ytResult.url} (source: ${ytResult.source})`);
          } else {
            console.log("[live/stop] YouTube replay non trouvé — l'admin peut le récupérer manuellement");
          }
        }
      } catch (ytError) {
        console.error("[live/stop] Erreur récupération YouTube replay:", ytError);
        // Ne pas faire échouer le stop pour autant
      }
    }

    const replayUrl = recordingUrl || youtubeReplayUrl || null;
    const liveDate = new Date(live.startedAt || live.scheduledAt);
    const dateStr = liveDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    // Calculer le nombre total de viewers uniques du live (cumul sur la session)
    // → sera transféré comme "views" de la vidéo archivée
    const uniqueViewerCount = await db.liveViewer.count({
      where: { liveId: liveId },
    });
    const totalViews = Math.max(live.viewerCount, uniqueViewerCount);

    try {
      // Vérifier si un replay existe déjà (éviter les doublons)
      const existingReplay = await db.video.findFirst({
        where: {
          servantId: live.servantId,
          title: { startsWith: `${live.title} (Replay)` },
        },
      });

      if (!existingReplay) {
        await db.video.create({
          data: {
            servantId: live.servantId,
            title: `${live.title} (Replay)`,
            description: `Replay du live du ${dateStr}${live.description ? ` — ${live.description}` : ""}`,
            duration: durationStr,
            views: totalViews,
            isLive: false,
            videoUrl: replayUrl,
            hlsUrl: recordingUrl || null,
            thumbnailUrl: live.thumbnailUrl || (live.youtubeUrl ? `https://img.youtube.com/vi/${extractYoutubeId(live.youtubeUrl)}/hqdefault.jpg` : null),
            publishedAt: new Date(),
          },
        });
        console.log(`[live/stop] Replay archivé pour le live ${liveId} (${totalViews} vues)`);
      } else {
        // Mettre à jour le replay existant — cumuler les vues
        const newViews = Math.max(existingReplay.views, totalViews);
        await db.video.update({
          where: { id: existingReplay.id },
          data: {
            videoUrl: replayUrl || existingReplay.videoUrl,
            hlsUrl: recordingUrl || existingReplay.hlsUrl,
            duration: durationStr || existingReplay.duration,
            thumbnailUrl: live.thumbnailUrl || existingReplay.thumbnailUrl,
            views: newViews,
          },
        });
        console.log(`[live/stop] Replay mis à jour pour le live ${liveId} (${newViews} vues)`);
      }
    } catch (err) {
      console.error("[live/stop] Failed to archive replay:", err);
    }

    return NextResponse.json({
      success: true,
      liveId,
      status: "ENDED",
      archived: true,
    });
  } catch (error) {
    console.error("[live/stop] Error:", error);
    return NextResponse.json({ error: "Erreur lors de l'arrêt" }, { status: 500 });
  }
}

// Helper : extraire l'ID YouTube d'une URL
function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}
