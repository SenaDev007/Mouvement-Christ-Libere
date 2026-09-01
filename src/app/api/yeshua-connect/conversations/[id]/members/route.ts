import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureV29Schema } from "@/lib/ensure-schema";

/** Rôles pouvant voir les membres de n'importe quel canal. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/** ⭐ V2.9 — Fenêtre de présence : lastSeenAt < 90 s = en ligne. */
const PRESENCE_WINDOW_MS = 90_000;

/**
 * GET /api/yeshua-connect/conversations/:id/members
 *
 * Liste les membres d'un canal — alimente l'autocomplétion @user ET
 * ⭐ V3.4 le PANNEAU DES MEMBRES façon Telegram/WhatsApp (liste, rôles,
 * présence, actions « écrire en privé » / « appeler »).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal (sauf rôles privilégiés).
 *
 * Response: Array<{
 *   userId, name, role (rôle DANS le canal), userRole (rôle global),
 *   avatarUrl, isOnline (présence réelle via lastSeenAt), joinedAt
 * }>
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

    // ⭐ V2.9 — Auto-réparation : la colonne User.lastSeenAt est sélectionnée
    // ci-dessous (présence du panneau des membres) → sans ceci, 500 si la
    // base n'est pas migrée. Idempotent + mémoïsé par instance.
    await ensureV29Schema();

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
            lastSeenAt: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    const now = Date.now();
    const formatted = members
      .filter((m) => m.user)
      .map((m) => {
        const lastSeen = (m.user as { lastSeenAt?: Date | null }).lastSeenAt;
        const isOnline =
          !!lastSeen && now - new Date(lastSeen).getTime() < PRESENCE_WINDOW_MS;
        return {
          userId: m.user.id,
          name: m.user.name ?? "Membre",
          // Rôle DANS le canal (ChannelRole : SUPER_ADMIN, ADMIN,
          // MODERATOR, ANIMATOR, MEMBER)
          role: m.role,
          // ⭐ V3.4 — Rôle GLOBAL (UserRole : pasteur, animateur…), utile
          // pour les badges « Pasteur » du panneau des membres.
          userRole: (m.user as { role?: string }).role,
          avatarUrl: m.user.avatarUrl ?? undefined,
          // ⭐ V3.4 — Présence RÉELLE (fini le `false` figé) : la liste des
          // membres montre qui est en ligne, comme Telegram.
          isOnline,
          // ⭐ V3.4 — Date d'adhésion (« Membre depuis… »)
          joinedAt: m.joinedAt.toISOString(),
          // Compatibilité ancienne (autocomplétion @mention)
          online: isOnline,
        };
      });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/members] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des membres" },
      { status: 500 },
    );
  }
}
