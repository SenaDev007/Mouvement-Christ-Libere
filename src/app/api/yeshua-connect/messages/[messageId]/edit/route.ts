import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles pouvant éditer n'importe quel message (modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * PUT /api/yeshua-connect/messages/:messageId/edit
 * Édite le contenu d'un message (isEdited = true).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être l'auteur du message OU avoir un rôle privilégié
 *   (SUPER_ADMIN / ADMIN / MODERATOR).
 */
export async function PUT(
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
    const { content } = await req.json();
    if (!content?.trim())
      return NextResponse.json({ error: "content requis" }, { status: 400 });

    // 🔒 Vérifier que l'utilisateur est l'auteur du message (ou modérateur)
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: { userId: true, channelId: true, content: true },
    });
    if (!message) {
      return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    }
    const isAuthor = message.userId === userId;
    const isPrivileged = PRIVILEGED_ROLES.has(userRole || "");
    if (!isAuthor && !isPrivileged) {
      return NextResponse.json(
        { error: "Vous ne pouvez éditer que vos propres messages" },
        { status: 403 },
      );
    }

    const updated = await db.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    // ⭐ V2.3 — Audit log : tracer l'édition du message.
    // On stocke un extrait de l'ancien et du nouveau contenu (max 200 chars).
    try {
      await db.auditLog.create({
        data: {
          action: "MESSAGE_EDIT",
          userId,
          targetId: messageId,
          channelId: message.channelId,
          metadata: {
            isAuthor,
            moderatorAction: !isAuthor,
            oldContentPreview:
              (message.content || "").substring(0, 200) || null,
            newContentPreview:
              (content || "").substring(0, 200) || null,
          },
        },
      });
    } catch (e) {
      console.error("[audit-log/edit] Error:", e);
    }

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      isEdited: updated.isEdited,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/edit] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
