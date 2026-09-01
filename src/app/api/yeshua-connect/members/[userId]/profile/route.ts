import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureV29Schema, ensureUserBlockTable } from "@/lib/ensure-schema";

/** Rôles pouvant consulter le profil de n'importe quel membre. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/** ⭐ V2.9 — Fenêtre de présence : lastSeenAt < 90 s = en ligne. */
const PRESENCE_WINDOW_MS = 90_000;

/**
 * GET /api/yeshua-connect/members/:userId/profile
 *
 * ⭐ V3.5 — PROFIL COMPLET d'un membre au clic (façon Telegram/WhatsApp),
 * ouvert depuis le panneau des membres d'un canal :
 *   • identité : photo, nom, badges de rôle, présence ;
 *   • bio (280 caractères, renseignée par le membre dans ses paramètres) ;
 *   • pays + ville (localisation, comme demandé) ;
 *   • « membre depuis » (création du compte) ;
 *   • canaux communs (« vous êtes tous les deux dans… ») ;
 *   • statut de blocage (sécurité des privés) pour adapter les actions.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 Anti-stalking : la fiche n'est visible que si l'on partage au moins
 *   un canal avec le membre (ou rôle privilégié) — cohérent avec l'anti-spam
 *   des messages privés (V3.4).
 *
 * Response: {
 *   userId, name, avatarUrl, bio, country, city, role, isOnline,
 *   memberSince, sharedChannels: [{ id, name, avatarUrl, type }],
 *   blockedByMe, hasBlockedMe
 * }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const meId = session.user.id;
    const myRole = session.user.role;

    const { userId } = await params;
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId requis" }, { status: 400 });
    }

    // ⭐ V2.9 — Présence réelle + ⭐ V3.5 table UserBlock (auto-réparation).
    await ensureV29Schema();

    const target = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        role: true,
        bio: true,
        country: true,
        city: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    if (!target) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    // ─── Canaux communs (non restreints) + permission de voir la fiche ──
    const sharedChannels = await db.channel.findMany({
      where: {
        AND: [
          { members: { some: { userId: meId } } },
          { members: { some: { userId } } },
          { isRestricted: false, type: { not: "RESTRICTED" } },
        ],
      },
      select: { id: true, name: true, avatarUrl: true, type: true },
      orderBy: { name: "asc" },
      take: 20,
    });

    if (sharedChannels.length === 0 && !PRIVILEGED_ROLES.has(myRole || "")) {
      // Cohérent avec l'anti-spam des privés : on ne découvre un membre
      // que si l'on partage un canal avec lui.
      return NextResponse.json(
        { error: "Vous ne partagez aucun canal avec ce membre" },
        { status: 403 },
      );
    }

    // ─── Statut de blocage (les deux sens) ─────────────────────────────
    let blockedByMe = false;
    let hasBlockedMe = false;
    try {
      await ensureUserBlockTable();
      const blockRows = await db.$queryRawUnsafe<Array<{ blockerId: string; blockedId: string }>>(
        `SELECT "blockerId", "blockedId" FROM "UserBlock"
         WHERE ("blockerId" = $1 AND "blockedId" = $2)
            OR ("blockerId" = $2 AND "blockedId" = $1)`,
        meId, userId,
      );
      blockedByMe = blockRows.some((r) => r.blockerId === meId && r.blockedId === userId);
      hasBlockedMe = blockRows.some((r) => r.blockerId === userId && r.blockedId === meId);
    } catch {
      // table absente — aucun blocage
    }

    const lastSeen = (target as { lastSeenAt?: Date | null }).lastSeenAt;
    const isOnline =
      !!lastSeen && Date.now() - new Date(lastSeen).getTime() < PRESENCE_WINDOW_MS;

    return NextResponse.json({
      userId: target.id,
      name: target.name ?? "Membre",
      avatarUrl: target.avatarUrl ?? undefined,
      bio: target.bio ?? undefined,
      country: target.country ?? undefined,
      city: target.city ?? undefined,
      role: (target as { role?: string }).role,
      isOnline,
      memberSince: target.createdAt.toISOString(),
      sharedChannels: sharedChannels.map((c) => ({
        id: c.id,
        name: c.name,
        avatarUrl: c.avatarUrl ?? undefined,
        type: c.type,
      })),
      blockedByMe,
      hasBlockedMe,
    });
  } catch (error) {
    console.error("[yeshua-connect/member-profile] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du profil" },
      { status: 500 },
    );
  }
}
