import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getLiveKitConfig } from "@/lib/livekit-config";

export async function POST(req: NextRequest) {
  // ⭐ V3.19 — clés lues au RUNTIME (bascule Plan B sans rebuild)
  const { url: LIVEKIT_URL, apiKey: LIVEKIT_API_KEY, apiSecret: LIVEKIT_API_SECRET } = getLiveKitConfig();
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

    // ─── ⭐ V2.9 — FERMETURE FORCÉE DE LA DIFFUSION (cause racine du
    //     « YouTube continuait de streamer après l'arrêt dans le
    //     back-office » : seul l'egress était arrêté "best effort", mais
    //     le studio restait publié et les viewers restaient connectés →
    //     la room LiveKit restait vivante → l'egress RTMP reprenait /
    //     continuait. On coupe maintenant TOUT, côté serveur :
    //     1. éjection de TOUS les participants (studio + viewers) ;
    //     2. suppression de la room (ferme aussi les egress actifs) ;
    //     3. arrêt explicite de tous les egress RTMP de la room. ───
    const teardownResults: string[] = [];
    try {
      const { RoomServiceClient, EgressClient } = await import("livekit-server-sdk");
      const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

      if (live.livekitRoomName) {
        // 1. Éjecter tous les participants (leur client reçoit Disconnected)
        try {
          const participants = await roomService.listParticipants(live.livekitRoomName);
          for (const p of participants) {
            try {
              await roomService.removeParticipant(live.livekitRoomName, p.identity);
            } catch { /* déjà parti */ }
          }
          if (participants.length > 0) {
            teardownResults.push(`${participants.length} participant(s) éjecté(s)`);
            console.log(`[live/stop] ${participants.length} participant(s) éjecté(s) de ${live.livekitRoomName}`);
          }
        } catch (err) {
          console.error("[live/stop] listParticipants impossible:", err);
        }

        // 2. Arrêter les egress RTMP (explicit, best effort)
        try {
          const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
          const egresses = await egressClient.listEgress({ roomName: live.livekitRoomName });
          let stopped = 0;
          for (const egress of egresses) {
            try {
              await egressClient.stopEgress(egress.egressId);
              stopped++;
              console.log(`[live/stop] Stopped egress ${egress.egressId}`);
            } catch (err) {
              console.error(`[live/stop] Failed to stop egress ${egress.egressId}:`, err);
            }
          }
          if (stopped > 0) teardownResults.push(`${stopped} egress RTMP arrêté(s)`);
        } catch (err) {
          console.error("[live/stop] Failed to list/stop egresses:", err);
        }

        // 3. Supprimer la room → tous les flux coupés, YouTube voit
        //    l'ingest RTMP disparaître et termine la diffusion.
        try {
          await roomService.deleteRoom(live.livekitRoomName);
          teardownResults.push("room fermée");
          console.log(`[live/stop] Room ${live.livekitRoomName} supprimée`);
        } catch (err) {
          // Room déjà fermée (webhook room_finished) → normal
          console.warn(`[live/stop] deleteRoom (déjà fermée ?):`, err instanceof Error ? err.message : err);
        }
      }
    } catch (e) {
      console.error("[live/stop] LiveKit SDK indisponible:", e);
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

    // ─── Tier C : Transitionner le broadcast vers "complete" si pré-créé ───
    // Si le broadcast a été pré-créé au démarrage (Tier C), youtubeUrl est déjà
    // connu. On appelle transitionBroadcastToComplete pour dire à YouTube de
    // finaliser la vidéo → le replay devient public immédiatement.
    if (live.streamToYoutube && youtubeReplayUrl) {
      try {
        const { transitionBroadcastToComplete, isYouTubeOAuthConfigured, extractYoutubeId } = await import("@/lib/youtube");
        if (isYouTubeOAuthConfigured()) {
          const broadcastId = extractYoutubeId(youtubeReplayUrl);
          if (broadcastId) {
            console.log(`[live/stop] Transition broadcast ${broadcastId} → complete (Tier C)`);
            await transitionBroadcastToComplete(broadcastId);
          }
        }
      } catch (ytError) {
        console.error("[live/stop] Erreur transition broadcast:", ytError);
        // Ne pas faire échouer le stop — YouTube fait auto-transition avec enableAutoStop
      }
    }

    // ─── Tier B fallback : si pas d'URL YouTube connue, la récupérer ───
    if (!recordingUrl && live.streamToYoutube && !youtubeReplayUrl) {
      // YouTube met 30s à 5min pour publier le replay après la fin du RTMP.
      // On tente une récupération — si elle échoue, le replay aura videoUrl=null
      // et l'admin pourra le récupérer manuellement via /api/live/[id]/youtube-replay.
      try {
        const { resolveYoutubeReplayUrl, isYouTubeOAuthConfigured } = await import("@/lib/youtube");
        if (isYouTubeOAuthConfigured() && live.startedAt) {
          console.log("[live/stop] Tentative de récupération auto YouTube replay (Tier B)...");
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

    // ⭐ V3.26 — FIN DES DONNÉES FICTIVES sur le replay :
    // AVANT, le replay était créé avec views = totalViews (nombre de
    // viewers du direct, transférés) et le lecteur vidéo affichait…
    // views comme compteur de LIKES → « 5 likes » (ou N) sans aucun like
    // réel (anomalie remontée par le pasteur). Désormais le replay est
    // créé avec des compteurs à ZÉRO : les vues et les likes ne
    // s'accumulent que par les interactions réelles des visiteurs.
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
            views: 0,
            isLive: false,
            videoUrl: replayUrl,
            hlsUrl: recordingUrl || null,
            thumbnailUrl: live.thumbnailUrl || (live.youtubeUrl ? `https://img.youtube.com/vi/${extractYoutubeId(live.youtubeUrl)}/hqdefault.jpg` : null),
            publishedAt: new Date(),
          },
        });
        console.log(`[live/stop] Replay archivé pour le live ${liveId} (compteurs à zéro — données réelles uniquement)`);
      } else {
        // Mettre à jour le replay existant — URL/durée/miniature
        // (les compteurs ne sont JAMAIS écrasés : ils continuent de
        // refléter les interactions réelles sur la vidéo publiée).
        await db.video.update({
          where: { id: existingReplay.id },
          data: {
            videoUrl: replayUrl || existingReplay.videoUrl,
            hlsUrl: recordingUrl || existingReplay.hlsUrl,
            duration: durationStr || existingReplay.duration,
            thumbnailUrl: live.thumbnailUrl || existingReplay.thumbnailUrl,
          },
        });
        console.log(`[live/stop] Replay mis à jour pour le live ${liveId}`);
      }
    } catch (err) {
      console.error("[live/stop] Failed to archive replay:", err);
    }

    return NextResponse.json({
      success: true,
      liveId,
      status: "ENDED",
      archived: true,
      // ⭐ V2.9 — Détail de la fermeture force (participants éjectés,
      // egress arrêtés, room supprimée) pour l'affichage studio.
      teardown: teardownResults,
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
