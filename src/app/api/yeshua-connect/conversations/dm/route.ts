import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureUserBlockTable } from "@/lib/ensure-schema";

/** Rôles pouvant contacter n'importe quel membre (pasteurs / modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * POST /api/yeshua-connect/conversations/dm
 *
 * ⭐ V3.4 — Crée (ou retrouve) une conversation PRIVÉE entre l'utilisateur
 * courant et un autre membre, comme Telegram/WhatsApp (« Écrire en privé »
 * depuis la liste des membres d'un canal/groupe). La communauté grandit :
 * les membres se découvrent DANS les canaux puis approfondissent en privé.
 *
 * Body: { targetUserId: string, originChannelId?: string }
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 Anti-spam : les deux membres doivent partager au moins un canal
 *   commun (l'origine est vérifiée si originChannelId est fourni), sauf
 *   pour les rôles privilégiés. On ne peut donc écrire en privé qu'aux
 *   membres croisés dans la communauté — pas à un identifiant arbitraire.
 * - Idempotent : si une conversation 2-personnes existe déjà entre les
 *   deux membres, elle est RETROUVÉE (jamais dupliquée).
 *
 * Response: { conversationId: string, created: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const meId = session.user.id;
    const myRole = session.user.role;

    const { targetUserId, originChannelId } = await req.json();
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "targetUserId requis" }, { status: 400 });
    }
    if (targetUserId === meId) {
      return NextResponse.json(
        { error: "Impossible d'écrire à soi-même" },
        { status: 400 },
      );
    }

    // ─── 1) Le destinataire existe-t-il ? ──────────────────────────────
    const target = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    // ─── 2) 🔒 V3.5 — Blocage : vérifié pour TOUS (même privilégiés) ────
    // Le blocage protège le consentement du membre : on ne peut pas lui
    // écrire en privé si elle/il vous a bloqué — et réciproquement. Les
    // canaux communs restent ouverts (le blocage ne touche que le privé).
    await ensureUserBlockTable();
    const blockRows = await db.$queryRawUnsafe<Array<{ blockerId: string; blockedId: string }>>(
      `SELECT "blockerId", "blockedId" FROM "UserBlock"
       WHERE ("blockerId" = $1 AND "blockedId" = $2)
          OR ("blockerId" = $2 AND "blockedId" = $1)`,
      meId, targetUserId,
    );
    if (blockRows.length > 0) {
      const iBlockedThem = blockRows.some(
        (r) => r.blockerId === meId && r.blockedId === targetUserId,
      );
      return NextResponse.json(
        {
          error: iBlockedThem
            ? "Vous avez bloqué ce membre — débloquez-le depuis sa fiche pour lui écrire en privé"
            : "Impossible d'écrire en privé à ce membre",
        },
        { status: 403 },
      );
    }

    // ─── 3) Anti-spam : canal commun (sauf rôles privilégiés) ─────────
    if (!PRIVILEGED_ROLES.has(myRole || "")) {
      let shared: { id: string; communityId: string } | null = null;
      if (originChannelId) {
        // Vérifie les DEUX appartenances sur le canal d'origine proposé.
        const both = await Promise.all([
          db.channelMember.findUnique({
            where: { channelId_userId: { channelId: originChannelId, userId: meId } },
          }),
          db.channelMember.findUnique({
            where: { channelId_userId: { channelId: originChannelId, userId: targetUserId } },
          }),
        ]);
        if (both[0] && both[1]) {
          shared = await db.channel.findUnique({
            where: { id: originChannelId },
            select: { id: true, communityId: true },
          });
        }
      }
      if (!shared) {
        // Repli : n'importe quel canal en commun (un membre croisé ailleurs
        // dans la communauté reste un contact légitime).
        shared = await db.channel.findFirst({
          where: {
            AND: [
              { members: { some: { userId: meId } } },
              { members: { some: { userId: targetUserId } } },
              { isRestricted: false, type: { not: "RESTRICTED" } },
            ],
          },
          select: { id: true, communityId: true },
        });
      }
      if (!shared) {
        return NextResponse.json(
          {
            error:
              "Vous ne partagez aucun canal avec ce membre — rejoignez un même canal pour lui écrire en privé",
          },
          { status: 403 },
        );
      }
    }

    // ─── 3) Retrouver une conversation privée existante ────────────────
    // Une conversation « DIRECT » = un canal dont les membres sont
    // EXACTEMENT moi + le destinataire. On retourne la plus récente.
    const candidates = await db.channel.findMany({
      where: {
        AND: [
          { members: { some: { userId: meId } } },
          { members: { some: { userId: targetUserId } } },
          // on exclut les canaux d'équipe restreints : un canal RESTRICTED
          // à 2 pasteurs n'est PAS une conversation privée classique
          { type: { in: ["TEXT"] } },
        ],
      },
      include: { members: { select: { userId: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const existing = candidates.find(
      (ch) =>
        ch.members.length === 2 &&
        ch.members.some((m) => m.userId === meId) &&
        ch.members.some((m) => m.userId === targetUserId),
    );
    if (existing) {
      return NextResponse.json({
        conversationId: existing.id,
        created: false,
      });
    }

    // ─── 4) Créer la conversation privée ───────────────────────────────
    // Communauté : celle du canal d'origine si connue, sinon la première.
    let communityId: string | undefined;
    if (originChannelId) {
      const origin = await db.channel.findUnique({
        where: { id: originChannelId },
        select: { communityId: true },
      });
      communityId = origin?.communityId;
    }
    if (!communityId) {
      const firstCommunity = await db.community.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      communityId = firstCommunity?.id;
    }
    if (!communityId) {
      return NextResponse.json(
        { error: "Aucune communauté disponible" },
        { status: 500 },
      );
    }

    const me = await db.user.findUnique({
      where: { id: meId },
      select: { name: true },
    });
    // Nom stocké = nom du destinataire (l'affichage côté client est calculé
    // PAR SPECTATEUR : chacun voit le nom de son interlocuteur).
    const channel = await db.channel.create({
      data: {
        name: target.name || "Conversation privée",
        description: null,
        type: "TEXT",
        communityId,
        isEncrypted: false,
        order: 0,
      },
    });

    // Les deux membres (rôle MEMBER — pas de hiérarchie dans un privé)
    await db.channelMember.createMany({
      data: [
        { channelId: channel.id, userId: meId, role: "MEMBER" },
        { channelId: channel.id, userId: targetUserId, role: "MEMBER" },
      ],
    });

    // ⭐ V3.4 — Audit log : tracer l'ouverture de la conversation privée.
    try {
      await db.auditLog.create({
        data: {
          action: "DM_CREATE",
          userId: meId,
          targetId: targetUserId,
          channelId: channel.id,
          metadata: {
            targetName: target.name ?? null,
            openedBy: me?.name ?? null,
            communityId,
            originChannelId: originChannelId ?? null,
          },
        },
      });
    } catch (e) {
      console.error("[audit-log/dm-create] Error:", e);
    }

    return NextResponse.json({ conversationId: channel.id, created: true });
  } catch (error) {
    console.error("[yeshua-connect/dm] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ouverture de la conversation privée" },
      { status: 500 },
    );
  }
}
