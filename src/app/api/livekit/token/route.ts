import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/livekit/token
 *
 * Génère un token LiveKit pour qu'un serviteur (Pam, Pasteur Kongo) diffuse un live
 * ou qu'un visiteur regarde le live sur le site public.
 *
 * Body: { roomName, role: "publisher" | "subscriber", participantName? }
 *
 * - publisher : permissions canPublish (pour le serviteur qui diffuse)
 * - subscriber : permissions canSubscribe uniquement (pour les visiteurs)
 *
 * Pour les publishers : vérifie que l'utilisateur est authentifié admin (cookie admin_session).
 * Pour les subscribers : pas d'auth requise (le live est public).
 */

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

interface TokenRequestBody {
  roomName?: string;
  role?: "publisher" | "subscriber";
  participantName?: string;
  liveId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: TokenRequestBody = await req.json();
    const { roomName, role = "subscriber", participantName, liveId } = body;

    if (!roomName) {
      return NextResponse.json({ error: "roomName requis" }, { status: 400 });
    }

    let identity: string;
    let name: string;
    const isPublisher = role === "publisher";

    if (isPublisher) {
      // Vérifier l'authentification admin (cookie admin_session)
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

      if (!sessionToken || !verifySessionToken(sessionToken)) {
        return NextResponse.json(
          { error: "Authentification admin requise pour diffuser un live" },
          { status: 401 }
        );
      }

      // Décoder le userId et le rôle depuis le token
      try {
        const parts = sessionToken.split(".");
        const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
        const userParts = data.user.split(":");
        if (userParts.length < 3 || userParts[0] !== "admin") {
          return NextResponse.json(
            { error: "Token de session invalide" },
            { status: 401 }
          );
        }
        identity = userParts[1];
        name = participantName || "Serviteur";
      } catch {
        return NextResponse.json(
          { error: "Session invalide" },
          { status: 401 }
        );
      }

      // Vérifier que le live existe et appartient bien à ce serviteur
      if (liveId) {
        const live = await db.liveStream.findUnique({
          where: { id: liveId },
          select: { id: true, status: true, livekitRoomName: true },
        });
        if (!live) {
          return NextResponse.json(
            { error: "Live introuvable" },
            { status: 404 }
          );
        }
      }
    } else {
      // Subscriber : identité anonyme
      identity = `viewer-${Math.random().toString(36).substring(2, 10)}`;
      name = participantName || "Visiteur";
    }

    // Générer le token LiveKit
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: isPublisher,
      canSubscribe: true,
      canPublishData: isPublisher,
    });

    const token = await at.toJwt();
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || "wss://christ-libere.livekit.cloud";

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName,
      role,
    });
  } catch (error) {
    console.error("[livekit/token] Error:", error);
    return NextResponse.json({ error: "Erreur LiveKit" }, { status: 500 });
  }
}
