import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles pouvant voir tous les canaux (y compris RESTRICTED). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * GET /api/yeshua-connect/channels
 * List all channels (for create conversation / forward target).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 Les canaux RESTRICTED ne sont retournés qu'aux rôles privilégiés.
 */
export async function GET() {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userRole = session.user.role;
    const canSeeRestricted = PRIVILEGED_ROLES.has(userRole || "");

    const channels = await db.channel.findMany({
      where: canSeeRestricted
        ? {}
        : { isRestricted: false, type: { not: "RESTRICTED" } },
      orderBy: [{ communityId: "asc" }, { order: "asc" }],
      include: {
        community: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    return NextResponse.json(channels);
  } catch (error) {
    console.error("[yeshua-connect/channels] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * POST /api/yeshua-connect/channels
 * Create a new channel (group/broadcast).
 * Body: { name, description?, type, communityId, isEncrypted? }  ← createdBy vient de la session.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 Le créateur (depuis la session) est ajouté comme ADMIN du canal.
 */
export async function POST(req: Request) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;

    const { name, description, type = "TEXT", communityId, isEncrypted = false } =
      await req.json();
    if (!name || !communityId) {
      return NextResponse.json({ error: "name et communityId requis" }, { status: 400 });
    }

    const channel = await db.channel.create({
      data: {
        name,
        description,
        type,
        communityId,
        isEncrypted,
        order: 0,
      },
    });

    // Add creator (from session) as first member with ADMIN role
    await db.channelMember.create({
      data: { channelId: channel.id, userId, role: "ADMIN" },
    });

    // ⭐ V2.3 — Audit log : tracer la création du canal.
    try {
      await db.auditLog.create({
        data: {
          action: "CHANNEL_CREATE",
          userId,
          targetId: channel.id,
          channelId: channel.id,
          metadata: {
            name,
            description: description ?? null,
            type,
            communityId,
            isEncrypted,
          },
        },
      });
    } catch (e) {
      console.error("[audit-log/channel-create] Error:", e);
    }

    return NextResponse.json(channel);
  } catch (error) {
    console.error("[yeshua-connect/channels POST] Error:", error);
    return NextResponse.json({ error: "Erreur de création" }, { status: 500 });
  }
}
