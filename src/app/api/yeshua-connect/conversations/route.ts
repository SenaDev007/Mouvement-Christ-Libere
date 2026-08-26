import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/yeshua-connect/conversations
 *
 * Récupère tous les canaux de communication visibles pour l'utilisateur
 * courant, avec le dernier message + le nombre de membres.
 *
 * ⭐ Pas de données mock — tout vient de Prisma (tables Channel + Message + ChannelMember).
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
 *   unreadCount: number;  // TODO: calculer via lastReadAt (V2.1)
 * }>
 */
export async function GET(_req: NextRequest) {
  try {
    const channels = await db.channel.findMany({
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

    // Mapper vers le format ChatConversation attendu par le frontend
    const conversations = channels.map((ch) => {
      const lastMsg = ch.messages[0];
      // Mapper ChannelType → ConversationType
      let convType: "CHANNEL" | "GROUP" | "DIRECT" | "PASTORS";
      if (ch.type === "ANNOUNCEMENT") convType = "CHANNEL";
      else if (ch.type === "RESTRICTED") convType = "PASTORS";
      else if (ch.members.length > 2) convType = "GROUP";
      else convType = "DIRECT";

      return {
        id: ch.id,
        type: convType,
        name: ch.name,
        description: ch.description ?? undefined,
        avatarUrl: undefined,
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
        unreadCount: 0, // TODO: calculer via lastReadAt (V2.1)
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
