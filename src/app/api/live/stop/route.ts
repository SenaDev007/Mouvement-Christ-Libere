import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { RoomServiceClient } from "livekit-server-sdk";

/**
 * POST /api/live/stop
 *
 * Termine un live : change le statut à ENDED, remplit endedAt,
 * arrête les egress RTMP et archive le replay si un recording est disponible.
 *
 * Body: { liveId, recordingUrl? }
 */

const LIVEKIT_URL = process.env.LIVEKIT_URL || "wss://christ-libere.livekit.cloud";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

export async function POST(req: NextRequest) {
  try {
    // Vérifier l'authentification admin
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { liveId, recordingUrl } = await req.json();
    if (!liveId) {
      return NextResponse.json({ error: "liveId requis" }, { status: 400 });
    }

    // Récupérer le live
    const live = await db.liveStream.findUnique({
      where: { id: liveId },
      include: { servant: true },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    // Arrêter les egress RTMP (best effort)
    if (live.livekitRoomName) {
      try {
        // List all egress and stop them
        const egresses = await roomService.listEgress({ roomName: live.livekitRoomName });
        for (const egress of egresses) {
          try {
            await roomService.stopEgress(egress.egressId);
            console.log(`[live/stop] Stopped egress ${egress.egressId}`);
          } catch (err) {
            console.error(`[live/stop] Failed to stop egress ${egress.egressId}:`, err);
          }
        }
      } catch (err) {
        console.error("[live/stop] Failed to list/stop egresses:", err);
      }
    }

    // Mettre à jour le live : statut ENDED + endedAt + recordingUrl
    const updated = await db.liveStream.update({
      where: { id: liveId },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        recordingUrl: recordingUrl || null,
      },
    });

    // Archiver en tant que vidéo (replay) si un recording est disponible
    if (recordingUrl || live.youtubeUrl) {
      try {
        const replayUrl = recordingUrl || live.youtubeUrl;
        await db.video.create({
          data: {
            servantId: live.servantId,
            title: `${live.title} (Replay)`,
            description: `Replay du live du ${new Date(live.startedAt || live.scheduledAt).toLocaleDateString("fr-FR")} — ${live.description || ""}`,
            duration: "",
            views: 0,
            isLive: false,
            videoUrl: replayUrl,
            hlsUrl: recordingUrl || null,
            thumbnailUrl: live.thumbnailUrl || null,
            publishedAt: new Date(),
          },
        });
        console.log(`[live/stop] Replay archivé pour le live ${liveId}`);
      } catch (err) {
        console.error("[live/stop] Failed to archive replay:", err);
      }
    }

    return NextResponse.json({
      success: true,
      liveId,
      status: "ENDED",
      archived: !!(recordingUrl || live.youtubeUrl),
    });
  } catch (error) {
    console.error("[live/stop] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'arrêt du live" },
      { status: 500 }
    );
  }
}
