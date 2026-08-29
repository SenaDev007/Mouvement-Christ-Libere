import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * GET /api/live/[id]/ingress
 *
 * Retourne les informations RTMP pour un encodeur externe (OBS).
 * Nécessite une authentification admin.
 */
export async function GET(
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
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    const roomName = (live as Record<string, unknown>).livekitRoomName as string || `live-${id}`;
    const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://christ-libere.livekit.cloud";

    // RTMP URL for OBS — LiveKit accepte les connexions RTMP
    // Format: rtmp://{host}/{roomName}
    const rtmpHost = livekitUrl
      .replace("wss://", "")
      .replace("ws://", "")
      .replace("https://", "")
      .replace("http://", "");
    const rtmpUrl = `rtmp://${rtmpHost}/${roomName}`;

    // Stream key — basée sur le liveId (sera validée par LiveKit)
    const streamKey = `live-${id}`;

    return NextResponse.json({
      roomName,
      rtmpUrl,
      streamKey,
      livekitUrl,
      obsInstructions: [
        "1. Ouvrez OBS Studio",
        "2. Paramètres → Stream",
        "3. Type de service: Personnalisé",
        `4. URL du serveur: ${rtmpUrl}`,
        `5. Clé de stream: ${streamKey}`,
        "6. Cliquez 'Démarrer le streaming' dans OBS",
        "7. Revenez ici et cliquez 'Go Live' — le studio recevra votre flux OBS",
      ],
    });
  } catch (error) {
    console.error("[ingress] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
