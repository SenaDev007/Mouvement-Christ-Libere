import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles pouvant supprimer n'importe quel message (modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * DELETE /api/yeshua-connect/messages/:messageId
 * Soft-delete un message (isDeleted = true).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être l'auteur du message OU avoir un rôle privilégié
 *   (SUPER_ADMIN / ADMIN / MODERATOR).
 */
export async function DELETE(
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
    const url = new URL(_req.url);
    const forEveryone = url.searchParams.get("forEveryone") === "true";

    // 🔒 Vérifier que l'utilisateur est l'auteur du message (ou modérateur)
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: { userId: true },
    });
    if (!message) {
      return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    }
    const isAuthor = message.userId === userId;
    const isPrivileged = PRIVILEGED_ROLES.has(userRole || "");
    if (!isAuthor && !isPrivileged) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que vos propres messages" },
        { status: 403 },
      );
    }

    const updated = await db.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: forEveryone ? "🗑️ Message supprimé" : "" },
    });
    return NextResponse.json({ success: true, id: updated.id, isDeleted: true });
  } catch (error) {
    console.error("[yeshua-connect/delete] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
