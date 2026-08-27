import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, Lock, Hash, Volume2, Megaphone, Users, MessageSquare, ShieldCheck } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

const CHANNEL_CONFIG = {
  TEXT: { label: "Texte", icon: Hash, color: "#5B7052" },
  VOICE: { label: "Voix", icon: Volume2, color: "#8C5FA8" },
  VIDEO: { label: "Vidéo", icon: Volume2, color: "#C9A227" },
  ANNOUNCEMENT: { label: "Annonce", icon: Megaphone, color: "#A3821C" },
  RESTRICTED: { label: "Restreint", icon: Lock, color: "#DC2626" },
};

export default async function AdminChannelsPage() {
  const channels = await db.channel.findMany({
    orderBy: [{ communityId: "asc" }, { order: "asc" }],
    include: {
      community: true,
      _count: { select: { messages: true, members: true } },
    },
  });

  // Stats
  const stats = {
    total: channels.length,
    encrypted: channels.filter((c) => c.isEncrypted).length,
    members: channels.reduce((sum, c) => sum + c._count.members, 0),
    messages: channels.reduce((sum, c) => sum + c._count.messages, 0),
  };

  // Grouper par communauté
  const byCommunity = channels.reduce((acc, c) => {
    const key = c.community.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, typeof channels>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Espaces de communauté
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            Canaux
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Canaux organisés par communauté et par type.
          </p>
        </div>
        <Link
          href="/admin/channels/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          Nouveau canal
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-[#1E0F2B]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Canaux</div>
        </div>
        <div className="bg-white rounded-xl border border-[#C9A227]/30 p-4">
          <div className="text-2xl font-bold text-[#A3821C]">{stats.encrypted}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#A3821C] font-semibold mt-0.5">Chiffrés E2E</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8C5FA8]/30 p-4">
          <div className="text-2xl font-bold text-[#8C5FA8]">{stats.members}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8C5FA8] font-semibold mt-0.5">Membres</div>
        </div>
        <div className="bg-white rounded-xl border border-[#5B7052]/30 p-4">
          <div className="text-2xl font-bold text-[#5B7052]">{stats.messages}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#5B7052] font-semibold mt-0.5">Messages</div>
        </div>
      </div>

      {/* Canaux par communauté */}
      {channels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <MessageSquare className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">Aucun canal créé pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byCommunity).map(([communityName, items]) => (
            <div key={communityName} className="bg-white rounded-2xl border border-[#8A8378]/15 overflow-hidden">
              {/* En-tête communauté */}
              <div className="px-5 py-3 bg-gradient-to-r from-[#2A0E3D]/5 to-transparent border-b border-[#8A8378]/10 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2A0E3D]" />
                <h2 className="font-bold text-sm text-[#1E0F2B]">{communityName}</h2>
                <span className="text-xs text-[#8A8378]">· {items.length} canal(aux)</span>
              </div>

              {/* Liste canaux */}
              <div className="divide-y divide-[#8A8378]/10">
                {items.map((c) => {
                  const config = CHANNEL_CONFIG[c.type as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.TEXT;
                  const Icon = config.icon;

                  return (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#FAF6EF] transition-colors group">
                      {/* Icon type */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${config.color}15` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: config.color }} />
                      </div>

                      {/* Contenu */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#1E0F2B]">{c.name}</h3>
                          {c.isEncrypted && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A227]/15 text-[#A3821C] border border-[#C9A227]/30">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              E2E
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <p className="text-xs text-[#8A8378] line-clamp-1 mt-0.5">{c.description}</p>
                        )}
                      </div>

                      {/* Badge type */}
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                        style={{ background: `${config.color}15`, color: config.color }}
                      >
                        {config.label}
                      </span>

                      {/* Stats */}
                      <div className="flex items-center gap-3 text-[11px] text-[#8A8378] flex-shrink-0">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {c._count.members}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {c._count.messages}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1  flex-shrink-0">
                        <Link
                          href={`/admin/channels/${c.id}/edit`}
                          className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                          aria-label="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <DeleteButton entity="channels" id={c.id} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
