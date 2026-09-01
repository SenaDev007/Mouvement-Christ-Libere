import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { IngressClient, IngressInput } from "livekit-server-sdk";
import { getLiveKitConfig } from "@/lib/livekit-config";

/**
 * GET /api/live/[id]/ingress
 *
 * Retourne les informations RTMP pour un encodeur externe (OBS).
 * Nécessite une authentification admin.
 *
 * FIX C3 : on crée désormais un vrai Ingress LiveKit (RTMP_INPUT) côté serveur
 *          au lieu de fabriquer une URL `rtmp://{host}/{roomName}` qui n'était
 *          pas validée par LiveKit et ne fonctionnait pas. On retourne
 *          `info.url` + `info.streamKey` fournis par LiveKit.
 */

/**
 * Convertit l'URL WebSocket/HTTP LiveKit en URL HTTP(S) attendue par
 * IngressClient (qui attend `https://<project>.livekit.cloud`).
 */
function livekitHttpUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ⭐ V3.19 — clés lues au RUNTIME (bascule Plan B sans rebuild)
  const { url: LIVEKIT_URL, apiKey: LIVEKIT_API_KEY, apiSecret: LIVEKIT_API_SECRET } = getLiveKitConfig();
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const live = await db.liveStream.findUnique({
      where: { id },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    const roomName =
      (live as Record<string, unknown>).livekitRoomName as string | undefined || `live-${id}`;

    // FIX C3 : créer un véritable Ingress RTMP via le SDK LiveKit.
    // - IngressClient existe dans livekit-server-sdk (v2.18+).
    // - IngressInput.RTMP_INPUT est ré-exporté depuis `livekit-server-sdk`.
    // - `participantIdentity` est obligatoire selon CreateIngressOptions.
    const ingressClient = new IngressClient(
      livekitHttpUrl(LIVEKIT_URL),
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    const info = await ingressClient.createIngress(IngressInput.RTMP_INPUT, {
      name: `live-${id}`,
      roomName,
      participantIdentity: `obs-${id}`,
      participantName: `OBS Studio (live ${id})`,
      // RTMP nécessite le transcoding (re-encodage) côté LiveKit.
      enableTranscoding: true,
    });

    return NextResponse.json({
      roomName,
      rtmpUrl: info.url,
      streamKey: info.streamKey,
      ingressId: info.ingressId,
      livekitUrl: LIVEKIT_URL,
      obsInstructions: [
        "1. Ouvrez OBS Studio",
        "2. Paramètres → Stream",
        "3. Type de service: Personnalisé",
        `4. URL du serveur: ${info.url}`,
        `5. Clé de stream: ${info.streamKey}`,
        "6. Cliquez 'Démarrer le Streaming' dans OBS",
        "7. Revenez ici et cliquez 'Go Live' — le studio recevra votre flux OBS",
      ],
    });
  } catch (error) {
    console.error("[ingress] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur",
      },
      { status: 500 }
    );
  }
}
