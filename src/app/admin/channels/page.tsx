import { db } from "@/lib/db";
import { ChannelsAdminClient, type AdminChannelItem } from "@/components/admin/channels-admin-client";

export const dynamic = "force-dynamic";

/**
 * ⭐ V2.5 — Module Canaux du back-office.
 *
 * - Création / modification en modal professionnel (plus de page /new)
 * - Photo des canaux (Channel.avatarUrl)
 * - Synchronisation directe avec Yeshua Connect : la messagerie lit
 *   exactement cette même table Channel via /api/yeshua-connect/conversations
 */
export default async function AdminChannelsPage() {
  const [channels, communities] = await Promise.all([
    db.channel.findMany({
      orderBy: [{ communityId: "asc" }, { order: "asc" }],
      include: {
        community: { select: { id: true, name: true } },
        _count: { select: { messages: true, members: true } },
      },
    }),
    db.community.findMany({ orderBy: { name: "asc" } }),
  ]);

  const items: AdminChannelItem[] = channels.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    communityId: c.communityId,
    communityName: c.community.name,
    type: c.type,
    isEncrypted: c.isEncrypted,
    isRestricted: c.isRestricted,
    order: c.order,
    avatarUrl: c.avatarUrl,
    memberCount: c._count.members,
    messageCount: c._count.messages,
  }));

  const communityOptions = communities.map((c) => ({ id: c.id, name: c.name }));

  return (
    <ChannelsAdminClient
      channels={items}
      communities={communityOptions}
    />
  );
}
