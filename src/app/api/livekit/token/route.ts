import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { ensureVoiceVideoColumns } from "@/lib/ensure-schema";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { auth as nextAuth } from "@/auth";
import { getLiveKitConfig } from "@/lib/livekit-config";

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
  /** ⭐ V2.7 — Avatar (photo réelle) du participant, injectée dans les
   * métadonnées du token : chaque client Yeshua Connect peut ensuite lire
   * `participant.metadata` pour afficher la photo dans les canaux vocaux. */
  avatarUrl?: string | null;
}

export async function POST(req: NextRequest) {
  // ⭐ V3.19 — clés lues au RUNTIME (bascule Plan B sans rebuild) :
  // LIVEKIT_URL prioritaire sur NEXT_PUBLIC_LIVEKIT_URL (build) pour que
  // la bascule Plan B (3 variables Vercel) prenne effet immédiatement.
  const { apiKey: LIVEKIT_API_KEY, apiSecret: LIVEKIT_API_SECRET, url: LIVEKIT_URL } = getLiveKitConfig();
  try {
    const body: TokenRequestBody = await req.json();
    const { roomName, role = "subscriber", participantName, liveId, avatarUrl: avatarUrlFromBody } = body;

    if (!roomName) {
      return NextResponse.json({ error: "roomName requis" }, { status: 400 });
    }

    let identity: string;
    let name: string;
    // ⭐ V2.7 — Métadonnées participant (JSON sérialisé) : photo de profil,
    // lue par les autres clients pour afficher l'avatar réel.
    let participantMetadata: string | undefined;
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

        // ⭐ V2.7 — Photo de profil réelle : priorité à l'avatar fourni par le
        // client, sinon on lit User.avatarUrl (photos de Pam, Pasteur Kongo,
        // membres…) pour l'embarquer dans les métadonnées du participant.
        let avatarUrl = avatarUrlFromBody ?? null;
        if (!avatarUrl) {
          try {
            const user = await db.user.findUnique({
              where: { id: session.user.id },
              select: { avatarUrl: true },
            });
            avatarUrl = user?.avatarUrl ?? null;
          } catch {
            // avatar optionnel — pas bloquant pour le token
          }
        }
        participantMetadata = JSON.stringify({ avatarUrl });
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
      ...(participantMetadata ? { metadata: participantMetadata } : {}),
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: isPublisher,
      canSubscribe: true,
      canPublishData: isPublisher,
    });

    const token = await at.toJwt();
    // ⭐ V3.19 — LIVEKIT_URL (runtime) prioritaire sur NEXT_PUBLIC (build)
    const livekitUrl = LIVEKIT_URL;

    // ⭐ V2.7 — Mode audio/vidéo du canal vocal (persisté en base) : servi au
    // client au moment du join pour qu'il connaisse le mode AVANT même de
    // lire les métadonnées de la room (room fraîchement créée, metadata
    // éventuellement absente). Les bascules en cours d'appel arrivent ensuite
    // en temps réel via RoomMetadataChanged.
    let videoMode = false;
    if (roomName?.startsWith("yeshua-voice-")) {
      try {
        await ensureVoiceVideoColumns();
        const channelId = roomName.slice("yeshua-voice-".length);
        const channel = await db.channel.findUnique({
          where: { id: channelId },
          select: { videoMode: true },
        });
        videoMode = channel?.videoMode ?? false;
      } catch {
        // best effort — mode audio par défaut
      }
    }

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName,
      role,
      videoMode,
    });
  } catch (error) {
    console.error("[livekit/token] Error:", error);
    return NextResponse.json({ error: "Erreur LiveKit" }, { status: 500 });
  }
}

