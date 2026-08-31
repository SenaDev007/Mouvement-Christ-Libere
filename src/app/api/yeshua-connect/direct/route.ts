import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { RoomServiceClient } from "livekit-server-sdk";
import { ensureVoiceVideoColumns } from "@/lib/ensure-schema";

/**
 * ⭐ V3.1 — DIRECT AU SEIN D'UN CANAL VOCAL (PAS le module Live !).
 *
 * Clarification utilisateur : « Tu as mis le bouton "Lancer un direct" et
 * quand on clique ça dirige vers les lives. En fait ce n'est pas les mêmes
 * choses : ce direct, c'est un direct AU SEIN DU CANAL, et non un direct
 * live dans le module Live. »
 *
 * Ce route gère donc une diffusion qui vit DANS la room LiveKit
 * `yeshua-voice-<channelId>` du canal vocal :
 *   - POST { conversationId, action: "start" }  (admin)
 *       → les métadonnées de la room passent à { direct: true, directBy,
 *         directByAvatar, directAt } ; chaque participant CONNECTÉ reçoit
 *         RoomMetadataChanged instantanément (bandeau vert clignotant +
 *         photo du diffuseur, comme demandé en V2.9 mais SANS redirection).
 *   - POST { conversationId, action: "stop" }   (admin)
 *       → { direct: false } — la diffusion s'arrête pour tout le monde.
 *   - GET (tous, polling 10 s)
 *       → { directs: [{ channelId, by, byAvatar, at }] } — les canaux en
 *         direct, pour les membres NON connectés (badge vert sur la ligne
 *         du canal + bandeau « Rejoindre le direct » dans le panneau).
 *
 * Le « direct » diffusé = l'audio (et la vidéo si le canal est en mode
 * vidéo) du diffuseur dans la room du canal : tout membre qui rejoint
 * l'entend. Aucun RTMP, aucun module Live — tout reste intra-canal.
 *
 * Droits start/stop : rôle site (SUPER_ADMIN…ANIMATOR) OU rôle canal —
 * identiques à la bascule audio/vidéo (voice-mode).
 */

const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL ||
  process.env.LIVEKIT_URL ||
  "wss://christ-libere.livekit.cloud";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

const SITE_ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR", "ANIMATOR"]);
const CHANNEL_ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR", "ANIMATOR"]);

function roomService(): RoomServiceClient {
  return new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

/** Lit les métadonnées actuelles d'une room (null si absente). */
async function readRoomMetadata(roomName: string): Promise<string | null> {
  try {
    const rooms = await roomService().listRooms([roomName]);
    if (rooms && rooms.length > 0) return rooms[0].metadata ?? null;
  } catch {
    /* LiveKit indisponible → metadata null */
  }
  return null;
}

/** Pousse les métadonnées (crée la room si absente — comme voice-mode). */
async function pushRoomMetadata(roomName: string, metadata: string): Promise<boolean> {
  try {
    await roomService().updateRoomMetadata(roomName, metadata);
    return true;
  } catch {
    try {
      await roomService().createRoom({ name: roomName, metadata });
      return true;
    } catch (e) {
      console.error("[direct] push metadata impossible :", e instanceof Error ? e.message : e);
      return false;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
//  GET — canaux vocaux actuellement en direct (polling sidebar/panneau)
// ═════════════════════════════════════════════════════════════════════
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    let rooms: Array<{ name: string; metadata?: string }> = [];
    try {
      rooms = (await roomService().listRooms()) as Array<{ name: string; metadata?: string }>;
    } catch {
      return NextResponse.json({ directs: [] });
    }
    const directs: Array<{ channelId: string; by: string; byAvatar?: string; at?: number }> = [];
    for (const room of rooms || []) {
      if (!room?.name?.startsWith("yeshua-voice-")) continue;
      try {
        const meta = room.metadata ? JSON.parse(room.metadata) : null;
        if (meta?.direct) {
          directs.push({
            channelId: room.name.replace("yeshua-voice-", ""),
            by: typeof meta.directBy === "string" ? meta.directBy : "Membre",
            byAvatar: typeof meta.directByAvatar === "string" && meta.directByAvatar ? meta.directByAvatar : undefined,
            at: typeof meta.directAt === "number" ? meta.directAt : undefined,
          });
        }
      } catch { /* metadata non-JSON → ignore */ }
    }
    return NextResponse.json({ directs });
  } catch (error) {
    console.error("[direct GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// ═════════════════════════════════════════════════════════════════════
//  POST — start / stop (admin du site ou du canal)
// ═════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    // ( rôle parfois absent du typage NextAuth — cast, même pattern que voice-mode )
    const userRole = (session.user as { role?: string | null }).role;

    const body = await req.json().catch(() => ({}));
    const conversationId: string | undefined = body?.conversationId;
    const action: string = body?.action;
    if (!conversationId || (action !== "start" && action !== "stop")) {
      return NextResponse.json({ error: "conversationId + action (start|stop) requis" }, { status: 400 });
    }
    await ensureVoiceVideoColumns();

    // ─── Canal + vérifications ────────────────────────────────────────
    const channel = await db.channel.findUnique({
      where: { id: conversationId },
      select: { id: true, type: true, videoMode: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "Canal introuvable" }, { status: 404 });
    }
    if (channel.type !== "VOICE") {
      return NextResponse.json({ error: "Ce canal n'est pas un canal vocal" }, { status: 400 });
    }
    const membership = await db.channelMember.findUnique({
      where: { channelId_userId: { channelId: conversationId, userId } },
      select: { role: true },
    });
    const isChannelAdmin = CHANNEL_ADMIN_ROLES.has(membership?.role || "");
    const isSiteAdmin = SITE_ADMIN_ROLES.has(userRole || "");
    if (!isChannelAdmin && !isSiteAdmin) {
      return NextResponse.json(
        { error: "Seuls les administrateurs peuvent lancer/arrêter un direct dans le canal" },
        { status: 403 },
      );
    }

    // ─── Métadonnées : préserver le mode vidéo courant ────────────────
    const roomName = `yeshua-voice-${conversationId}`;
    let videoMode = channel.videoMode === true;
    const existing = await readRoomMetadata(roomName);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (typeof parsed?.videoMode === "boolean") videoMode = parsed.videoMode;
      } catch { /* garde la valeur DB */ }
    }

    let meta: Record<string, unknown>;
    if (action === "start") {
      const me = await db.user.findUnique({
        where: { id: userId },
        select: { name: true, avatarUrl: true },
      });
      meta = {
        videoMode,
        direct: true,
        directBy: me?.name || "Membre",
        directByAvatar: me?.avatarUrl ?? undefined,
        directAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else {
      meta = { videoMode, direct: false, updatedAt: Date.now() };
    }

    const pushed = await pushRoomMetadata(roomName, JSON.stringify(meta));
    return NextResponse.json({
      direct: action === "start",
      videoMode,
      by: meta.directBy,
      byAvatar: meta.directByAvatar,
      livekitPushed: pushed,
    });
  } catch (error) {
    console.error("[direct POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
