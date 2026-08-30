import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles pouvant épingler dans tous les canaux (modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * POST /api/yeshua-connect/messages/:messageId/pin
 * Épingle / désépingler un message dans un canal (toggle).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal du message (ou rôle privilégié).
 *
 * Comportement toggle (V2.1) :
 *   - Si le message n'est pas épinglé → isPinned=true, pinnedAt=now(), pinnedBy=userId.
 *   - Si le message est déjà épinglé → isPinned=false, pinnedAt=null, pinnedBy=null.
 */
export async function POST(
  _req: NextRequest,
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

    const message = await db.message.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true, isPinned: true },
    });
    if (!message) {
      return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    }

    // 🔒 Vérifier que l'utilisateur est membre du canal du message (sauf privilégiés)
    if (!PRIVILEGED_ROLES.has(userRole || "")) {
      const membership = await db.channelMember.findUnique({
        where: {
          channelId_userId: { channelId: message.channelId, userId },
        },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Vous n'êtes pas membre de ce canal" },
          { status: 403 },
        );
      }
    }

    // ⭐ V2.1 — Toggle l'état épinglé.
    const newPinnedState = !message.isPinned;
    const updated = await db.message.update({
      where: { id: messageId },
      data: newPinnedState
        ? {
            isPinned: true,
            pinnedAt: new Date(),
            pinnedBy: userId,
          }
        : {
            isPinned: false,
            pinnedAt: null,
            pinnedBy: null,
          },
      select: {
        id: true,
        isPinned: true,
        pinnedAt: true,
        pinnedBy: true,
      },
    });

    // ⭐ V2.3 — Audit log : tracer l'épinglage / désépinglage du message.
    try {
      await db.auditLog.create({
        data: {
          action: newPinnedState ? "MESSAGE_PIN" : "MESSAGE_UNPIN",
          userId,
          targetId: messageId,
          channelId: message.channelId,
          metadata: {
            isPinned: newPinnedState,
            pinnedAt: updated.pinnedAt?.toISOString() ?? null,
          },
        },
      });
    } catch (e) {
      console.error("[audit-log/pin] Error:", e);
    }

    return NextResponse.json({
      success: true,
      messageId: updated.id,
      isPinned: updated.isPinned,
      pinnedAt: updated.pinnedAt?.toISOString() ?? null,
      pinnedBy: updated.pinnedBy ?? null,
    });
  } catch (error) {
    console.error("[yeshua-connect/pin] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
