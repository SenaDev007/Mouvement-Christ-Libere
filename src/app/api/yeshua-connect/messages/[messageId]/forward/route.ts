import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles pouvant forwarder dans tous les canaux (modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * POST /api/yeshua-connect/messages/:messageId/forward
 * Transfère un message existant vers un autre canal.
 * Body: { targetChannelId }  ← userId vient de la session.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal cible (targetChannelId)
 *   pour pouvoir y poster le message transféré (ou rôle privilégié).
 * - 🔒 userId est forcé depuis la session (ignore req.body.userId).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;

    const { messageId } = await params;
    const { targetChannelId } = await req.json();
    if (!targetChannelId) {
      return NextResponse.json(
        { error: "targetChannelId requis" },
        { status: 400 },
      );
    }

    // 🔒 Vérifier que l'utilisateur est membre du canal CIBLE (sauf privilégiés)
    if (!PRIVILEGED_ROLES.has(userRole || "")) {
      const membership = await db.channelMember.findUnique({
        where: {
          channelId_userId: { channelId: targetChannelId, userId },
        },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Vous n'êtes pas membre du canal cible" },
          { status: 403 },
        );
      }
    }

    const original = await db.message.findUnique({ where: { id: messageId } });
    if (!original) {
      return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    }

    // 🔒 userId vient de la session, pas du body
    const forwarded = await db.message.create({
      data: {
        channelId: targetChannelId,
        userId,
        content: original.content,
        type: original.type,
        attachmentUrl: original.attachmentUrl,
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json({
      id: forwarded.id,
      conversationId: forwarded.channelId,
      senderId: forwarded.userId,
      senderName: forwarded.user.name ?? "Membre",
      senderRole: forwarded.user.role,
      type: forwarded.type,
      content: forwarded.content,
      reactions: [],
      createdAt: forwarded.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/forward] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
