import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@/lib/db";

/**
 * POST /api/livekit/token
 *
 * Issues a LiveKit access token for the authenticated user to join a room.
 * Body: { roomName, isUrgent? }
 *
 * The token grants the user publish + subscribe permissions.
 * For urgent calls, the DND preference is bypassed.
 *
 * Env vars required:
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 *   LIVEKIT_URL  (e.g. wss://christ-libere.livekit.cloud)
 */

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { roomName, isUrgent = false } = await req.json();
    if (!roomName) {
      return NextResponse.json({ error: "roomName requis" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, dndEnabled: true, dndUntil: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Check DND — bypass if urgent
    if (!isUrgent && user.dndEnabled) {
      const now = new Date();
      if (!user.dndUntil || new Date(user.dndUntil) > now) {
        return NextResponse.json({
          error: "Le destinataire est en mode Ne pas déranger",
          dndActive: true,
        }, { status: 403 });
      }
    }

    // Generate LiveKit token
    const participantName = user.name || session.user.email || "Membre";
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user.id,
      name: participantName,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    const livekitUrl = process.env.LIVEKIT_URL || "wss://christ-libere.livekit.cloud";

    // Log the call in the database
    await db.call.create({
      data: {
        initiatorId: user.id,
        recipientId: user.id, // TODO: get recipient from roomName
        type: "AUDIO", // TODO: pass as param
        status: "MISSED",
      },
    });

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName,
    });
  } catch (error) {
    console.error("[livekit/token] Error:", error);
    return NextResponse.json({ error: "Erreur LiveKit" }, { status: 500 });
  }
}
