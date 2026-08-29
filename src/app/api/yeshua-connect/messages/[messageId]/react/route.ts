import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles pouvant réagir dans tous les canaux (modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * POST /api/yeshua-connect/messages/:messageId/react
 * Ajoute/toggle une réaction emoji sur un message.
 * Body: { emoji }  ← userId vient de la session.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal du message (ou rôle privilégié).
 * - 🔒 userId / userName sont forcés depuis la session.
 *
 * Comportement toggle (V2.1) :
 *   - Si l'utilisateur n'a pas encore réagi avec cet emoji → crée la réaction.
 *   - Si l'utilisateur a déjà réagi avec cet emoji → supprime la réaction.
 *   - Retourne la liste agrégée des réactions du message mises à jour.
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
    const userName = session.user.name ?? "Membre";
    const userRole = session.user.role;

    const { messageId } = await params;
    const { emoji } = await req.json();
    if (!emoji) {
      return NextResponse.json({ error: "emoji requis" }, { status: 400 });
    }

    const message = await db.message.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true },
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

    // ⭐ V2.1 — Toggle : si la réaction existe déjà, on la supprime, sinon on la crée.
    const existing = await db.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji },
      },
    });

    let action: "added" | "removed";
    if (existing) {
      await db.messageReaction.delete({ where: { id: existing.id } });
      action = "removed";
    } else {
      await db.messageReaction.create({
        data: { messageId, userId, emoji },
      });
      action = "added";
    }

    // ⭐ Retourner la liste agrégée des réactions mises à jour pour ce message,
    // regroupées par emoji avec le nombre d'utilisateurs et la liste des userIds.
    const reactions = await db.messageReaction.findMany({
      where: { messageId },
      select: {
        emoji: true,
        userId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const grouped = new Map<string, { emoji: string; count: number; userIds: string[] }>();
    for (const r of reactions) {
      const entry = grouped.get(r.emoji);
      if (entry) {
        entry.count += 1;
        entry.userIds.push(r.userId);
      } else {
        grouped.set(r.emoji, { emoji: r.emoji, count: 1, userIds: [r.userId] });
      }
    }

    return NextResponse.json({
      success: true,
      messageId,
      emoji,
      userId,
      userName,
      action, // "added" | "removed"
      reactions: Array.from(grouped.values()),
    });
  } catch (error) {
    console.error("[yeshua-connect/react] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
