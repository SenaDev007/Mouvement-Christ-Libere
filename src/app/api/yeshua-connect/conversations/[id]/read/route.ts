import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

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
