import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureV29Schema } from "@/lib/ensure-schema";

/** Rôles contournant l'appartenance au canal (modération incluse) —
 * pour les canaux OUVERTS uniquement. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/** ⭐ V3.7 — Rôles pouvant inviter dans les canaux RESTRICTED (cercle des
 * pasteurs) : les ADMINISTRATEURS PRINCIPAUX — c'est-à-dire les super admins
 * (PAM et Pasteur Kongo portent SUPER_ADMIN) et les admins/délégués.
 * Groupe restreint : ce sont EUX SEULS qui ajoutent qui ils veulent. */
const INVITE_RESTRICTED_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

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
 *   ⭐ V3.7 — les canaux RESTRICTED (cercle des pasteurs) ne sont invitables
 *   QUE par les administrateurs principaux (SUPER_ADMIN/ADMIN), qui peuvent
 *   y ajouter QUI ILS VEULENT : la recherche porte alors sur TOUS les
 *   membres inscrits sur la plateforme (pas seulement la communauté).
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

    // 🔒 Permission : membre du canal OU rôle privilégié. ⭐ V3.7 — un canal
    // RESTRICTED (cercle des pasteurs) n'est invitable QUE par les
    // administrateurs principaux (super admins — PAM, Pasteur Kongo — et
    // admins) : c'est un groupe restreint, ce sont eux qui ajoutent qui ils
    // veulent.
    const privileged = PRIVILEGED_ROLES.has(userRole || "");
    const canInviteRestricted = INVITE_RESTRICTED_ROLES.has(userRole || "");
    const isRestricted = channel.isRestricted || channel.type === "RESTRICTED";
    if (isRestricted && !canInviteRestricted) {
      return NextResponse.json(
        { error: "Cercle restreint — seuls les administrateurs principaux peuvent ajouter des membres dans ce canal" },
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

    const now = Date.now();
    const isOnlineFrom = (lastSeen?: Date | null) =>
      !!lastSeen && now - new Date(lastSeen).getTime() < PRESENCE_WINDOW_MS;

    let formatted: Array<{
      userId: string;
      name: string;
      avatarUrl?: string;
      role?: string;
      isOnline: boolean;
      joinedAt: string;
    }>;

    if (isRestricted) {
      // ⭐ V3.7 — Cercle restreint (ex. « Cercle des pasteurs ») : les
      // administrateurs principaux ajoutent QUI ILS VEULENT — la recherche
      // porte sur TOUS les membres inscrits sur la plateforme, pas
      // seulement ceux de la communauté du canal.
      const users = await db.user.findMany({
        where: {
          id: { not: userId }, // ne pas s'inviter soi-même
          channelMembers: { none: { channelId: id } }, // pas déjà membre
          ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          role: true,
          lastSeenAt: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
        take: 50,
      });
      formatted = users.map((u) => ({
        userId: u.id,
        name: u.name ?? "Membre",
        avatarUrl: u.avatarUrl ?? undefined,
        role: u.role,
        isOnline: isOnlineFrom(u.lastSeenAt),
        joinedAt: u.createdAt.toISOString(),
      }));
    } else {
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

      formatted = communityMembers
        .filter((cm) => cm.user)
        .map((cm) => {
          const lastSeen = (cm.user as { lastSeenAt?: Date | null }).lastSeenAt;
          return {
            userId: cm.user.id,
            name: cm.user.name ?? "Membre",
            avatarUrl: cm.user.avatarUrl ?? undefined,
            role: (cm.user as { role?: string }).role,
            isOnline: isOnlineFrom(lastSeen),
            joinedAt: cm.joinedAt.toISOString(),
          };
        });
    }

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/invitable] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recherche des membres à inviter" },
      { status: 500 },
    );
  }
}
