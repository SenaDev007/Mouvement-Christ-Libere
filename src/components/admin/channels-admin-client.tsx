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
        <div className="fixed top-6 right-6 z-[200] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-[#3D1A54] text-[#FAF6EF] shadow-2xl border border-[#C9A227]/40 max-w-sm animate-[toastIn_.25s_ease-out]">
          <CheckCircle2 className="w-5 h-5 text-[#C9A227] flex-shrink-0" />
          <p className="text-sm font-semibold">{toast}</p>
          <button onClick={() => setToast("")} className="p-1 hover:bg-[#1A0826]/10 rounded-lg ml-1" aria-label="Fermer">
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
          <p className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-1">
            Espaces de communauté
          </p>
          <h1 className="text-2xl md:text-3xl font-bold font-serif text-[#FAF6EF]">
            Canaux
          </h1>
          <p className="text-sm text-[#BDB4C9] mt-1">
            Synchronisés en direct avec Yeshua Connect — canaux, groupes et salons vocaux.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#FAF6EF] text-sm font-bold hover:bg-[#DDBE55] transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          Nouveau canal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4">
          <div className="text-2xl font-bold font-serif text-[#FAF6EF]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#BDB4C9] font-semibold mt-0.5">Canaux</div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl border border-[#C9A227]/40 shadow-lg p-4">
          <div className="text-2xl font-bold text-[#DDBE55]">{stats.encrypted}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#DDBE55] font-semibold mt-0.5">Chiffrés E2E</div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#8C5FA8]/30 p-4">
          <div className="text-2xl font-bold text-[#C9AEE3]">{stats.members}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#C9AEE3] font-semibold mt-0.5">Membres</div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#5B7052]/30 p-4">
          <div className="text-2xl font-bold text-[#A3C9B0]">{stats.messages}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#A3C9B0] font-semibold mt-0.5">Messages</div>
        </div>
      </div>

      {/* Canaux par communauté */}
      {channels.length === 0 ? (
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-dashed border-[#C9A227]/30 p-12 text-center">
          <MessageSquare className="w-10 h-10 text-[#FAF6EF]/20 mx-auto mb-3" />
          <p className="text-sm text-[#BDB4C9] italic">Aucun canal créé pour l&apos;instant.</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A227] text-[#FAF6EF] text-sm font-bold hover:bg-[#DDBE55] transition-colors"
          >
            <Plus className="w-4 h-4" /> Créer le premier canal
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byCommunity).map(([communityName, items]) => (
            <div key={communityName} className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 overflow-hidden">
              {/* En-tête communauté */}
              <div className="px-5 py-3 bg-gradient-to-r from-[#2A0E3D]/5 to-transparent border-b border-[#C9A227]/10 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#DDBE55]" />
                <h2 className="font-bold text-sm text-[#FAF6EF]">{communityName}</h2>
                <span className="text-xs text-[#BDB4C9]">· {items.length} canal(aux)</span>
              </div>

              {/* Liste canaux */}
              <div className="divide-y divide-[#C9A227]/10">
                {items.map((c) => {
                  const config = CHANNEL_CONFIG[c.type as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.TEXT;
                  const Icon = config.icon;

                  return (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#C9A227]/10 transition-colors group">
                      {/* Avatar (photo du canal ⭐ V2.5) */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-[#3D1A54] text-white font-bold text-sm">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <Icon className="w-4 h-4" style={{ color: "#C9A227" }} />
                        )}
                      </div>

                      {/* Contenu */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#FAF6EF]">{c.name}</h3>
                          {c.isEncrypted && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A227]/15 text-[#DDBE55] border border-[#C9A227]/30">
                              E2E
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <p className="text-xs text-[#BDB4C9] line-clamp-1 mt-0.5">{c.description}</p>
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
                      <div className="flex items-center gap-3 text-[11px] text-[#BDB4C9] flex-shrink-0">
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
                          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[#C9A227]/10 text-[#BDB4C9] hover:text-[#C9A227] transition-colors"
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
