import { db } from "@/lib/db";
import Link from "next/link";
import { Pencil, FileText, Clock, Eye, EyeOff, Archive, Sparkles } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { NewTestimonyButton } from "@/components/admin/create-buttons";

export const dynamic = "force-dynamic";

const STATUS_CONFIG = {
  CONFIRMED: { label: "Confirmé", icon: Eye, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  TO_DISCERN: { label: "À discerner", icon: Sparkles, color: "bg-[#C9A227]/15 text-[#A3821C] border-[#C9A227]/30" },
  ARCHIVED: { label: "Archivé", icon: Archive, color: "bg-gray-100 text-gray-500 border-gray-200" },
};

export default async function AdminTestimoniesPage() {
  const [testimonies, servants] = await Promise.all([
    db.testimony.findMany({
      orderBy: { createdAt: "desc" },
      include: { servant: true },
    }),
    db.servant.findMany({
      where: { isActive: true },
      select: { id: true, shortName: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  // Stats rapides
  const stats = {
    total: testimonies.length,
    confirmed: testimonies.filter((t) => t.status === "CONFIRMED").length,
    toDiscern: testimonies.filter((t) => t.status === "TO_DISCERN").length,
    archived: testimonies.filter((t) => t.status === "ARCHIVED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Récits & expériences spirituelles
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            Témoignages
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Gestion et modération des témoignages.
          </p>
        </div>
        <NewTestimonyButton servants={servants} accentColor="#C9A227" />
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-[#1E0F2B]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200/50 p-4">
          <div className="text-2xl font-bold text-emerald-700">{stats.confirmed}</div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mt-0.5">Confirmés</div>
        </div>
        <div className="bg-white rounded-xl border border-[#C9A227]/30 p-4">
          <div className="text-2xl font-bold text-[#A3821C]">{stats.toDiscern}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#A3821C] font-semibold mt-0.5">À discerner</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-gray-500">{stats.archived}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">Archivés</div>
        </div>
      </div>

      {/* Liste des témoignages */}
      {testimonies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <FileText className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">Aucun témoignage enregistré pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {testimonies.map((t) => {
            const status = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.TO_DISCERN;
            const StatusIcon = status.icon;
            const isPam = t.servant.code === "pam";
            const accentColor = isPam ? "#C9A227" : "#8C5FA8";

            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 p-4 hover:border-[#C9A227]/30 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Icon serviteur */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accentColor}15` }}
                  >
                    <FileText className="w-4 h-4" style={{ color: accentColor }} />
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-[#1E0F2B] truncate">{t.title}</h3>
                        {t.short && (
                          <p className="text-xs text-[#8A8378] line-clamp-1 mt-0.5">{t.short}</p>
                        )}
                      </div>
                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border flex-shrink-0 ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[11px] text-[#8A8378] mt-2">
                      <span
                        className="font-bold uppercase tracking-wider"
                        style={{ color: accentColor }}
                      >
                        {t.servant.shortName}
                      </span>
                      {t.publishedAt && (
                        <>
                          <span className="text-[#8A8378]/40">·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(t.publishedAt).toLocaleDateString("fr-FR")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ">
                    <Link
                      href={`/admin/testimonies/${t.id}/edit`}
                      className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton entity="testimonies" id={t.id} />
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
