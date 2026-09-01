import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureMessageTypeEnum, ensureUserBlockTable } from "@/lib/ensure-schema";

/** Rôles pouvant modérer (et donc lire) tous les canaux même sans y être membre. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * GET /api/yeshua-connect/conversations/:id/messages
 *
 * Récupère les messages d'un canal, triés par createdAt asc (oldest-first).
 *
 * Pagination cursor :
 *   - Sans `?before=` : retourne les `limit` messages les plus RÉCENTS
 *     (utile pour l'affichage initial d'un chat : on voit le bas de la
 *      conversation, et l'utilisateur peut scroller vers le haut pour
 *      charger les anciens).
 *   - Avec `?before=<messageId>` : retourne les `limit` messages plus
 *     ANCIENS que le message identifié par `messageId` (pour le "load more"
 *     au scroll vers le haut). Le message `messageId` lui-même est exclu.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal (table ChannelMember).
 *   Les rôles SUPER_ADMIN / ADMIN / MODERATOR peuvent modérer sans être membres.
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
    const url = new URL(_req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const beforeMessageId = url.searchParams.get("before");

    // 🔒 Vérifier que l'utilisateur est membre du canal (sauf rôles privilégiés)
    // ⭐ V2.9 — AUTO-JOIN paresseux : les canaux PUBLICS (non RESTRICTED)
    // sont visibles par tous dans la liste — si l'utilisateur n'est pas
    // encore membre (utilisateur existant créé avant le backfill V2.9, ou
    // inscription manuelle), on l'inscrit AUTOMATIQUEMENT au premier accès.
    // Avant : 403 « Vous n'êtes pas membre » → « je ne vois pas les messages
    // de Pam » alors que le canal s'affichait dans la sidebar.
    if (!PRIVILEGED_ROLES.has(userRole || "")) {
      const membership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId } },
      });
      if (!membership) {
        const channelInfo = await db.channel.findUnique({
          where: { id },
          select: { isRestricted: true, type: true },
        });
        if (channelInfo && !channelInfo.isRestricted && channelInfo.type !== "RESTRICTED") {
          await db.channelMember
            .create({ data: { channelId: id, userId, role: "MEMBER" } })
            .catch(() => {
              // course concurrentielle (double-clic / double-requête) :
              // la 2e création échoue sur l'unique — c'est OK, on continue.
            });
          console.log(`[messages GET] Auto-join : ${userId} → canal ${id}`);
        } else {
          return NextResponse.json(
            { error: "Vous n'êtes pas membre de ce canal" },
            { status: 403 },
          );
        }
      }
    }

    // ⭐ V2.1 — Pagination cursor : si `?before=` est fourni, on récupère les
    // `limit` messages plus anciens que le message-cursor. On utilise le
    // cursor Prisma (sur id unique) + take négatif pour aller vers le passé.
    // Sans `?before=`, on récupère les `limit` messages les plus récents
    // (orderBy desc + take), puis on inverse le tableau pour retourner du
    // plus ancien au plus récent (cohérent avec le rendu du chat).
    let messages;
    if (beforeMessageId) {
      // Vérifier que le message-cursor existe bien dans ce canal (sinon 404)
      const cursorMsg = await db.message.findUnique({
        where: { id: beforeMessageId },
        select: { id: true, channelId: true },
      });
      if (!cursorMsg || cursorMsg.channelId !== id) {
        return NextResponse.json(
          { error: "Message cursor introuvable dans ce canal" },
          { status: 404 },
        );
      }
      messages = await db.message.findMany({
        where: { channelId: id, isDeleted: false },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        cursor: { id: beforeMessageId },
        skip: 1,
        take: -limit, // ← négatif = avant le curseur (vers le passé)
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, role: true } },
          // ⭐ V2.5 — Sondages : inclure le poll + options + votes
          poll: { include: { options: { include: { votes: true } } } },
          reactions: {
            select: { emoji: true, userId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } else {
      // Chargement initial : `limit` messages les plus récents, puis inversion
      // pour obtenir un ordre oldest-first (cohérent avec le rendu du chat).
      const descMessages = await db.message.findMany({
        where: { channelId: id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, role: true } },
          // ⭐ V2.5 — Sondages : inclure le poll + options + votes
          poll: { include: { options: { include: { votes: true } } } },
          reactions: {
            select: { emoji: true, userId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      messages = descMessages.reverse();
    }

    // Si des messages ont un replyToId, on fetch les messages parent séparément
    // (le modèle Prisma Message n'a pas de self-relation `replyTo` déclarée).
    const replyIds = messages.map(m => m.replyToId).filter(Boolean) as string[];
    const replyMessages = replyIds.length > 0
      ? await db.message.findMany({
          where: { id: { in: replyIds } },
          include: { user: { select: { id: true, name: true } } },
        })
      : [];
    const replyMap = new Map(replyMessages.map(r => [r.id, r]));

    // ⭐ V2.1 — Regrouper les réactions par emoji (count + userIds)
    const groupedReactions = (reactions: Array<{ emoji: string; userId: string; createdAt: Date }>) => {
      const grouped = new Map<string, { emoji: string; count: number; userIds: string[] }>();
      for (const r of reactions) {
        const entry = grouped.get(r.emoji);
        if (entry) {
          entry.count += 1;
          entry.userIds.push(r.userId);
        } else {
          grouped.set(r.emoji, { emoji: r.emoji, count: 1, userIds: [r.userId] });
        }
      }
      return Array.from(grouped.values());
    };

    const formatted = messages.map((m) => ({
      id: m.id,
      conversationId: m.channelId,
      senderId: m.userId,
      senderName: m.user.name ?? "Membre",
      senderRole: m.user.role,
      // ⭐ V2.5 — Avatar de l'expéditeur (bulles de groupe)
      senderAvatarUrl: (m.user as { avatarUrl?: string | null }).avatarUrl ?? undefined,
      type: m.type,
      content: m.content,
      attachmentUrl: m.attachmentUrl ?? undefined,
      // ⭐ V2.1 — Métadonnées pièce jointe
      attachmentName: m.attachmentName ?? undefined,
      attachmentSize: m.attachmentSize ?? undefined,
      attachmentMime: m.attachmentMime ?? undefined,
      duration: m.duration ?? undefined,
      // ⭐ V2.1 — Verset biblique partagé
      verseRef: m.verseRef ?? undefined,
      verseText: m.verseText ?? undefined,
      replyToId: m.replyToId ?? undefined,
      replyTo: m.replyToId
        ? (() => {
            const parent = replyMap.get(m.replyToId!);
            return parent
              ? { senderName: parent.user.name ?? "Membre", content: parent.content }
              : undefined;
          })()
        : undefined,
      // ⭐ V2.1 — Réactions persistées (groupées par emoji)
      reactions: groupedReactions(m.reactions),
      // ⭐ V2.1 — Épinglage
      isPinned: m.isPinned,
      pinnedAt: m.pinnedAt?.toISOString() ?? undefined,
      pinnedBy: m.pinnedBy ?? undefined,
      // ⭐ V2.5 — Sondage (pour les messages type POLL)
      poll: m.poll
        ? {
            id: m.poll.id,
            question: m.poll.question,
            isMulti: m.poll.isMulti,
            expiresAt: m.poll.expiresAt?.toISOString() ?? undefined,
            options: m.poll.options
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((o) => ({
                id: o.id,
                label: o.label,
                order: o.order,
                votes: o.votes.map((v) => ({ userId: v.userId })),
              })),
          }
        : undefined,
      createdAt: m.createdAt.toISOString(),
      editedAt: m.isEdited ? m.updatedAt.toISOString() : undefined,
      editedHistory: m.editedHistory ?? undefined,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/messages] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des messages" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/yeshua-connect/conversations/:id/messages
 *
 * Envoie un nouveau message dans un canal.
 * Body: { content, type?, replyToId? }  ← userId vient de la session.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal.
 * - 🔒 userId est forcé depuis la session (ignore req.body.userId).
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

    // ⭐ V2.8 — Auto-réparation de l'enum MessageType : la valeur VERSE
    // (versets partagés depuis la Bible intégrée) manque dans la base si
    // `db:push` n'a pas été relancé depuis la V2.6 — sans ceci, l'envoi
    // d'un verset échoue en 500 (PrismaClientValidationError).
    await ensureMessageTypeEnum();

    const { id } = await params;
    const body = await req.json();
    const {
      content,
      type = "TEXT",
      replyToId,
      attachmentUrl,
      attachmentName,
      attachmentSize,
      attachmentMime,
      duration,
      verseRef,
      verseText,
    } = body;

    // 🔒 userId vient de la session, pas du body — on ignore body.userId
    if (!content) {
      return NextResponse.json(
        { error: "content est requis" },
        { status: 400 },
      );
    }

    // 🔒 Vérifier que l'utilisateur est membre du canal (sauf rôles privilégiés)
    // ⭐ V2.9 — Même auto-join paresseux côté envoi (cohérent avec le GET).
    if (!PRIVILEGED_ROLES.has(userRole || "")) {
      const membership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId } },
      });
      if (!membership) {
        const channelInfo = await db.channel.findUnique({
          where: { id },
          select: { isRestricted: true, type: true },
        });
        if (channelInfo && !channelInfo.isRestricted && channelInfo.type !== "RESTRICTED") {
          await db.channelMember
            .create({ data: { channelId: id, userId, role: "MEMBER" } })
            .catch(() => {});
        } else {
          return NextResponse.json(
            { error: "Vous n'êtes pas membre de ce canal" },
            { status: 403 },
          );
        }
      }
    }

    // ─── 🔒 V3.5 — Blocage : impossible d'écrire dans un PRIVÉ (canal à     
    // 2 personnes exactement) si l'un des deux a bloqué l'autre. Les      
    // groupes/canaux (3+ membres) restent OUVERTS — on bloque la         
    // personne, pas la communauté.                                        
    const dmMembers = await db.channelMember.findMany({
      where: { channelId: id },
      select: { userId: true },
      take: 3,
    });
    if (dmMembers.length === 2) {
      const other = dmMembers.find((m) => m.userId !== userId);
      if (other) {
        await ensureUserBlockTable();
        const blockRows = await db.$queryRawUnsafe<Array<{ blockerId: string; blockedId: string }>>(
          `SELECT "blockerId", "blockedId" FROM "UserBlock"
           WHERE ("blockerId" = $1 AND "blockedId" = $2)
              OR ("blockerId" = $2 AND "blockedId" = $1)`,
          userId, other.userId,
        );
        if (blockRows.length > 0) {
          const iBlockedThem = blockRows.some(
            (r) => r.blockerId === userId && r.blockedId === other.userId,
          );
          return NextResponse.json(
            {
              error: iBlockedThem
                ? "Vous avez bloqué ce membre — débloquez-le pour lui écrire"
                : "Impossible d'écrire à ce membre en privé",
            },
            { status: 403 },
          );
        }
      }
    }

    const message = await db.message.create({
      data: {
        channelId: id,
        userId, // 🔒 depuis la session
        content,
        type,
        replyToId: replyToId ?? null,
        // ⭐ V2.1 — Métadonnées pièces jointes + verset biblique
        attachmentUrl: attachmentUrl ?? null,
        attachmentName: attachmentName ?? null,
        attachmentSize: attachmentSize ?? null,
        attachmentMime: attachmentMime ?? null,
        duration: duration ?? null,
        verseRef: verseRef ?? null,
        verseText: verseText ?? null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
        reactions: {
          select: { emoji: true, userId: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // ⭐ V2.1 — Mettre à jour lastMessageAt sur le canal pour le tri
    await db.channel.update({
      where: { id },
      data: { lastMessageAt: message.createdAt },
    }).catch(() => {
      // ignore — ne pas casser l'envoi si la mise à jour échoue
    });

    return NextResponse.json({
      id: message.id,
      conversationId: message.channelId,
      senderId: message.userId,
      senderName: message.user.name ?? "Membre",
      senderRole: message.user.role,
      // ⭐ V2.5 — Avatar de l'expéditeur (bulles de groupe)
      senderAvatarUrl: (message.user as { avatarUrl?: string | null }).avatarUrl ?? undefined,
      type: message.type,
      content: message.content,
      attachmentUrl: message.attachmentUrl ?? undefined,
      attachmentName: message.attachmentName ?? undefined,
      attachmentSize: message.attachmentSize ?? undefined,
      attachmentMime: message.attachmentMime ?? undefined,
      duration: message.duration ?? undefined,
      verseRef: message.verseRef ?? undefined,
      verseText: message.verseText ?? undefined,
      reactions: [], // nouveau message — aucune réaction
      isPinned: false,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/messages POST] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message" },
      { status: 500 },
    );
  }
}
