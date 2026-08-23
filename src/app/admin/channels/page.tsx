import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, Lock, Hash, Volume2, Megaphone } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

const CHANNEL_ICONS = {
  TEXT: Hash,
  VOICE: Volume2,
  VIDEO: Volume2,
  ANNOUNCEMENT: Megaphone,
  RESTRICTED: Lock,
};

export default async function AdminChannelsPage() {
  const channels = await db.channel.findMany({
    orderBy: [{ communityId: "asc" }, { order: "asc" }],
    include: {
      community: true,
      _count: { select: { messages: true, members: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
            Canaux
          </h1>
          <p className="text-sm text-stone">
            Canaux de communauté organisés par type.
          </p>
        </div>
        <Link
          href="/admin/channels/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-ink text-sm font-semibold hover:bg-gold-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau canal
        </Link>
      </div>

      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-imperial text-ivory">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Canal</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Type</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Communauté</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Membres</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Chiffré</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => {
              const Icon = CHANNEL_ICONS[c.type];
              return (
                <tr key={c.id} className="border-b border-stone/15 hover:bg-gold/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-stone flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-ink">{c.name}</p>
                        <p className="text-xs text-stone line-clamp-1">{c.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-stone">
                      {c.type === "TEXT" ? "Texte" : c.type === "VOICE" ? "Voix" : c.type === "VIDEO" ? "Vidéo" : c.type === "ANNOUNCEMENT" ? "Annonce" : "Restreint"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone">{c.community.name}</td>
                  <td className="px-4 py-3 text-xs text-stone">{c._count.members}</td>
                  <td className="px-4 py-3">
                    {c.isEncrypted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gold/15 text-gold-dark">
                        <Lock className="w-2.5 h-2.5" /> E2E
                      </span>
                    ) : (
                      <span className="text-xs text-stone">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/channels/${c.id}/edit`}
                        className="p-2 rounded hover:bg-gold/10 text-stone hover:text-gold transition-colors"
                        aria-label="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <DeleteButton entity="channels" id={c.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
