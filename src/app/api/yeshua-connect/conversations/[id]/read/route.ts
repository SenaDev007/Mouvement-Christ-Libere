import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureChannelIsDirectColumn } from "@/lib/ensure-schema";

/** Rôles pouvant marquer comme lu n'importe quel canal (modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * POST /api/yeshua-connect/conversations/:id/read
 *
 * Marque une conversation comme lue pour l'utilisateur courant :
 * met à jour `ChannelMember.lastReadAt` à la date actuelle.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal (sauf rôles privilégiés).
 * - 🔒 ⭐ V3.20 — Sur un PRIVÉ (isDirect) : membres UNIQUEMENT — un tiers
 *   ne doit même pas pouvoir y créer d'entrée ChannelMember fantôme.
 * - Si l'utilisateur n'est pas encore membre (modérateur), on crée l'entrée
 *   ChannelMember à la volée pour pouvoir tracker son lastReadAt.
 *
 * Response: { success: true, lastReadAt: string }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;

    const { id } = await params;
    const now = new Date();

    // 🔒 ⭐ V3.20 — CONFIDENTIALITÉ DES PRIVÉS : membres UNIQUEMENT (même
    // pour les rôles privilégiés — pas d'entrée ChannelMember fantôme dans
    // un privé). Auto-réparation de la colonne d'abord.
    await ensureChannelIsDirectColumn();
    const channelFlag = await db.channel.findUnique({
      where: { id },
      select: { isDirect: true },
    });
    if (channelFlag?.isDirect) {
      const dmMembership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId } },
        select: { userId: true },
      });
      if (!dmMembership) {
        return NextResponse.json(
          { error: "Conversation privée — réservée à ses deux membres" },
          { status: 403 },
        );
      }
    }

    // 🔒 Vérifier que l'utilisateur est membre du canal (sauf rôles privilégiés)
    if (!PRIVILEGED_ROLES.has(userRole || "")) {
      const membership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId } },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Vous n'êtes pas membre de ce canal" },
          { status: 403 },
        );
      }
    }

    // Upsert : si l'entrée ChannelMember existe on update lastReadAt,
    // sinon on la crée (utile pour les modérateurs qui consultent un canal
    // sans y être formellement inscrits).
    await db.channelMember.upsert({
      where: { channelId_userId: { channelId: id, userId } },
      update: { lastReadAt: now },
      create: {
        channelId: id,
        userId,
        role: "MEMBER",
        lastReadAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      lastReadAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/read] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors du marquage comme lu" },
      { status: 500 },
    );
  }
}
