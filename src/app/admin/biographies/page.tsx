import { db } from "@/lib/db";
import Link from "next/link";
import { Pencil, BookOpen, Calendar, Quote, Crown } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { NewBiographyButton } from "@/components/admin/create-buttons";

export const dynamic = "force-dynamic";

export default async function AdminBiographiesPage() {
  const [biographies, servants] = await Promise.all([
    db.biography.findMany({
      orderBy: [{ servantId: "asc" }, { order: "asc" }],
      include: { servant: true },
    }),
    db.servant.findMany({
      where: { isActive: true },
      select: { id: true, shortName: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  // Grouper par serviteur
  const byServant = biographies.reduce((acc, b) => {
    const key = b.servant.shortName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {} as Record<string, typeof biographies>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Frises chronologiques
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            Biographies
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            {biographies.length} jalon{biographies.length > 1 ? "s" : ""} biographique{biographies.length > 1 ? "s" : ""} au total.
          </p>
        </div>
        <NewBiographyButton servants={servants} accentColor="#C9A227" />
      </div>

      {/* Sections par serviteur */}
      <div className="space-y-6">
        {Object.entries(byServant).map(([servantName, items]) => {
          const isPam = items[0]?.servant.code === "pam";
          const accentColor = isPam ? "#C9A227" : "#8C5FA8";

          return (
            <div key={servantName} className="bg-white rounded-2xl border border-[#8A8378]/15 overflow-hidden">
              {/* En-tête section serviteur */}
              <div
                className="px-6 py-4 flex items-center justify-between border-b border-[#8A8378]/10"
                style={{ background: `linear-gradient(90deg, ${accentColor}10 0%, transparent 100%)` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${accentColor}20` }}
                  >
                    {isPam ? <Crown className="w-4 h-4 text-[#C9A227]" /> : <BookOpen className="w-4 h-4 text-[#8C5FA8]" />}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1E0F2B]">{servantName}</h2>
                    <p className="text-xs text-[#8A8378]">{items.length} jalon{items.length > 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Ligne verticale */}
                <div
                  className="absolute left-[34px] top-0 bottom-0 w-0.5"
                  style={{ background: `linear-gradient(to bottom, ${accentColor}40, ${accentColor}10)` }}
                />

                <div className="space-y-1">
                  {items.map((b) => (
                    <div
                      key={b.id}
                      className="relative flex items-start gap-4 px-6 py-4 hover:bg-[#FAF6EF] transition-colors group"
                    >
                      {/* Point timeline */}
                      <div
                        className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 flex-shrink-0 bg-white"
                        style={{ borderColor: accentColor }}
                      >
                        <span className="text-[10px] font-bold" style={{ color: accentColor }}>{b.order}</span>
                      </div>

                      {/* Contenu */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3 h-3 text-[#8A8378]" />
                          <span className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: accentColor }}>
                            {b.date}
                          </span>
                        </div>
                        <p className="font-bold text-sm text-[#1E0F2B] leading-tight">
                          {b.title}
                        </p>
                        {b.description && (
                          <p className="text-xs text-[#1E0F2B]/70 mt-1 line-clamp-2 leading-relaxed">
                            {b.description}
                          </p>
                        )}
                        {b.verseRef && (
                          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#8A8378] italic">
                            <Quote className="w-3 h-3 flex-shrink-0" />
                            <span>{b.verseRef}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ">
                        <Link
                          href={`/admin/biographies/${b.id}/edit`}
                          className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                          aria-label="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <DeleteButton entity="biographies" id={b.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {biographies.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
            <BookOpen className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
            <p className="text-sm text-[#8A8378] italic">Aucune biographie enregistrée pour l&apos;instant.</p>
          </div>
        )}
      </div>
    </div>
  );
}
