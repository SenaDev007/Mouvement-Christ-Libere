"use client";

import { motion } from "framer-motion";
import { Sun, Cloud, Snowflake } from "lucide-react";
import type { AnneeBibliqueData, JourBiblique, Fete } from "./calendrier-app";
import { JOURS_SEMAINE_HEBREU, jourSemaineHebreu } from "@/lib/calendrier/jours-semaine-hebreu";
import { cn } from "@/lib/utils";

interface VueAnnuelleProps {
  annee: AnneeBibliqueData;
}

// Configuration des trimestres : nom, icône, couleur, image saisonnière
const NOMS_TRIMESTRES = [
  {
    nom: "Trimestre 1 — Printemps",
    icon: Sun,
    color: "#C9A227",
    mois: [1, 2, 3],
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.92) 0%, rgba(42,14,61,0.7) 50%, rgba(201,162,39,0.35) 100%)",
  },
  {
    nom: "Trimestre 2 — Été",
    icon: Sun,
    color: "#5B7052",
    mois: [4, 5, 6],
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.88) 0%, rgba(201,162,39,0.45) 50%, rgba(42,14,61,0.72) 100%)",
  },
  {
    nom: "Trimestre 3 — Automne",
    icon: Cloud,
    color: "#8C5FA8",
    mois: [7, 8, 9],
    image: "https://images.unsplash.com/photo-1507371341162-763b5e419408?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.88) 0%, rgba(124,92,184,0.4) 50%, rgba(156,126,30,0.5) 100%)",
  },
  {
    nom: "Trimestre 4 — Hiver",
    icon: Snowflake,
    color: "#8A8378",
    mois: [10, 11, 12],
    image: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.92) 0%, rgba(250,246,239,0.25) 50%, rgba(42,14,61,0.78) 100%)",
  },
];

const NOMS_MOIS = [
  "Aviv", "Ziv", "Sivan", "Tammouz", "Av", "Éloul",
  "Éthanim", "Boul", "Kislev", "Tévet", "Shevat", "Adar",
];

// ⭐ V3.7 — Noms des jours : table partagée (français + hébreu +
// translittération « Yom Rishon…Yom Shabbat »). Les en-têtes de colonnes
// des mini-mois montrent l'abréviation française + la translittération
// courte ; le bandeau « La semaine hébraïque » en tête de vue donne la
// translittération COMPLÈTE des 7 jours (Genèse 1 : « jour un », « jour
// deux »… le septième, Shabbat).
const NOMS_JOURS = JOURS_SEMAINE_HEBREU;

export function VueAnnuelle({ annee }: VueAnnuelleProps) {
  // Map des fêtes par jour de l'année
  const fetesParJour = new Map<number, Fete>();
  for (const fete of annee.fetes) {
    const jourCorrespondant = annee.jours.find((j) => {
      const dateGreg = new Date(j.dateGregorienne);
      const dateFete = new Date(fete.dateGregorienne);
      return dateGreg.getTime() === dateFete.getTime();
    });
    if (jourCorrespondant) {
      fetesParJour.set(jourCorrespondant.jourDeAnnee, fete);
    }
  }

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        {/* Légende */}
        <div className="flex flex-wrap items-center gap-4 text-xs bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#8A8378]/15 p-3">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E0F2B]">
            <span className="w-3 h-3 rounded bg-[#C9A227]" />
            Fête de l&apos;Éternel
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E0F2B]">
            <span className="w-3 h-3 rounded bg-[#2A0E3D]/30" />
            Shabbat hebdomadaire
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E0F2B]">
            <span className="w-3 h-3 rounded border-2 border-[#C9A227] bg-[#FAF6EF]" />
            Jour en cours
          </span>
        </div>

        {/* ⭐ V3.7 — LA SEMAINE HÉBRAÏQUE : translittération complète des
            noms des jours (Yom Rishon → Yom Shabbat), visible en toute
            taille d'écran — sur la page publique du calendrier biblique ET
            dans le calendrier intégré de Yeshua Connect (composant partagé). */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#8A8378]/15 p-4">
          <p className="text-[10px] font-bold text-[#8A8378] uppercase tracking-wider mb-3 text-center">
            La semaine hébraïque — du premier jour au jour du Shabbat
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {JOURS_SEMAINE_HEBREU.map((jour) => {
              const estShabbat = jour.numero === 7;
              return (
                <div
                  key={jour.numero}
                  title={`${jour.fr} · ${jour.hebreuNiqoud} (${jour.translit})`}
                  className={cn(
                    "text-center px-1.5 py-2 rounded-lg border min-w-0",
                    estShabbat
                      ? "bg-[#C9A227]/15 border-[#C9A227]/45"
                      : "bg-[#FAF6EF] border-[#8A8378]/12",
                  )}
                >
                  <div
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wide",
                      estShabbat ? "text-[#8C5FA8]" : "text-[#8A8378]",
                    )}
                  >
                    {jour.fr}
                  </div>
                  <div className="text-[11px] font-bold text-[#1E0F2B] mt-1 leading-tight">
                    {jour.translit}
                  </div>
                  <div
                    dir="rtl"
                    className={cn(
                      "text-[10px] font-serif mt-0.5 leading-tight",
                      estShabbat ? "text-[#8C5FA8]" : "text-[#8A8378]",
                    )}
                  >
                    {jour.hebreu}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {NOMS_TRIMESTRES.map((trimestre, tIdx) => {
        const Icon = trimestre.icon;
        const joursT = annee.jours.filter((j) => j.trimestre === tIdx + 1);

        return (
          <motion.div
            key={tIdx}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: tIdx * 0.1 }}
            className="relative rounded-2xl overflow-hidden shadow-xl border border-[#8A8378]/20"
            style={{
              backgroundImage: `url(${trimestre.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Overlay saisonnier pour la lisibilité */}
            <div className="absolute inset-0" style={{ background: trimestre.overlay }} />

            {/* Contenu */}
            <div className="relative z-10 p-6 md:p-8">
              {/* Header trimestre */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#FAF6EF]/20">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-sm"
                  style={{ backgroundColor: `${trimestre.color}25` }}
                >
                  <Icon className="w-6 h-6" style={{ color: trimestre.color }} />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#FAF6EF] drop-shadow-lg">
                    {trimestre.nom}
                  </h3>
                  <p className="text-xs text-[#FAF6EF]/80 font-semibold uppercase tracking-wider">
                    91 jours · 13 semaines
                  </p>
                </div>
              </div>

              {/* 3 mois du trimestre — séparés visiblement */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {trimestre.mois.map((numMois) => {
                  const joursMois = joursT.filter((j) => j.mois === numMois);
                  const fetesMois = annee.fetes.filter((f) => {
                    const jc = annee.jours.find((j) => {
                      const d1 = new Date(j.dateGregorienne);
                      const d2 = new Date(f.dateGregorienne);
                      return d1.getTime() === d2.getTime();
                    });
                    return jc?.mois === numMois;
                  });

                  return (
                    <div key={numMois} className="bg-[#FAF6EF]/95 backdrop-blur-sm rounded-xl p-4">
                      {/* Nom du mois */}
                      <h4 className="font-serif text-lg font-bold text-[#1E0F2B] text-center mb-1">
                        {NOMS_MOIS[numMois - 1]}
                      </h4>
                      <p className="text-[10px] text-[#8A8378] text-center mb-4 font-semibold uppercase tracking-wider">
                        {joursMois.length} jours
                      </p>

                      {/* En-tête jours — ⭐ V3.7 : abréviation française +
                          translittération hébraïque (Yom Rishon…Yom
                          Shabbat, forme courte pour la grille compacte ;
                          la forme complète figure dans le bandeau
                          « La semaine hébraïque » et dans l'infobulle). */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {NOMS_JOURS.map((jour, i) => {
                          const estShabbat = jour.numero === 7;
                          return (
                            <div
                              key={i}
                              title={`${jour.fr} · ${jour.hebreuNiqoud} (${jour.translit})`}
                              className={cn(
                                "text-center py-1 rounded min-w-0",
                                estShabbat
                                  ? "bg-[#2A0E3D]/10 text-[#2A0E3D]"
                                  : "text-[#8A8378]"
                              )}
                            >
                              <div className="text-[9px] font-bold leading-none">
                                {jour.frAbbr}
                              </div>
                              <div
                                className={cn(
                                  "text-[8px] font-semibold mt-0.5 leading-tight truncate",
                                  estShabbat ? "text-[#8C5FA8]" : "text-[#8A8378]/75"
                                )}
                              >
                                {jour.translit.replace(/^Yom\s+/, "")}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Jours du mois */}
                      <div className="grid grid-cols-7 gap-1">
                        {joursMois.map((jour) => {
                          const fete = fetesParJour.get(jour.jourDeAnnee);
                          const isShabbat = jour.estShabbat;
                          // ⭐ V3.7 — Infobulle enrichie du nom hébreu du jour
                          // (ex. « Aviv 12 · Yom Shishi »).
                          const nomHeb = jourSemaineHebreu(jour.jourDeSemaine);
                          const suffixeHeb = nomHeb ? ` · ${nomHeb.translit}` : "";
                          return (
                            <div
                              key={jour.jourDeAnnee}
                              className={cn(
                                "aspect-square rounded flex flex-col items-center justify-center text-[10px] font-medium transition-all cursor-pointer",
                                fete
                                  ? "bg-[#C9A227] text-[#1E0F2B] font-bold"
                                  : isShabbat
                                    ? "bg-[#2A0E3D]/10 text-[#2A0E3D]"
                                    : "bg-white text-[#1E0F2B] hover:bg-[#C9A227]/10"
                              )}
                              title={
                                fete
                                  ? `${fete.nomFr} — ${fete.referenceEcritures}${suffixeHeb}`
                                  : `${NOMS_MOIS[numMois - 1]} ${jour.jourDuMois}${suffixeHeb}`
                              }
                            >
                              {jour.jourDuMois}
                              {fete && (
                                <span className="w-1 h-1 rounded-full bg-[#1E0F2B] mt-0.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Fêtes du mois */}
                      {fetesMois.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#8A8378]/10 space-y-1">
                          {fetesMois.map((fete, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#C9A227] flex-shrink-0" />
                              <span className="text-[10px] font-semibold text-[#1E0F2B]">
                                {fete.nomFr}
                              </span>
                              {fete.nomHebrew && (
                                <span className="text-[10px] text-[#8C5FA8]">
                                  {fete.nomHebrew}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
