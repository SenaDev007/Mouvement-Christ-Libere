import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getLiveKitConfig } from "@/lib/livekit-config";

// ⭐ V3.34 — le nettoyage LiveKit (éjections + egress + room) peut prendre
// plusieurs dizaines de secondes : sans cette marge, la fonction était tuée
// par Vercel avant d'avoir terminé (l'archivage du replay se faisait APRÈS
// le nettoyage → jamais exécuté — cause racine de « la vidéo n'apparaît
// pas dans Vidéos »).
export const maxDuration = 60;

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

    // ─── ⭐ V3.33 — ARRÊT IMMÉDIAT EN BASE, AVANT TOUT LE RESTE ───
    // Anomalie remontée par le pasteur : « je clique Terminer, API fetch
    // timeout 8000 ms /api/live/stop, et ça ne s'arrête pas ». Causes :
    //  1) le client uploadait le replay (parfois long) AVANT d'appeler /stop
    //    → YouTube continuait de diffuser pendant tout l'upload (corrigé
    //    côté studio : le /stop est désormais appelé AVANT l'upload) ;
    //  2) le nettoyage (LiveKit + YouTube + archivage replay) peut dépasser
    //    le timeout client — si la fonction serverless mourait avant
    //    l'update DB, le live restait « LIVE » à jamais.
    // Désormais : statut ENDED + endedAt + reset pause POSÉS IMMÉDIATEMENT
    // (une seule écriture rapide) → viewers et studio voient l'arrêt
    // instantanément, et le /stop devient idempotent (un 2ᵉ appel ne
    // re-parcourt que du best-effort déjà protégé par try/catch).
    //
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
        endedAt: now,
        isPaused: false,
        pausedAt: null,
        // (V3.33) Si un recordingUrl est fourni dans l'appel (flux
        // historique), le persister — sans jamais ÉCRASER un replay déjà
        // posé par /api/live/[id]/recording avec null.
        ...(recordingUrl ? { recordingUrl } : {}),
      },
    });

    // ─── ⭐ V3.34 — ARCHIVER LE REPLAY IMMÉDIATEMENT, AVANT LE NETTOYAGE ───
    // Anomalie remontée par le pasteur : « la vidéo est bien enregistrée au
    // niveau de YouTube, mais on ne la voit pas dans Vidéos, et la récupération
    // auto de l'ID YouTube ne marche pas ». Cause racine : l'archivage avait
    // lieu APRÈS le nettoyage LiveKit (éjection des participants + arrêt des
    // egress + suppression de la room — facilement > 10 s) ; la fonction
    // serverless était tuée avant d'y arriver → l'entrée Vidéo (Replay)
    // n'était JAMAIS créée, alors que le statut ENDED (posé en premier)
    // laissait croire que l'arrêt avait parfaitement fonctionné. Désormais :
    //   1. l'entrée est créée TOUT DE SUITE (avec l'URL YouTube du broadcast
    //      Tier C pré-créé si connue — le cas nominal) ;
    //   2. le nettoyage LiveKit + la transition YouTube restent best-effort
    //      APRÈS ;
    //   3. si l'URL n'est pas (encore) connue, l'entrée est créée avec
    //      videoUrl null et la récupération différée (lib/live-replay-recovery,
    //      déclenchée à la consultation du module Vidéos) la remplira dès que
    //      YouTube publie le replay (30 s à 5 min après la fin du flux).
    const replayUrl = recordingUrl || live.youtubeUrl || null;
    const liveDate = new Date(live.startedAt || live.scheduledAt);
    const dateStr = liveDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    // ⭐ V3.26 — FIN DES DONNÉES FICTIVES sur le replay : compteurs à ZÉRO,
    // les vues et les likes ne s'accumulent que par les interactions réelles.
    try {
      // Vérifier si un replay existe déjà (éviter les doublons — le /stop est
      // idempotent, un 2ᵉ appel ne fait que mettre à jour cette entrée)
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
        // Mettre à jour le replay existant — URL/durée/miniature (les
        // compteurs ne sont JAMAIS écrasés : ils continuent de refléter les
        // interactions réelles sur la vidéo publiée).
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

    // ─── ⭐ V3.33/V3.34 — FINALISATION YOUTUBE (best-effort, APRÈS
    //     l'archivage qui a déjà eu lieu plus haut) ───
    // L'entrée Vidéo (Replay) est déjà créée/mise à jour ci-dessus avec le
    // statut ENDED. Ce qui suit ne fait qu'optimiser la finalisation côté
    // YouTube — un échec ici ne retire JAMAIS la vidéo du module Vidéos.
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
    // ⭐ V3.34 — YouTube met 30 s à 5 min à publier le replay après la fin
    // du flux : cette tentative instantanée échoue donc la plupart du temps.
    // Ce n'est plus un problème : la récupération DIFFÉRÉE
    // (lib/live-replay-recovery — déclenchée à la consultation du module
    // Vidéos) retentera automatiquement jusqu'à 60 fois (throttle 30 s).
    if (!recordingUrl && live.streamToYoutube && !youtubeReplayUrl) {
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
            // ⭐ V3.34 — persister sur le LiveStream ET sur l'entrée Vidéo
            // (Replay) déjà archivée plus haut (l'ancien code ne mettait à
            // jour que le LiveStream → la vidéo restait invisible dans le
            // module Vidéos même quand l'URL était récupérée ici).
            const { appliquerUrlReplaySurLiveEtVideo } = await import("@/lib/live-replay-recovery");
            await appliquerUrlReplaySurLiveEtVideo(liveId, ytResult.url);
            console.log(`[live/stop] YouTube replay récupéré: ${ytResult.url} (source: ${ytResult.source})`);
          } else {
            console.log("[live/stop] YouTube replay non trouvé — la récupération différée s'en chargera (module Vidéos)");
          }
        }
      } catch (ytError) {
        console.error("[live/stop] Erreur récupération YouTube replay:", ytError);
        // Ne pas faire échouer le stop pour autant
      }
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
