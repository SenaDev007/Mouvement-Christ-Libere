import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { auth as nextAuth } from "@/auth";

/**
 * POST /api/livekit/token
 *
 * Génère un token LiveKit pour qu'un serviteur (Pam, Pasteur Kongo) diffuse un live,
 * qu'un visiteur regarde le live sur le site public, OU qu'un utilisateur authentifié
 * Yeshua Connect initie/rejoigne un appel audio/vidéo ou un canal vocal persistant.
 *
 * Body: { roomName, role: "publisher" | "subscriber", participantName?, liveId? }
 *
 * - publisher : permissions canPublish (pour le serviteur qui diffuse, ou l'appelant Yeshua)
 * - subscriber : permissions canSubscribe uniquement (pour les visiteurs)
 *
 * Authentification publisher :
 *   1) Admin session (cookie admin_session) — pour les lives studio
 *   2) NextAuth session — pour les appels Yeshua Connect quand roomName commence
 *      par "yeshua-call-" ou "yeshua-voice-". Ce namespacing empêche un utilisateur
 *      Yeshua de publier dans une room de live studio.
 *
 * Pour les subscribers : pas d'auth requise (le live est public).
 */

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

/** Préfixes de rooms réservés aux appels / canaux vocaux Yeshua Connect. */
const YESHUA_ROOM_PREFIXES = ["yeshua-call-", "yeshua-voice-"];

function isYeshuaRoom(roomName: string): boolean {
  return YESHUA_ROOM_PREFIXES.some((p) => roomName.startsWith(p));
}

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
    const yeshuaRoom = isYeshuaRoom(roomName);

    if (isPublisher) {
      // ─── Publisher : deux chemins d'authentification possibles ───────
      // 1) Admin session (cookie admin_session) — pour les lives studio
      // 2) NextAuth session — pour les appels Yeshua Connect (room namespaced)
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      const adminSessionValid =
        !!sessionToken && verifySessionToken(sessionToken);

      if (adminSessionValid) {
        // Admin authentifié (serviteur / studio live)
        try {
          const parts = sessionToken!.split(".");
          const data = JSON.parse(
            Buffer.from(parts[0], "base64url").toString(),
          );
          const userParts = data.user.split(":");
          if (userParts.length < 3 || userParts[0] !== "admin") {
            return NextResponse.json(
              { error: "Token de session invalide" },
              { status: 401 },
            );
          }
          identity = userParts[1];
          name = participantName || "Serviteur";
        } catch {
          return NextResponse.json(
            { error: "Session invalide" },
            { status: 401 },
          );
        }

        // Vérifier que le live existe (uniquement si liveId fourni)
        if (liveId) {
          const live = await db.liveStream.findUnique({
            where: { id: liveId },
            select: { id: true, status: true, livekitRoomName: true },
          });
          if (!live) {
            return NextResponse.json(
              { error: "Live introuvable" },
              { status: 404 },
            );
          }
        }
      } else if (yeshuaRoom) {
        // NextAuth session pour les appels Yeshua Connect
        const session = await nextAuth();
        if (!session?.user?.id) {
          return NextResponse.json(
            { error: "Authentification requise pour l'appel" },
            { status: 401 },
          );
        }
        identity = session.user.id;
        name = participantName || session.user.name || "Membre";
      } else {
        // Pas d'authentification valide pour un publisher hors Yeshua
        return NextResponse.json(
          {
            error:
              "Authentification admin ou NextAuth requise pour publier (room non-Yeshua)",
          },
          { status: 401 },
        );
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
    const livekitUrl =
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      process.env.LIVEKIT_URL ||
      "wss://christ-libere.livekit.cloud";

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

