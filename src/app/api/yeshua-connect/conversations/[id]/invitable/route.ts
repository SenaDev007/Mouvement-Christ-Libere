import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureV29Schema } from "@/lib/ensure-schema";

/** Rôles pouvant inviter dans les canaux RESTRICTED (pasteurs / modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/** ⭐ V2.9 — Fenêtre de présence : lastSeenAt < 90 s = en ligne. */
const PRESENCE_WINDOW_MS = 90_000;

/**
 * GET /api/yeshua-connect/conversations/:id/invitable?q=…
 *
 * ⭐ V3.5 — Alimente l'onglet « Inviter » du PANNEAU DES MEMBRES (façon
 * Telegram) : liste les membres de la communauté du canal qui ne sont pas
 * ENCORE dans le canal, filtrables par nom (?q=).
 *
 * La communauté grandit : chaque membre du canal peut y inviter ses
 * frères et sœurs de la communauté (sauf canal RESTRICTED → privilégiés).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal (sauf rôles privilégiés) ;
 *   les canaux RESTRICTED ne sont invitable que par les privilégiés.
 * - Limite : 50 résultats (recherche serveur, insensible à la casse).
 *
 * Response: Array<{ userId, name, avatarUrl, role, isOnline, joinedAt }>
 */
export async function GET(
  req: NextRequest,
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
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    // ⭐ V2.9 — Présence réelle (lastSeenAt) dans la liste des invitable.
    await ensureV29Schema();

    const channel = await db.channel.findUnique({
      where: { id },
      select: { id: true, communityId: true, isRestricted: true, type: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "Canal introuvable" }, { status: 404 });
    }

    // 🔒 Permission : membre du canal OU rôle privilégié. Un canal
    // RESTRICTED n'est invitable que par les rôles privilégiés.
    const privileged = PRIVILEGED_ROLES.has(userRole || "");
    const isRestricted = channel.isRestricted || channel.type === "RESTRICTED";
    if (isRestricted && !privileged) {
      return NextResponse.json(
        { error: "Canal réservé aux pasteurs et à la modération" },
        { status: 403 },
      );
    }
    if (!privileged) {
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

    // Membres de la communauté du canal, PAS ENCORE membres du canal.
    // (le filtre « déjà dans le canal » passe par la relation User →
    // ChannelMember, car CommunityMember n'a pas de relation directe)
    const communityMembers = await db.communityMember.findMany({
      where: {
        communityId: channel.communityId,
        userId: { not: userId }, // ne pas s'inviter soi-même
        user: {
          channelMembers: { none: { channelId: id } },
          ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        },
      },
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
      orderBy: [{ user: { name: "asc" } }],
      take: 50,
    });

    const now = Date.now();
    const formatted = communityMembers
      .filter((cm) => cm.user)
      .map((cm) => {
        const lastSeen = (cm.user as { lastSeenAt?: Date | null }).lastSeenAt;
        const isOnline =
          !!lastSeen && now - new Date(lastSeen).getTime() < PRESENCE_WINDOW_MS;
        return {
          userId: cm.user.id,
          name: cm.user.name ?? "Membre",
          avatarUrl: cm.user.avatarUrl ?? undefined,
          role: (cm.user as { role?: string }).role,
          isOnline,
          joinedAt: cm.joinedAt.toISOString(),
        };
      });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/invitable] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recherche des membres à inviter" },
      { status: 500 },
    );
  }
}
