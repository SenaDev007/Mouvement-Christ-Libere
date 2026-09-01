import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getLiveKitConfig } from "@/lib/livekit-config";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/collaboration/token
 *
 * Génère un token LiveKit pour la collaboration temps réel sur un projet
 * de post-production. Tous les participants (admins authentifiés) peuvent
 * publier des données (DataChannel) pour synchroniser leur état.
 *
 * Body: { roomName: string, participantName: string }
 *
 * La room est namespaced "collab-{videoId}" pour isoler chaque projet.
 */

export async function POST(req: NextRequest) {
  // ⭐ V3.19 — clés lues au RUNTIME (bascule Plan B sans rebuild)
  const { apiKey: LIVEKIT_API_KEY, apiSecret: LIVEKIT_API_SECRET, url: LIVEKIT_URL } = getLiveKitConfig();
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { roomName, participantName } = await req.json();
    if (!roomName) {
      return NextResponse.json({ error: "roomName requis" }, { status: 400 });
    }

    // Extraire l'identity de la session admin
    let identity: string;
    try {
      const parts = sessionToken.split(".");
      const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      const userParts = data.user.split(":");
      identity = userParts[1] || `admin-${Date.now()}`;
    } catch {
      identity = `admin-${Date.now()}`;
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: participantName || "Éditeur",
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: false, // pas de vidéo/audio, juste DataChannel
      canSubscribe: true,
      canPublishData: true, // ← clé : permet la sync d'état via DataChannel
    });

    const token = await at.toJwt();
    const livekitUrl = LIVEKIT_URL;

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName,
    });
  } catch (error) {
    console.error("[collaboration/token] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
