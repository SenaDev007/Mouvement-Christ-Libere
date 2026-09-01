import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles contournant l'appartenance au canal (modération incluse) —
 * pour les canaux OUVERTS uniquement. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/** ⭐ V3.7 — Rôles pouvant inviter dans les canaux RESTRICTED (cercle des
 * pasteurs) : les ADMINISTRATEURS PRINCIPAUX — super admins (PAM et
 * Pasteur Kongo portent SUPER_ADMIN) et admins/délégués. Groupe restreint :
 * ce sont EUX SEULS qui ajoutent qui ils veulent. */
const INVITE_RESTRICTED_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

/**
 * POST /api/yeshua-connect/conversations/:id/invite
 *
 * ⭐ V3.5 — Invite des membres de la communauté DANS le canal/groupe,
 * directement depuis le panneau des membres (façon Telegram) : la
 * communauté grandit, chaque membre peut y appeler ses frères et sœurs.
 *
 * Body: { userIds: string[] } (1 à 50 identifiants)
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'invitant doit être membre du canal (sauf rôles privilégiés) ;
 *   ⭐ V3.7 — les canaux RESTRICTED (cercle des pasteurs) ne sont invitables
 *   QUE par les administrateurs principaux (SUPER_ADMIN/ADMIN), qui peuvent
 *   y ajouter QUI ILS VEULENT (n'importe quel membre inscrit sur la
 *   plateforme, pas seulement la communauté du canal).
 * - 🔒 Les invités doivent être membres de la MÊME communauté que le canal
 *   (anti-injection d'identifiants arbitraires) — sauf canal RESTRICTED,
 *   où les administrateurs principaux ajoutent qui ils veulent.
 * - Idempotent : skipDuplicates sur la contrainte unique (channelId, userId).
 * - Audit log : INVITE_MEMBERS (noms + canal).
 *
 * Response: { invited: number, channelName: string }
 */
export async function POST(
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
    const body = await req.json().catch(() => ({}));
    const userIds: unknown = body?.userIds;

    if (
      !Array.isArray(userIds) ||
      userIds.length === 0 ||
      userIds.length > 50 ||
      userIds.some((u) => typeof u !== "string" || !u)
    ) {
      return NextResponse.json(
        { error: "userIds requis (liste de 1 à 50 identifiants)" },
        { status: 400 },
      );
    }
    const uniqueIds = Array.from(new Set(userIds as string[])).filter(
      (u) => u !== userId,
    );
    if (uniqueIds.length === 0) {
      return NextResponse.json(
        { error: "Impossible de s'inviter soi-même" },
        { status: 400 },
      );
    }

    const channel = await db.channel.findUnique({
      where: { id },
      select: { id: true, name: true, communityId: true, isRestricted: true, type: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "Canal introuvable" }, { status: 404 });
    }

    // 🔒 Permission : membre du canal OU rôle privilégié ; ⭐ V3.7 —
    // RESTRICTED (cercle des pasteurs) → administrateurs principaux
    // UNIQUEMENT (super admins — PAM, Pasteur Kongo — et admins) : c'est un
    // groupe restreint, ce sont eux qui ajoutent qui ils veulent.
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

    // 🔒 Les invités doivent appartenir à la MÊME communauté que le canal.
    // ⭐ V3.7 — EXCEPTION : dans un canal RESTRICTED (cercle des pasteurs),
    // les administrateurs principaux ajoutent QUI ILS VEULENT — n'importe
    // quel membre inscrit sur la plateforme (pas seulement la communauté).
    let validIds: string[];
    if (isRestricted) {
      const users = await db.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      validIds = users.map((u) => u.id);
    } else {
      const validMembers = await db.communityMember.findMany({
        where: {
          communityId: channel.communityId,
          userId: { in: uniqueIds },
        },
        select: { userId: true },
      });
      validIds = validMembers.map((m) => m.userId);
    }
    if (validIds.length === 0) {
      return NextResponse.json(
        {
          error: isRestricted
            ? "Aucun de ces membres n'existe sur la plateforme"
            : "Aucun de ces membres n'appartient à la communauté du canal",
        },
        { status: 400 },
      );
    }

    // ⭐ V3.5 — Ajout (idempotent : les déjà-membres sont ignorés).
    const created = await db.channelMember.createMany({
      data: validIds.map((uid) => ({ channelId: id, userId: uid, role: "MEMBER" })),
      skipDuplicates: true,
    });

    // ⭐ V3.5 — Message système d'accueil ? Non : un simple audit log suffit
    // (le canal gagne les membres silencieusement, comme Telegram).
    const me = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const invitedNames = await db.user.findMany({
      where: { id: { in: validIds } },
      select: { name: true },
    });
    try {
      await db.auditLog.create({
        data: {
          action: "INVITE_MEMBERS",
          userId,
          channelId: id,
          targetId: id,
          metadata: {
            channelName: channel.name,
            invitedBy: me?.name ?? null,
            invitedCount: created.count,
            invitedNames: invitedNames.map((u) => u.name ?? "Membre"),
          },
        },
      });
    } catch (e) {
      console.error("[audit-log/invite-members] Error:", e);
    }

    return NextResponse.json({ invited: created.count, channelName: channel.name });
  } catch (error) {
    console.error("[yeshua-connect/invite] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'invitation des membres" },
      { status: 500 },
    );
  }
}
