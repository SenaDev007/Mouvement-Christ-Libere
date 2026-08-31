"use client";

/**
 * ⭐ V2.5 — Client du module Canaux du back-office.
 *
 * - Bouton « Nouveau canal » → modal professionnel (ChannelFormModal),
 *   plus de page /new plein écran
 * - Bouton crayon par canal → modal d'édition (mêmes champs + photo)
 * - Toast de confirmation après création/modification
 * - Synchronisation : les canaux créés/modifiés ici apparaissent
 *   automatiquement dans Yeshua Connect (même table Channel — la liste
 *   des conversations de la messagerie lit directement db.channel)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Lock, Hash, Volume2, Megaphone, Users, MessageSquare, CheckCircle2, X } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { ChannelFormModal, type ChannelLite } from "@/components/admin/channel-form-modal";
import type { CommunityLite } from "@/components/admin/channel-form-modal";

const CHANNEL_CONFIG = {
  TEXT: { label: "Texte", icon: Hash, color: "#5B7052" },
  VOICE: { label: "Voix", icon: Volume2, color: "#8C5FA8" },
  VIDEO: { label: "Vidéo", icon: Volume2, color: "#C9A227" },
  ANNOUNCEMENT: { label: "Annonce", icon: Megaphone, color: "#A3821C" },
  RESTRICTED: { label: "Restreint", icon: Lock, color: "#DC2626" },
};

export interface AdminChannelItem {
  id: string;
  name: string;
  description?: string | null;
  communityId: string;
  communityName: string;
  type: string;
  isEncrypted: boolean;
  isRestricted: boolean;
  order: number;
  avatarUrl?: string | null;
  memberCount: number;
  messageCount: number;
}

interface ChannelsAdminClientProps {
  channels: AdminChannelItem[];
  communities: CommunityLite[];
}

export function ChannelsAdminClient({ channels, communities }: ChannelsAdminClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editChannel, setEditChannel] = useState<ChannelLite | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  };

  // Stats
  const stats = {
    total: channels.length,
    encrypted: channels.filter((c) => c.isEncrypted).length,
    members: channels.reduce((sum, c) => sum + c.memberCount, 0),
    messages: channels.reduce((sum, c) => sum + c.messageCount, 0),
  };

  // Grouper par communauté
  const byCommunity = channels.reduce((acc, c) => {
    const key = c.communityName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, AdminChannelItem[]>);

  return (
    <div className="space-y-6">
      {/* Toast de confirmation (⭐ V2.5) */}
      {toast && (
        <div className="fixed top-6 right-6 z-[200] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-[#1E0F2B] text-[#FAF6EF] shadow-2xl border border-[#C9A227]/40 max-w-sm animate-[toastIn_.25s_ease-out]">
          <CheckCircle2 className="w-5 h-5 text-[#C9A227] flex-shrink-0" />
          <p className="text-sm font-semibold">{toast}</p>
          <button onClick={() => setToast("")} className="p-1 hover:bg-white/10 rounded-lg ml-1" aria-label="Fermer">
            <X className="w-3.5 h-3.5 text-[#FAF6EF]/60" />
          </button>
          <style jsx>{`
            @keyframes toastIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

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
            Synchronisés en direct avec Yeshua Connect — canaux, groupes et salons vocaux.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          Nouveau canal
        </button>
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
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] transition-colors"
          >
            <Plus className="w-4 h-4" /> Créer le premier canal
          </button>
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
                      {/* Avatar (photo du canal ⭐ V2.5) */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-[#2A0E3D] text-white font-bold text-sm">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <Icon className="w-4 h-4" style={{ color: "#C9A227" }} />
                        )}
                      </div>

                      {/* Contenu */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#1E0F2B]">{c.name}</h3>
                          {c.isEncrypted && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A227]/15 text-[#A3821C] border border-[#C9A227]/30">
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
                          {c.memberCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {c.messageCount}
                        </span>
                      </div>

                      {/* Actions — ⭐ V2.5 : édition en modal */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() =>
                            setEditChannel({
                              id: c.id,
                              name: c.name,
                              description: c.description,
                              communityId: c.communityId,
                              type: c.type,
                              isEncrypted: c.isEncrypted,
                              isRestricted: c.isRestricted,
                              order: c.order,
                              avatarUrl: c.avatarUrl,
                            })
                          }
                          className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                          aria-label={`Modifier ${c.name}`}
                          title="Modifier (photo, nom, type…)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
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

      {/* Modal création (⭐ V2.5 — remplace la page /new) */}
      <ChannelFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        communities={communities}
        onSaved={showToast}
      />

      {/* Modal édition (⭐ V2.5 — remplace la page /edit) */}
      {editChannel && (
        <ChannelFormModal
          open={!!editChannel}
          onClose={() => setEditChannel(null)}
          communities={communities}
          channel={editChannel}
          onSaved={showToast}
        />
      )}
    </div>
  );
}
