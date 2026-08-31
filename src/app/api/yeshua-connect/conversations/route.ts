import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureChannelAvatarUrl, ensureVoiceVideoColumns } from "@/lib/ensure-schema";

/** Rôles pouvant voir les canaux RESTRICTED (pasteurs / modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * GET /api/yeshua-connect/conversations
 *
 * Récupère tous les canaux de communication visibles pour l'utilisateur
 * courant, avec le dernier message + le nombre de membres.
 *
 * - 🔒 Authentification requise (NextAuth).
 * - 🔒 Les canaux RESTRICTED (type === "RESTRICTED" ou isRestricted === true)
 *   ne sont retournés que si l'utilisateur est SUPER_ADMIN, ADMIN ou MODERATOR.
 *
 * Response: Array<{
 *   id: string;
 *   type: ConversationType;  // mappé depuis ChannelType
 *   name: string;
 *   description?: string;
 *   isEncrypted: boolean;
 *   createdAt: string;
 *   updatedAt: string;
 *   lastMessageAt?: string;
 *   lastMessagePreview?: string;
 *   lastMessageSenderId?: string;
 *   participants: ChatParticipant[];
 *   unreadCount: number;  // ⭐ V2.1 — calculé via ChannelMember.lastReadAt
 *   lastReadAt?: string;  // ⭐ V2.1 — date du dernier message lu (pour sync client)
 * }>
 */
export async function GET(_req: NextRequest) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;
    const canSeeRestricted = PRIVILEGED_ROLES.has(userRole || "");

    // ⭐ V2.6.1 — Auto-réparation : si `db:push` n'a pas été lancé en prod,
    // la colonne avatarUrl (V2.5) manque et tout le findMany échoue (500
    // → Yeshua Connect s'affiche vide). Idempotent + mémoïsé par instance.
    await ensureChannelAvatarUrl();
    // ⭐ V2.7 — Auto-réparation colonne videoMode (le findMany renvoie toutes
    // les colonnes scalaires → sans ceci, 500 si la base n'est pas migrée)
    await ensureVoiceVideoColumns();

    // Charger les canaux + membres + dernier message en une seule requête
    const channels = await db.channel.findMany({
      // Filtrer les canaux RESTRICTED pour les utilisateurs non privilégiés
      where: canSeeRestricted
        ? {}
        : { isRestricted: false, type: { not: "RESTRICTED" } },
      orderBy: [{ communityId: "asc" }, { order: "asc" }],
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, role: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        community: { select: { id: true, name: true } },
      },
    });

    // ⭐ V2.1 — Pré-charger le lastReadAt de l'utilisateur courant pour
    // tous les canaux dont il est membre, en une seule requête.
    const myMemberships = await db.channelMember.findMany({
      where: { userId },
      select: { channelId: true, lastReadAt: true },
    });
    const lastReadMap = new Map<string, Date | null>();
    for (const m of myMemberships) {
      lastReadMap.set(m.channelId, m.lastReadAt);
    }

    // ⭐ V2.1 — Pour chaque canal, compter les messages non lus en une seule
    // requête agrégée (createdAt > lastReadAt AND senderId != userId).
    // On lance les compteurs en parallèle pour ne pas sérialiser les requêtes.
    const unreadCountEntries = await Promise.all(
      channels.map(async (ch) => {
        const lastReadAt = lastReadMap.get(ch.id) ?? null;
        // Si pas de lastReadAt ET l'utilisateur est membre, on compte tous les
        // messages qu'il n'a jamais "lus". Pour un modérateur non-membre on
        // reste à 0 (il n'est pas censé avoir des unread sur un canal qu'il
        // ne suit pas activement).
        if (!lastReadAt) {
          // Vérifier s'il est membre — si oui, tous les messages sont non lus
          const isMember = ch.members.some((m) => m.userId === userId);
          if (!isMember) return [ch.id, 0] as const;
        }
        const count = await db.message.count({
          where: {
            channelId: ch.id,
            isDeleted: false,
            // ⚠️ Le champ Prisma s'appelle `userId` (FK vers User), pas
            // `senderId` (qui est uniquement un alias côté frontend).
            // On exclut les messages de l'utilisateur courant du compteur
            // d'unread (ses propres messages sont toujours "lus").
            userId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });
        return [ch.id, count] as const;
      }),
    );
    const unreadCounts = new Map<string, number>(unreadCountEntries);

    // Mapper vers le format ChatConversation attendu par le frontend
    const conversations = channels.map((ch) => {
      const lastMsg = ch.messages[0];
      // Mapper ChannelType → ConversationType
      let convType: "CHANNEL" | "GROUP" | "DIRECT" | "PASTORS" | "VOICE";
      if (ch.type === "VOICE") convType = "VOICE";
      else if (ch.type === "ANNOUNCEMENT") convType = "CHANNEL";
      else if (ch.type === "RESTRICTED") convType = "PASTORS";
      else if (ch.members.length > 2) convType = "GROUP";
      else convType = "DIRECT";

      const lastReadAt = lastReadMap.get(ch.id) ?? null;
      const unreadCount = unreadCounts.get(ch.id) ?? 0;

      return {
        id: ch.id,
        type: convType,
        name: ch.name,
        description: ch.description ?? undefined,
        // ⭐ V2.5 — Photo du canal (uploadée depuis le back-office)
        avatarUrl: ch.avatarUrl ?? undefined,
        // ⭐ V2.7 — Mode vidéo du canal vocal (bascule admin façon WhatsApp)
        videoMode: ch.videoMode === true,
        createdBy: ch.members[0]?.userId ?? "",
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
        lastMessageAt: lastMsg?.createdAt.toISOString(),
        lastMessagePreview: lastMsg?.content?.substring(0, 80) ?? undefined,
        lastMessageSenderId: lastMsg?.userId,
        participants: ch.members.map((m) => ({
          userId: m.user.id,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          muted: false,
          name: m.user.name ?? "Membre",
          avatarUrl: m.user.avatarUrl ?? undefined,
          roleLabel: m.role,
          online: false, // TODO: intégrer présence via Socket.io (V2.1)
        })),
        isEncrypted: ch.isEncrypted,
        // ⭐ V2.1 — unreadCount calculé depuis lastReadAt sur ChannelMember
        unreadCount,
        // ⭐ V2.1 — lastReadAt exposé pour permettre au client de calculer
        // les unread en temps réel (messages reçus via Socket.io).
        lastReadAt: lastReadAt?.toISOString() ?? undefined,
      };
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("[yeshua-connect/conversations] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des conversations" },
      { status: 500 },
    );
  }
}
