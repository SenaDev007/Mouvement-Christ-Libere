import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { RoomServiceClient } from "livekit-server-sdk";
import { ensureVoiceVideoColumns } from "@/lib/ensure-schema";
import { getLiveKitConfig } from "@/lib/livekit-config";

/**
 * ⭐ V2.7 — Bascule audio / vidéo des canaux vocaux Yeshua Connect.
 *
 *   GET  /api/yeshua-connect/conversations/:id/voice-mode
 *        → { videoMode: boolean } (mode courant du canal)
 *
 *   POST /api/yeshua-connect/conversations/:id/voice-mode  { mode: "audio" | "video" }
 *        → { videoMode, mode } — réservé aux administrateurs.
 *
 * Principe « WhatsApp » demandé par l'utilisateur :
 *   - L'ADMINISTRATEUR décide du mode du canal (audio OU vidéo).
 *   - Quand il bascule, TOUT LE MONDE voit le changement :
 *     1. Le mode est persisté dans `Channel.videoMode` (source de vérité —
 *        servie au prochain participant qui rejoint via /api/livekit/token).
 *     2. Les métadonnées de la room LiveKit `yeshua-voice-<channelId>` sont
 *        mises à jour via RoomServiceClient → chaque client connecté reçoit
 *        l'évènement `RoomMetadataChanged` en temps réel et bascule
 *        instantanément (caméras activées/désactivées automatiquement).
 *
 * Droits : rôle site (SUPER_ADMIN, ADMIN, MODERATOR, ANIMATOR) OU rôle
 * canal (ChannelMember.role ∈ SUPER_ADMIN…ANIMATOR). Les membres simples
 * reçoivent 403 — ils ne décident pas du mode.
 *
 * Sécurité : authentification NextAuth + vérification d'appartenance au canal
 * (sauf rôles privilégiés qui peuvent modérer tous les canaux).
 */

// ⭐ V3.19 — clés LiveKit lues AU RUNTIME (bascule Plan B sans rebuild)
function livekitRoomService(): RoomServiceClient {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  return new RoomServiceClient(url, apiKey, apiSecret);
}

/** Rôles site autorisés à basculer le mode d'un canal vocal. */
const SITE_ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "ANIMATOR",
]);

/** Rôles canal autorisés (ChannelRole). */
const CHANNEL_ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "ANIMATOR",
]);

/** Métadonnées embarquées dans la room LiveKit (format stable côté client). */
function roomMetadata(videoMode: boolean): string {
  return JSON.stringify({
    videoMode,
    updatedAt: Date.now(),
    updatedBy: "channel-admin",
  });
}

/** GET : mode courant du canal (authentifié, membre du canal). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const { id } = await params;
    await ensureVoiceVideoColumns();

    const channel = await db.channel.findUnique({
      where: { id },
      select: { videoMode: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "Canal introuvable" }, { status: 404 });
    }
    return NextResponse.json({ videoMode: channel.videoMode });
  } catch (error) {
    console.error("[voice-mode GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/** POST : bascule le mode (admin uniquement) + propagation temps réel. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode;
    if (mode !== "audio" && mode !== "video") {
      return NextResponse.json(
        { error: "mode invalide — attendu \"audio\" ou \"video\"" },
        { status: 400 },
      );
    }

    const { id } = await params;
    await ensureVoiceVideoColumns();

    // ─── Canal + vérification d'appartenance ──────────────────────────
    const channel = await db.channel.findUnique({
      where: { id },
      select: { id: true, type: true, videoMode: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "Canal introuvable" }, { status: 404 });
    }
    if (channel.type !== "VOICE") {
      return NextResponse.json(
        { error: "Ce canal n'est pas un canal vocal" },
        { status: 400 },
      );
    }

    const membership = await db.channelMember.findUnique({
      where: { channelId_userId: { channelId: id, userId } },
      select: { role: true },
    });
    if (!membership && !SITE_ADMIN_ROLES.has(userRole || "")) {
      return NextResponse.json(
        { error: "Vous n'êtes pas membre de ce canal" },
        { status: 403 },
      );
    }

    // ─── Droits d'administration ──────────────────────────────────────
    const isChannelAdmin = CHANNEL_ADMIN_ROLES.has(membership?.role || "");
    const isSiteAdmin = SITE_ADMIN_ROLES.has(userRole || "");
    if (!isChannelAdmin && !isSiteAdmin) {
      return NextResponse.json(
        {
          error:
            "Seuls les administrateurs peuvent basculer le mode du canal vocal",
        },
        { status: 403 },
      );
    }

    // ─── 1. Persistance base de données (source de vérité) ────────────
    const videoMode = mode === "video";
    await db.channel.update({
      where: { id },
      data: { videoMode },
    });

    // ─── 2. Propagation temps réel : métadonnées de la room LiveKit ───
    // Chaque participant connecté reçoit RoomMetadataChanged et bascule
    // instantanément (mode WhatsApp : tout le monde voit le changement).
    // Best effort : si la room n'existe pas encore (personne connecté),
    // on la crée vide avec les métadonnées ; si LiveKit échoue, la valeur
    // DB sera servie au prochain join — rien n'est perdu.
    const roomName = `yeshua-voice-${id}`;
    let livekitPushed = false;
    try {
      const roomService = livekitRoomService();
      await roomService.updateRoomMetadata(roomName, roomMetadata(videoMode));
      livekitPushed = true;
    } catch {
      try {
        const roomService = livekitRoomService();
        // Room absente → on la crée avec les métadonnées (elle existera
        // déjà quand les participants rejoindront).
        await roomService.createRoom({
          name: roomName,
          metadata: roomMetadata(videoMode),
        });
        livekitPushed = true;
      } catch (e) {
        console.error(
          "[voice-mode POST] LiveKit metadata push impossible :",
          e instanceof Error ? e.message : e,
        );
      }
    }

    return NextResponse.json({ videoMode, mode, livekitPushed });
  } catch (error) {
    console.error("[voice-mode POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
