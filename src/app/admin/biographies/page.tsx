import { db } from "@/lib/db";
import { BookOpen, Calendar, Quote, Crown, Image as ImageIcon } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { NewBiographyButton } from "@/components/admin/create-buttons";
// ⭐ V3.47 — bouton stylo → MODAL professionnel (photo du jalon + photo de
// biographie publique incluses) au lieu de la page /edit.
import { BiographyEditButton } from "@/components/admin/biography-modal";
// ⭐ V3.47 — colonne Biography.photoUrl : le findMany ci-dessous la
// sélectionne → garde avant lecture (pattern V3.46).
import { ensureBiographyPhotoColumn } from "@/lib/ensure-schema";

export const dynamic = "force-dynamic";

export default async function AdminBiographiesPage() {
  await ensureBiographyPhotoColumn().catch(() => {});
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
          <p className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-1">
            Frises chronologiques
          </p>
          <h1 className="text-2xl md:text-3xl font-bold font-serif text-[#FAF6EF]">
            Biographies
          </h1>
          <p className="text-sm text-[#BDB4C9] mt-1">
            {biographies.length} jalon{biographies.length > 1 ? "s" : ""} biographique{biographies.length > 1 ? "s" : ""} au total.
          </p>
        </div>
        <NewBiographyButton servants={servants} accentColor="#C9A227" />
      </div>

      {/* Sections par serviteur */}
      <div className="space-y-6">
        {Object.entries(byServant).map(([servantName, items]) => {
          const isAfrika = items[0]?.servant.code === "afrika";
          const accentColor = isAfrika ? "#C9A227" : "#8C5FA8";

          return (
            <div key={servantName} className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 overflow-hidden">
              {/* En-tête section serviteur */}
              <div
                className="px-6 py-4 flex items-center justify-between border-b border-[#C9A227]/10"
                style={{ background: `linear-gradient(90deg, ${accentColor}10 0%, transparent 100%)` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${accentColor}20` }}
                  >
                    {isAfrika ? <Crown className="w-4 h-4 text-[#C9A227]" /> : <BookOpen className="w-4 h-4 text-[#C9AEE3]" />}
                  </div>
                  <div>
                    <h2 className="text-base font-bold font-serif text-[#FAF6EF]">{servantName}</h2>
                    <p className="text-xs text-[#BDB4C9]">{items.length} jalon{items.length > 1 ? "s" : ""}</p>
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
                      className="relative flex items-start gap-4 px-6 py-4 hover:bg-[#C9A227]/10 transition-colors group"
                    >
                      {/* Point timeline */}
                      <div
                        className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 flex-shrink-0 bg-[#1A0826]/70"
                        style={{ borderColor: accentColor }}
                      >
                        <span className="text-[10px] font-bold" style={{ color: accentColor }}>{b.order}</span>
                      </div>

                      {/* Contenu */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          {/* ⭐ V3.47 — miniature de la photo du jalon (si présente) */}
                          {b.photoUrl && (
                            <div className="w-20 h-[50px] rounded-lg border-2 flex-shrink-0 overflow-hidden bg-[#3D1A54] shadow-sm" style={{ borderColor: `${accentColor}55` }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={b.photoUrl} alt={b.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="w-3 h-3 text-[#BDB4C9]" />
                              <span className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: accentColor }}>
                                {b.date}
                              </span>
                              {b.photoUrl && (
                                <ImageIcon className="w-3 h-3 text-[#C9A227]" aria-label="Jalon illustré" />
                              )}
                            </div>
                            <p className="font-bold text-sm text-[#FAF6EF] leading-tight">
                              {b.title}
                            </p>
                            {b.description && (
                              <p className="text-xs text-[#FAF6EF]/70 mt-1 line-clamp-2 leading-relaxed">
                                {b.description}
                              </p>
                            )}
                            {b.verseRef && (
                              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#BDB4C9] italic">
                                <Quote className="w-3 h-3 flex-shrink-0" />
                                <span>{b.verseRef}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ">
                        {/* ⭐ V3.47 — stylo → modal professionnel (plus de page /edit) */}
                        <BiographyEditButton
                          biography={{
                            id: b.id,
                            servantId: b.servantId,
                            date: b.date,
                            title: b.title,
                            description: b.description,
                            verseRef: b.verseRef,
                            verseText: b.verseText,
                            photoUrl: b.photoUrl,
                            order: b.order,
                          }}
                          servants={servants}
                          accentColor={accentColor}
                        />
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
          <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-dashed border-[#C9A227]/30 p-12 text-center">
            <BookOpen className="w-10 h-10 text-[#FAF6EF]/20 mx-auto mb-3" />
            <p className="text-sm text-[#BDB4C9] italic">Aucune biographie enregistrée pour l&apos;instant.</p>
          </div>
        )}
      </div>
    </div>
  );
}
