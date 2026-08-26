"use client";

import { motion } from "framer-motion";
import { Sun, Cloud, Snowflake, Leaf } from "lucide-react";
import type { AnneeBibliqueData, JourBiblique, Fete } from "./calendrier-app";
import { cn } from "@/lib/utils";

interface VueAnnuelleProps {
  annee: AnneeBibliqueData;
}

const SAISON_IMAGES = {
  printemps: "https://images.unsplash.com/photo-1463936575829-25148e1db1b8?q=80&w=1920&auto=format&fit=crop",
  ete: "https://images.unsplash.com/photo-1551269901-5c5e14c25df9?q=80&w=1920&auto=format&fit=crop",
  automne: "https://images.unsplash.com/photo-1507006640577-59363a78103e?q=80&w=1920&auto=format&fit=crop",
  hiver: "https://images.unsplash.com/photo-1483631226437-9bf9eb5d3c3c?q=80&w=1920&auto=format&fit=crop",
};

const NOMS_TRIMESTRES = [
  { nom: "Trimestre 1 — Printemps", icon: Leaf, color: "#C9A227", bgImage: SAISON_IMAGES.printemps, mois: [1, 2, 3] },
  { nom: "Trimestre 2 — Été", icon: Sun, color: "#5B7052", bgImage: SAISON_IMAGES.ete, mois: [4, 5, 6] },
  { nom: "Trimestre 3 — Automne", icon: Cloud, color: "#8C5FA8", bgImage: SAISON_IMAGES.automne, mois: [7, 8, 9] },
  { nom: "Trimestre 4 — Hiver", icon: Snowflake, color: "#8A8378", bgImage: SAISON_IMAGES.hiver, mois: [10, 11, 12] },
];

const NOMS_MOIS = [
  "Aviv", "Ziv", "Sivan", "Tammouz", "Av", "Éloul",
  "Éthanim", "Boul", "Kislev", "Tévet", "Shevat", "Adar",
];

const NOMS_JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function VueAnnuelle({ annee }: VueAnnuelleProps) {
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
            className="rounded-3xl shadow-lg overflow-hidden border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] relative"
          >
            {/* Background image de saison */}
            <div className="absolute inset-0 z-0">
              <img src={trimestre.bgImage} alt={trimestre.nom} className="w-full h-full object-cover opacity-10" />
              <div className="absolute inset-0 bg-white/80" />
            </div>

            {/* Content */}
            <div className="relative z-10 p-6 md:p-8">
              {/* Header trimestre */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#8A8378]/10">
                <div className="flex items-center justify-center w-12 h-12 rounded-full" style={{ backgroundColor: `${trimestre.color}15` }}>
                  <Icon className="w-6 h-6" style={{ color: trimestre.color }} />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#1E0F2B]">{trimestre.nom}</h3>
                  <p className="text-xs text-[#8A8378]">91 jours · 13 semaines</p>
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
                    <div key={numMois} className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
                      <h4 className="font-serif text-lg font-bold text-[#1E0F2B] text-center mb-3">
                        {NOMS_MOIS[numMois - 1]}
                      </h4>
                      <p className="text-[10px] text-[#8A8378] text-center mb-4">
                        {joursMois.length} jours
                      </p>

                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {NOMS_JOURS.map((jour, i) => (
                          <div key={i} className={cn(
                            "text-center text-[9px] font-bold py-1 rounded-lg",
                            jour === "Sam" ? "bg-[#2A0E3D]/10 text-[#2A0E3D]" : "text-[#8A8378]"
                          )}>
                            {jour}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {joursMois.map((jour) => {
                          const fete = fetesParJour.get(jour.jourDeAnnee);
                          const isShabbat = jour.estShabbat;
                          return (
                            <div
                              key={jour.jourDeAnnee}
                              className={cn(
                                "aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-medium transition-all cursor-pointer",
                                fete
                                  ? "bg-[#C9A227] text-[#1E0F2B] font-bold"
                                  : isShabbat
                                  ? "bg-[#2A0E3D]/10 text-[#2A0E3D]"
                                  : "bg-white text-[#1E0F2B] hover:bg-[#C9A227]/10"
                              )}
                              title={fete ? `${fete.nomFr} — ${fete.referenceEcritures}` : `${NOMS_MOIS[numMois - 1]} ${jour.jourDuMois}`}
                            >
                              {jour.jourDuMois}
                              {fete && <span className="w-1 h-1 rounded-full bg-[#1E0F2B] mt-0.5" />}
                            </div>
                          );
                        })}
                      </div>

                      {fetesMois.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#8A8378]/10 space-y-1">
                          {fetesMois.map((fete, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#C9A227] flex-shrink-0" />
                              <span className="text-[10px] font-semibold text-[#1E0F2B]">{fete.nomFr}</span>
                              {fete.nomHebrew && <span className="text-[10px] text-[#8C5FA8]">{fete.nomHebrew}</span>}
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
