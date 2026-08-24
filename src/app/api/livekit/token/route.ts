/**
 * API route — Génération de token LiveKit
 * POST /api/livekit/token
 *
 * Corps : { roomName, participantName, isModerator? }
 * Réponse : { token } ou { error }
 *
 * Nécessite les variables d'environnement :
 * - LIVEKIT_API_KEY
 * - LIVEKIT_API_SECRET
 *
 * Si LiveKit n'est pas configuré, renvoie un token de démo (mode hors ligne).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, participantName, isModerator = false } = body;

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: "roomName et participantName sont requis" },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    // Mode démo : LiveKit n'est pas configuré
    if (!apiKey || !apiSecret) {
      return NextResponse.json({
        token: null,
        demo: true,
        message: "LiveKit n'est pas configuré. Mode démo activé.",
      });
    }

    // En production : utiliser livekit-server-sdk pour générer le token
    // Pour l'instant, on importe dynamiquement pour éviter les erreurs en mode démo
    try {
      const { AccessToken } = await import("livekit-server-sdk");

      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantName,
        name: participantName,
      });

      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: true,
        roomAdmin: isModerator,
      });

      const token = await at.toJwt();
      return NextResponse.json({ token, demo: false });
    } catch {
      // livekit-server-sdk n'est pas installé — mode démo
      return NextResponse.json({
        token: null,
        demo: true,
        message: "livekit-server-sdk non installé. Mode démo activé.",
      });
    }
  } catch (error) {
    console.error("[api/livekit/token] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du token" },
      { status: 500 }
    );
  }
}
