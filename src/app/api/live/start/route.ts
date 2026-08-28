import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { RoomServiceClient } from "livekit-server-sdk";

/**
 * POST /api/live/start
 *
 * Démarre un live : change le statut à LIVE, remplit startedAt,
 * crée la room LiveKit et démarre le multistreaming RTMP si activé.
 *
 * Body: { liveId }
 *
 * Réservé aux admins authentifiés (cookie admin_session).
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

    const { liveId } = await req.json();
    if (!liveId) {
      return NextResponse.json({ error: "liveId requis" }, { status: 400 });
    }

    // Récupérer le live
    const live = await db.liveStream.findUnique({
      where: { id: liveId },
      include: {
        servant: {
          include: { streamConfig: true },
        },
      },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    if (live.status === "LIVE") {
      return NextResponse.json({ error: "Le live est déjà en cours" }, { status: 400 });
    }

    // Générer le nom de la room LiveKit si pas déjà fait
    const roomName = live.livekitRoomName || `live-${live.id}`;

    // Mettre à jour le live : statut LIVE + startedAt + roomName
    await db.liveStream.update({
      where: { id: liveId },
      data: {
        status: "LIVE",
        startedAt: new Date(),
        livekitRoomName: roomName,
      },
    });

    // Démarrer le multistreaming RTMP si activé
    const egressIds: string[] = [];
    if (live.multistreamEnabled && live.servant.streamConfig) {
      const config = live.servant.streamConfig;
      const destinations: { url: string; name: string }[] = [];

      if (live.streamToYoutube && config.youtubeRtmpUrl && config.youtubeRtmpKey) {
        destinations.push({
          url: `${config.youtubeRtmpUrl}/${config.youtubeRtmpKey}`,
          name: "youtube",
        });
      }
      if (live.streamToFacebook && config.facebookRtmpUrl && config.facebookRtmpKey) {
        destinations.push({
          url: `${config.facebookRtmpUrl}/${config.facebookRtmpKey}`,
          name: "facebook",
        });
      }
      if (live.streamToTiktok && config.tiktokRtmpUrl && config.tiktokRtmpKey) {
        destinations.push({
          url: `${config.tiktokRtmpUrl}/${config.tiktokRtmpKey}`,
          name: "tiktok",
        });
      }
      if (live.streamToInstagram && config.instagramRtmpUrl && config.instagramRtmpKey) {
        destinations.push({
          url: `${config.instagramRtmpUrl}/${config.instagramRtmpKey}`,
          name: "instagram",
        });
      }

      // Démarrer les egress RTMP via LiveKit
      for (const dest of destinations) {
        try {
          const egress = await roomService.startRTMPEgress(roomName, {
            rtmpUrl: dest.url,
            name: dest.name,
          });
          egressIds.push(egress.egressId || dest.name);
          console.log(`[live/start] RTMP egress started for ${dest.name}: ${egress.egressId}`);
        } catch (err) {
          console.error(`[live/start] Failed to start RTMP for ${dest.name}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      liveId,
      roomName,
      status: "LIVE",
      multistream: {
        enabled: live.multistreamEnabled,
        destinations: egressIds,
      },
    });
  } catch (error) {
    console.error("[live/start] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors du démarrage du live" },
      { status: 500 }
    );
  }
}
