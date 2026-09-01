import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

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

    // ─── Tier C : Pré-créer le broadcast YouTube si streamToYoutube ───
    // On crée le broadcast AVANT le démarrage du live pour connaître le
    // video ID à l'avance. L'URL YouTube est stockée dans LiveStream.youtubeUrl
    // immédiatement → le replay sera disponible instantanément à la fin du live
    // sans lookup post-live (économie d'API + latence zéro).
    let youtubeBroadcastInfo: { videoId: string; url: string; ingestAddress?: string } | null = null;
    if (live.streamToYoutube && !live.youtubeUrl) {
      try {
        const { createBroadcast, isYouTubeOAuthConfigured } = await import("@/lib/youtube");
        if (isYouTubeOAuthConfigured()) {
          console.log("[live/start] Pré-création du broadcast YouTube...");
          const broadcast = await createBroadcast(
            live.title,
            live.scheduledAt,
            live.description
          );
          if (broadcast) {
            youtubeBroadcastInfo = {
              videoId: broadcast.videoId,
              url: broadcast.url,
              ingestAddress: broadcast.ingestAddress,
            };
            console.log(`[live/start] Broadcast YouTube pré-créé: ${broadcast.url}`);
          }
        }
      } catch (ytError) {
        console.error("[live/start] Erreur pré-création broadcast YouTube:", ytError);
        // Ne pas faire échouer le démarrage — fallback Tier B au stop
      }
    }

    // Mettre à jour le live : statut LIVE + startedAt + roomName + youtubeUrl (Tier C)
    // (YT-pause) Réinitialiser l'état de pause au cas où le live aurait été
    // arrêté puis redémarré sans passage par /stop (rare mais possible).
    await db.liveStream.update({
      where: { id: liveId },
      data: {
        status: "LIVE",
        startedAt: new Date(),
        livekitRoomName: roomName,
        isPaused: false,
        pausedAt: null,
        // Tier C : si un broadcast a été pré-créé, on stocke l'URL YouTube
        ...(youtubeBroadcastInfo ? { youtubeUrl: youtubeBroadcastInfo.url } : {}),
      },
    });

    // Nettoyer les messages de chat du live précédent
    await db.liveChatMessage.deleteMany({
      where: { liveId },
    });

    // Réinitialiser le compteur de viewers
    await db.liveViewer.updateMany({
      where: { liveId, isActive: true },
      data: { isActive: false, leftAt: new Date() },
    });

    // ─── Multistreaming RTMP ───
    // NOTE : L'egress RTMP est démarré par /api/live/[id]/egress APRES que le studio
    // s'est connecté à LiveKit et publie un track. L'egress nécessite une room active
    // avec un participant qui publie — sinon il n'y a rien à streamer vers YouTube.
    const egressIds: string[] = [];

    return NextResponse.json({
      success: true,
      liveId,
      roomName,
      status: "LIVE",
      multistream: {
        enabled: live.multistreamEnabled,
        destinations: egressIds,
      },
      // Tier C : info du broadcast YouTube pré-créé
      youtubeBroadcast: youtubeBroadcastInfo,
    });
  } catch (error) {
    console.error("[live/start] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors du démarrage du live" },
      { status: 500 }
    );
  }
}
