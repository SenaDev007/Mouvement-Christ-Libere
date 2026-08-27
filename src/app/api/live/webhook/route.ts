import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/live/webhook
 *
 * Webhook LiveKit — reçoit les événements de la room (started, ended, recording available).
 * Utilisé pour archiver automatiquement les replays.
 *
 * LiveKit envoie des webhooks pour:
 * - room_started : room créée
 * - room_finished : room terminée (→ on archive le replay)
 * - egress_started : un egress RTMP a démarré
 * - egress_ended : un egress RTMP s'est terminé
 * - recording_available : l'enregistrement est disponible
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Vérifier le token d'authentification LiveKit (header Authorization)
    // En production, il faut vérifier la signature du webhook
    // Pour l'instant, on accepte les webhooks sans vérification (TODO)

    const event = body.event;
    const roomName = body.room?.name || body.roomName;

    if (!roomName) {
      return NextResponse.json({ error: "roomName manquant" }, { status: 400 });
    }

    console.log(`[live/webhook] Event: ${event}, Room: ${roomName}`);

    // Trouver le live correspondant
    const live = await db.liveStream.findFirst({
      where: { livekitRoomName: roomName },
      include: { servant: true },
    });

    if (!live) {
      console.log(`[live/webhook] Live non trouvé pour room ${roomName}`);
      return NextResponse.json({ success: true, ignored: true });
    }

    switch (event) {
      case "room_started":
        console.log(`[live/webhook] Room started for live ${live.id}`);
        break;

      case "room_finished":
        console.log(`[live/webhook] Room finished for live ${live.id}`);
        // Si le live est encore en statut LIVE, le passer en ENDED
        if (live.status === "LIVE") {
          await db.liveStream.update({
            where: { id: live.id },
            data: {
              status: "ENDED",
              endedAt: new Date(),
            },
          });
        }
        break;

      case "recording_available":
        console.log(`[live/webhook] Recording available for live ${live.id}`);
        // L'URL du recording est dans body.recording.url ou similaire
        const recordingUrl = body.recording?.url || body.file?.url;
        if (recordingUrl) {
          await db.liveStream.update({
            where: { id: live.id },
            data: { recordingUrl },
          });

          // Créer une entrée Video pour le replay
          await db.video.create({
            data: {
              servantId: live.servantId,
              title: `${live.title} (Replay)`,
              description: `Replay du live du ${new Date(live.startedAt || live.scheduledAt).toLocaleDateString("fr-FR")} — ${live.description || ""}`,
              duration: "",
              views: 0,
              isLive: false,
              videoUrl: recordingUrl,
              publishedAt: new Date(),
            },
          });
          console.log(`[live/webhook] Replay archivé pour le live ${live.id}`);
        }
        break;

      case "egress_started":
        console.log(`[live/webhook] Egress started: ${body.egressId}`);
        break;

      case "egress_ended":
        console.log(`[live/webhook] Egress ended: ${body.egressId}`);
        break;

      default:
        console.log(`[live/webhook] Unhandled event: ${event}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[live/webhook] Error:", error);
    return NextResponse.json({ error: "Erreur webhook" }, { status: 500 });
  }
}
