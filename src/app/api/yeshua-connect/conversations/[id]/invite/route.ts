import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles pouvant inviter dans les canaux RESTRICTED (pasteurs / modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

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
 *   les canaux RESTRICTED ne sont invitable que par les privilégiés.
 * - 🔒 Les invités doivent être membres de la MÊME communauté que le canal
 *   (anti-injection d'identifiants arbitraires).
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

    // 🔒 Permission : membre du canal OU rôle privilégié ; RESTRICTED →
    // privilégiés uniquement.
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

    // 🔒 Les invités doivent appartenir à la MÊME communauté que le canal.
    const validMembers = await db.communityMember.findMany({
      where: {
        communityId: channel.communityId,
        userId: { in: uniqueIds },
      },
      select: { userId: true },
    });
    const validIds = validMembers.map((m) => m.userId);
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "Aucun de ces membres n'appartient à la communauté du canal" },
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
