import { db } from "@/lib/db";
import Link from "next/link";
import { Pencil, BookOpen, Clock, Tag, GraduationCap } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { NewTeachingButton } from "@/components/admin/create-buttons";

export const dynamic = "force-dynamic";

const LEVEL_CONFIG = {
  DECOUVERTE: { label: "Découverte", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  INTERMEDIAIRE: { label: "Intermédiaire", color: "bg-[#C9A227]/15 text-[#A3821C] border-[#C9A227]/30" },
  AVANCE: { label: "Avancé", color: "bg-[#8C5FA8]/15 text-[#8C5FA8] border-[#8C5FA8]/30" },
};

export default async function AdminTeachingsPage() {
  const [teachings, servants] = await Promise.all([
    db.teaching.findMany({
      orderBy: { createdAt: "desc" },
      include: { servant: true },
    }),
    db.servant.findMany({
      where: { isActive: true },
      select: { id: true, shortName: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  // Stats par niveau
  const stats = {
    total: teachings.length,
    decouverte: teachings.filter((t) => t.level === "DECOUVERTE").length,
    intermediaire: teachings.filter((t) => t.level === "INTERMEDIAIRE").length,
    avance: teachings.filter((t) => t.level === "AVANCE").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Études bibliques
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            Enseignements
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Études classées par thème, livre et niveau.
          </p>
        </div>
        <NewTeachingButton servants={servants} accentColor="#C9A227" />
      </div>

      {/* Stats par niveau */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-[#1E0F2B]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200/50 p-4">
          <div className="text-2xl font-bold text-emerald-700">{stats.decouverte}</div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mt-0.5">Découverte</div>
        </div>
        <div className="bg-white rounded-xl border border-[#C9A227]/30 p-4">
          <div className="text-2xl font-bold text-[#A3821C]">{stats.intermediaire}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#A3821C] font-semibold mt-0.5">Intermédiaire</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8C5FA8]/30 p-4">
          <div className="text-2xl font-bold text-[#8C5FA8]">{stats.avance}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8C5FA8] font-semibold mt-0.5">Avancé</div>
        </div>
      </div>

      {/* Liste */}
      {teachings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <BookOpen className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">Aucun enseignement enregistré pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {teachings.map((t) => {
            const level = LEVEL_CONFIG[t.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.DECOUVERTE;
            const isPam = t.servant.code === "pam";
            const accentColor = isPam ? "#C9A227" : "#8C5FA8";

            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 p-4 hover:border-[#C9A227]/30 hover:shadow-md transition-all group min-w-0"
              >
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accentColor}15` }}
                  >
                    <BookOpen className="w-4 h-4" style={{ color: accentColor }} />
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1 basis-[min(100%,16rem)]">
                    <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-sm text-[#1E0F2B] leading-tight min-w-0 break-words">{t.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${level.color}`}>
                        <GraduationCap className="w-2.5 h-2.5" />
                        {level.label}
                      </span>
                    </div>

                    {t.excerpt && (
                      <p className="text-xs text-[#8A8378] line-clamp-2 mt-1 leading-relaxed">{t.excerpt}</p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-2 text-[11px] text-[#8A8378] mt-2 flex-wrap">
                      <span className="font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                        {t.servant.shortName}
                      </span>
                      {t.theme && (
                        <>
                          <span className="text-[#8A8378]/40">·</span>
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {t.theme}
                          </span>
                        </>
                      )}
                      <span className="text-[#8A8378]/40">·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ">
                    <Link
                      href={`/admin/teachings/${t.id}/edit`}
                      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton entity="teachings" id={t.id} />
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
