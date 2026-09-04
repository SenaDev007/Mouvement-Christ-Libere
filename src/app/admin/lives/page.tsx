import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Radio, Calendar, Clock, Video, Crown, ExternalLink } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { NewLiveButton } from "@/components/admin/new-live-modal";
import { EditLiveModal } from "@/components/admin/edit-live-modal";
import { LiveQuickActions } from "@/components/admin/live-quick-actions";

export const dynamic = "force-dynamic";

const STATUS_CONFIG = {
  LIVE: { label: "EN DIRECT", color: "bg-red-600 text-white", pulse: true },
  SCHEDULED: { label: "Programmé", color: "bg-[#C9A227]/15 text-[#A3821C] border border-[#C9A227]/30", pulse: false },
  ENDED: { label: "Terminé", color: "bg-gray-100 text-gray-500", pulse: false },
  CANCELLED: { label: "Annulé", color: "bg-red-100 text-red-700", pulse: false },
};

export default async function AdminLivesPage() {
  const [lives, servants] = await Promise.all([
    db.liveStream.findMany({
      orderBy: { scheduledAt: "desc" },
      include: { servant: true },
    }),
    db.servant.findMany({
      where: { isActive: true },
      select: { id: true, shortName: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  // Stats
  const now = new Date();
  const stats = {
    total: lives.length,
    live: lives.filter((l) => l.status === "LIVE").length,
    upcoming: lives.filter((l) => l.status === "SCHEDULED" && l.scheduledAt > now).length,
    ended: lives.filter((l) => l.status === "ENDED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Sessions de streaming
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            Lives
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Sessions programmées et passées.
          </p>
        </div>
        <NewLiveButton servants={servants} accentColor="#C9A227" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-[#1E0F2B]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-red-200/50 p-4">
          <div className="text-2xl font-bold text-red-600">{stats.live}</div>
          <div className="text-[10px] uppercase tracking-wider text-red-600 font-semibold mt-0.5">En direct</div>
        </div>
        <div className="bg-white rounded-xl border border-[#C9A227]/30 p-4">
          <div className="text-2xl font-bold text-[#A3821C]">{stats.upcoming}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#A3821C] font-semibold mt-0.5">À venir</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-gray-500">{stats.ended}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">Terminés</div>
        </div>
      </div>

      {/* Liste */}
      {lives.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <Radio className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">Aucun live programmé pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {lives.map((l) => {
            const status = STATUS_CONFIG[l.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.SCHEDULED;
            const isPam = l.servant.code === "pam";
            const accentColor = isPam ? "#C9A227" : "#8C5FA8";
            const isUpcoming = l.status === "SCHEDULED" && l.scheduledAt > now;

            return (
              <div
                key={l.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 p-4 hover:border-[#C9A227]/30 hover:shadow-md transition-all group min-w-0"
              >
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                    style={{ background: `${accentColor}15` }}
                  >
                    <Radio className="w-4 h-4" style={{ color: accentColor }} />
                    {status.pulse && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1 basis-[min(100%,16rem)]">
                    <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                      <h3 className="font-bold text-sm text-[#1E0F2B] min-w-0 break-words">{l.title}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ${status.color} ${status.pulse ? "animate-pulse" : ""}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[11px] text-[#8A8378] mt-2 flex-wrap">
                      <span className="font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                        {l.servant.shortName}
                      </span>
                      <span className="text-[#8A8378]/40">·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(l.scheduledAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(l.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isUpcoming && (
                        <>
                          <span className="text-[#8A8378]/40">·</span>
                          <span className="text-[#5B7052] font-semibold">
                            dans {Math.ceil((l.scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} jour(s)
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions — repassent sous le contenu quand elles ne tiennent pas */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {(l.status === "SCHEDULED" || l.status === "LIVE") && (
                      <Link
                        href={`/admin/lives/${l.id}/studio`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-xs font-bold hover:bg-[#3D1A54] transition-colors"
                        title="Aller au studio"
                      >
                        <Video className="w-3 h-3" />
                        Studio
                      </Link>
                    )}
                    {l.status === "LIVE" && (
                      <Link
                        href={`/live/${l.id}`}
                        target="_blank"
                        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                        aria-label="Voir le live"
                        title="Voir sur le site"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    <LiveQuickActions liveId={l.id} status={l.status} />
                    <EditLiveModal liveId={l.id} servants={servants} />
                    <DeleteButton entity="lives" id={l.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
