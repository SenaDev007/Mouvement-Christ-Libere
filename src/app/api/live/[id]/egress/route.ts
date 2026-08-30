import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  EgressClient,
  RoomServiceClient,
  StreamOutput,
  TrackType,
} from "livekit-server-sdk";

/**
 * POST /api/live/[id]/egress
 *
 * Démarre le multistreaming RTMP vers YouTube/Facebook/TikTok/Instagram.
 * Doit être appelé APRÈS que le studio s'est connecté à LiveKit et publie un track.
 *
 * FIX H2 : on utilise startTrackCompositeEgress (forward des tracks publiés
 *          par le studio — typiquement le canvas composite + micro) au lieu de
 *          startRoomCompositeEgress qui injectait un layout "speaker" inutile
 *          et recompositait toute la room.
 * FIX H3 : on neutralise un éventuel slash final dans l'URL RTMP saisie par
 *          l'admin pour éviter le double slash `rtmp://host//clé`.
 *
 * Body: { } (utilise les clés RTMP configurées sur le serviteur)
 */

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || "wss://christ-libere.livekit.cloud";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

/**
 * Convertit l'URL WebSocket/HTTP LiveKit en URL HTTP(S) attendue par les
 * clients server-sdk (EgressClient, RoomServiceClient).
 */
function livekitHttpUrl(): string {
  const url = LIVEKIT_URL.trim();
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url; // déjà http(s)://
}

/**
 * Retire un éventuel slash final pour éviter `rtmp://host//clé` (H3).
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Résout les track SIDs (audio + vidéo) à forwarder vers l'egress.
 *
 * Le studio publie :
 *   - un track vidéo nommé "composite" (canvas CanvasCaptureStream)
 *   - un track micro (source Microphone)
 *   - (optionnel) un track caméra
 *
 * On retourne le SID du track vidéo "composite" (ou à défaut le premier track
 * vidéo publié) et le SID du premier track audio publié.
 */
async function resolveCompositeTrackIds(
  roomService: RoomServiceClient,
  roomName: string
): Promise<{ audioTrackId?: string; videoTrackId?: string; diagnostic: string[] }> {
  const diagnostic: string[] = [];
  let audioTrackId: string | undefined;
  let videoTrackId: string | undefined;

  let participants;
  try {
    participants = await roomService.listParticipants(roomName);
  } catch (err) {
    diagnostic.push(
      `listParticipants a échoué : ${err instanceof Error ? err.message : String(err)}`
    );
    return { audioTrackId, videoTrackId, diagnostic };
  }

  diagnostic.push(`${participants.length} participant(s) dans la room "${roomName}"`);

  for (const p of participants) {
    for (const t of p.tracks) {
      const isVideo = t.type === TrackType.VIDEO;
      const isAudio = t.type === TrackType.AUDIO;
      diagnostic.push(`  - participant=${p.identity} track name="${t.name}" sid=${t.sid} type=${t.type}`);

      // Priorité au track "composite" publié par le studio
      if (isVideo && t.name === "composite" && !videoTrackId) {
        videoTrackId = t.sid;
      }
      if (isAudio && !audioTrackId) {
        audioTrackId = t.sid;
      }
    }
  }

  // Fallback : si pas de track "composite", prendre n'importe quel track vidéo
  if (!videoTrackId) {
    for (const p of participants) {
      for (const t of p.tracks) {
        if (t.type === TrackType.VIDEO) {
          videoTrackId = t.sid;
          diagnostic.push(`  - fallback vidéo : track "${t.name}" (${t.sid})`);
          break;
        }
      }
      if (videoTrackId) break;
    }
  }

  return { audioTrackId, videoTrackId, diagnostic };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const live = await db.liveStream.findUnique({
      where: { id },
      include: {
        servant: { include: { streamConfig: true } },
      },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    const roomName = (live as Record<string, unknown>).livekitRoomName as string || `live-${id}`;

    if (!live.multistreamEnabled || !live.servant.streamConfig) {
      return NextResponse.json({ error: "Multistreaming non configuré" }, { status: 400 });
    }

    const config = live.servant.streamConfig;
    const destinations: { url: string; name: string }[] = [];

    const streamToYoutube = (live as Record<string, unknown>).streamToYoutube as boolean;
    const streamToFacebook = (live as Record<string, unknown>).streamToFacebook as boolean;
    const streamToTiktok = (live as Record<string, unknown>).streamToTiktok as boolean;
    const streamToInstagram = (live as Record<string, unknown>).streamToInstagram as boolean;

    // FIX H3 : on neutralise le slash final de l'URL RTMP avant de concaténer la clé
    if (streamToYoutube && config.youtubeRtmpUrl && config.youtubeRtmpKey) {
      destinations.push({
        url: `${stripTrailingSlash(config.youtubeRtmpUrl)}/${config.youtubeRtmpKey}`,
        name: "youtube",
      });
    }
    if (streamToFacebook && config.facebookRtmpUrl && config.facebookRtmpKey) {
      destinations.push({
        url: `${stripTrailingSlash(config.facebookRtmpUrl)}/${config.facebookRtmpKey}`,
        name: "facebook",
      });
    }
    if (streamToTiktok && config.tiktokRtmpUrl && config.tiktokRtmpKey) {
      destinations.push({
        url: `${stripTrailingSlash(config.tiktokRtmpUrl)}/${config.tiktokRtmpKey}`,
        name: "tiktok",
      });
    }
    if (streamToInstagram && config.instagramRtmpUrl && config.instagramRtmpKey) {
      destinations.push({
        url: `${stripTrailingSlash(config.instagramRtmpUrl)}/${config.instagramRtmpKey}`,
        name: "instagram",
      });
    }

    if (destinations.length === 0) {
      // Diagnoser pourquoi aucune destination n'est configurée
      const diag: string[] = [];
      if (streamToYoutube) {
        diag.push(`YouTube: RTMP URL=${config.youtubeRtmpUrl ? "✓" : "✗ (manquant)"}, Key=${config.youtubeRtmpKey ? "✓" : "✗ (manquant)"}`);
      } else { diag.push("YouTube: non activé sur ce live"); }
      if (streamToFacebook) {
        diag.push(`Facebook: RTMP URL=${config.facebookRtmpUrl ? "✓" : "✗"}, Key=${config.facebookRtmpKey ? "✓" : "✗"}`);
      }
      if (streamToTiktok) {
        diag.push(`TikTok: RTMP URL=${config.tiktokRtmpUrl ? "✓" : "✗"}, Key=${config.tiktokRtmpKey ? "✓" : "✗"}`);
      }
      if (streamToInstagram) {
        diag.push(`Instagram: RTMP URL=${config.instagramRtmpUrl ? "✓" : "✗"}, Key=${config.instagramRtmpKey ? "✓" : "✗"}`);
      }
      return NextResponse.json({
        error: "Aucune destination RTMP configurée",
        diagnostic: diag,
        multistreamEnabled: live.multistreamEnabled,
        streamConfigExists: !!live.servant.streamConfig,
      }, { status: 400 });
    }

    const httpHost = livekitHttpUrl();
    const roomService = new RoomServiceClient(httpHost, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // FIX H2 : résoudre les track SIDs publiés par le studio (canvas composite + micro)
    // pour pouvoir utiliser startTrackCompositeEgress (sans layout composite).
    const { audioTrackId, videoTrackId, diagnostic: trackDiag } =
      await resolveCompositeTrackIds(roomService, roomName);

    if (!videoTrackId && !audioTrackId) {
      return NextResponse.json({
        error: "Aucun track publié dans la room — démarrez d'abord le studio LiveKit avant de lancer le multistreaming.",
        diagnostic: trackDiag,
      }, { status: 400 });
    }

    // Démarrer les egress RTMP (forward des tracks sans recomposite layout)
    const egressClient = new EgressClient(httpHost, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const results: { name: string; egressId: string | null; error?: string }[] = [];

    for (const dest of destinations) {
      try {
        const streamOutput = new StreamOutput({ urls: [dest.url] });
        const egressInfo = await egressClient.startTrackCompositeEgress(
          roomName,
          streamOutput,
          {
            audioTrackId,
            videoTrackId,
          }
        );
        const egressId = egressInfo.egressId || null;
        results.push({ name: dest.name, egressId });
        console.log(`[egress] RTMP started for ${dest.name}: ${egressId}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
        results.push({ name: dest.name, egressId: null, error: errMsg });
        console.error(`[egress] Failed for ${dest.name}:`, errMsg);
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalStarted: results.filter((r) => r.egressId).length,
      totalFailed: results.filter((r) => !r.egressId).length,
      trackDiagnostic: trackDiag,
      audioTrackId,
      videoTrackId,
    });
  } catch (error) {
    console.error("[egress] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
