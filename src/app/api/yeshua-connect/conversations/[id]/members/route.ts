import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles pouvant voir les membres de n'importe quel canal. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * GET /api/yeshua-connect/conversations/:id/members
 *
 * Liste les membres d'un canal (pour l'autocomplétion des mentions @user).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal (sauf rôles privilégiés).
 *
 * Response: Array<{ userId, name, role, avatarUrl, isOnline }>
 */
export async function GET(
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

    const members = await db.channelMember.findMany({
      where: { channelId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    const formatted = members
      .filter((m) => m.user)
      .map((m) => ({
        userId: m.user.id,
        name: m.user.name ?? "Membre",
        role: m.role,
        avatarUrl: m.user.avatarUrl ?? undefined,
        // La présence temps-réel est gérée via Socket.io côté client
        isOnline: false,
      }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/members] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des membres" },
      { status: 500 },
    );
  }
}
