"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { AnneeBibliqueData, JourBiblique, Fete } from "./calendrier-app";
import { cn } from "@/lib/utils";

interface VueMensuelleProps {
  annee: AnneeBibliqueData;
}

const NOMS_MOIS = [
  "Aviv", "Ziv", "Sivan", "Tammouz", "Av", "Éloul",
  "Éthanim", "Boul", "Kislev", "Tévet", "Shevat", "Adar",
];

const NOMS_MOIS_FR = [
  "Printemps (Mar-Avr)", "Printemps (Avr-Mai)", "Printemps (Mai-Juin)", "Été (Juin-Juil)",
  "Été (Juil-Août)", "Été (Août-Sep)", "Automne (Sep-Oct)", "Automne (Oct-Nov)",
  "Automne (Nov-Déc)", "Hiver (Déc-Jan)", "Hiver (Jan-Fév)", "Hiver (Fév-Mar)",
];

const SAISON_IMAGES: Record<string, string> = {
  printemps: "https://images.unsplash.com/photo-1463936575829-25148e1db1b8?q=80&w=1920&auto=format&fit=crop",
  ete: "https://images.unsplash.com/photo-1551269901-5c5e14c25df9?q=80&w=1920&auto=format&fit=crop",
  automne: "https://images.unsplash.com/photo-1507006640577-59363a78103e?q=80&w=1920&auto=format&fit=crop",
  hiver: "https://images.unsplash.com/photo-1483631226437-9bf9eb5d3c3c?q=80&w=1920&auto=format&fit=crop",
};

const MOIS_SAISON = [
  "printemps", "printemps", "printemps", "ete", "ete", "ete",
  "automne", "automne", "automne", "hiver", "hiver", "hiver",
];

const NOMS_JOURS = [
  { fr: "Dim", he: "Yom Rishon" },
  { fr: "Lun", he: "Yom Sheni" },
  { fr: "Mar", he: "Yom Shlishi" },
  { fr: "Mer", he: "Yom Revi'i" },
  { fr: "Jeu", he: "Yom Chamishi" },
  { fr: "Ven", he: "Yom Shishi" },
  { fr: "Sam", he: "Shabbat" },
];

export function VueMensuelle({ annee }: VueMensuelleProps) {
  const [moisCourant, setMoisCourant] = useState(() => {
    const maintenant = new Date();
    const jourEnCours = annee.jours.find((j) => {
      const dateGreg = new Date(j.dateGregorienne);
      return dateGreg.toDateString() === maintenant.toDateString();
    });
    return jourEnCours?.mois || 1;
  });

  const saisonCourante = MOIS_SAISON[moisCourant - 1] || "printemps";
  const bgImage = SAISON_IMAGES[saisonCourante];

  const joursDuMois = useMemo(() => annee.jours.filter((j) => j.mois === moisCourant), [annee.jours, moisCourant]);

  const fetesDuMois = useMemo(() => {
    return annee.fetes.filter((f) => {
      const dateFete = new Date(f.dateGregorienne);
      const jourCorrespondant = annee.jours.find((j) => {
        const dateGreg = new Date(j.dateGregorienne);
        return dateGreg.getTime() === dateFete.getTime();
      });
      return jourCorrespondant?.mois === moisCourant;
    });
  }, [annee.fetes, annee.jours, moisCourant]);

  const moisPrecedent = () => setMoisCourant((m) => (m === 1 ? 12 : m - 1));
  const moisSuivant = () => setMoisCourant((m) => (m === 12 ? 1 : m + 1));

  const semaines = organiserJoursParSemaine(joursDuMois);

  const fetesParJour = useMemo(() => {
    const map = new Map<number, Fete>();
    for (const fete of annee.fetes) {
      const jourCorrespondant = annee.jours.find((j) => {
        const dateGreg = new Date(j.dateGregorienne);
        const dateFete = new Date(fete.dateGregorienne);
        return dateGreg.getTime() === dateFete.getTime();
      });
      if (jourCorrespondant && jourCorrespondant.mois === moisCourant) {
        map.set(jourCorrespondant.jourDuMois, fete);
      }
    }
    return map;
  }, [annee.fetes, annee.jours, moisCourant]);

  return (
    <div className="space-y-6">
      {/* Carte avec image de saison en arrière-plan */}
      <div className="rounded-3xl shadow-lg overflow-hidden border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] relative">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img src={bgImage} alt={saisonCourante} className="w-full h-full object-cover opacity-10" />
          <div className="absolute inset-0 bg-white/85" />
        </div>

        <div className="relative z-10 p-6">
          {/* Navigation mois */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={moisPrecedent} className="p-2 rounded-full hover:bg-[#FAF6EF] text-[#2A0E3D] transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h3 className="font-serif text-xl font-bold text-[#1E0F2B]">{NOMS_MOIS[moisCourant - 1]}</h3>
              <p className="text-xs text-[#8A8378]">{NOMS_MOIS_FR[moisCourant - 1]}</p>
            </div>
            <button onClick={moisSuivant} className="p-2 rounded-full hover:bg-[#FAF6EF] text-[#2A0E3D] transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* En-tête jours */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
            {NOMS_JOURS.map((jour, i) => (
              <div key={i} className={cn(
                "text-center py-2 rounded-xl",
                jour.fr === "Sam" ? "bg-[#2A0E3D]/10" : "bg-[#FAF6EF]"
              )}>
                <p className={cn("text-xs font-bold", jour.fr === "Sam" ? "text-[#2A0E3D]" : "text-[#1E0F2B]")}>{jour.fr}</p>
                <p className="text-[10px] text-[#8A8378] hidden md:block">{jour.he}</p>
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="space-y-1 md:space-y-2">
            {semaines.map((semaine, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 gap-1 md:gap-2">
                {semaine.map((jour, dayIdx) => {
                  if (!jour) return <div key={dayIdx} className="min-h-[60px] md:min-h-[80px]" />;
                  const fete = fetesParJour.get(jour.jourDuMois);
                  const isShabbat = jour.estShabbat;
                  return (
                    <motion.div
                      key={dayIdx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: weekIdx * 0.05 }}
                      className={cn(
                        "min-h-[60px] md:min-h-[80px] rounded-xl p-1.5 md:p-2 border transition-all cursor-pointer",
                        fete
                          ? "bg-[#C9A227]/10 border-[#C9A227]/40 hover:bg-[#C9A227]/20"
                          : isShabbat
                            ? "bg-[#2A0E3D]/5 border-[#2A0E3D]/20 hover:bg-[#2A0E3D]/10"
                            : "bg-white border-[#8A8378]/10 hover:border-[#C9A227]/30 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs md:text-sm font-bold", fete ? "text-[#C9A227]" : isShabbat ? "text-[#2A0E3D]" : "text-[#1E0F2B]")}>
                          {jour.jourDuMois}
                        </span>
                        {fete && <span className="w-2 h-2 rounded-full bg-[#C9A227]" />}
                      </div>
                      {fete && <p className="text-[10px] md:text-xs text-[#C9A227] font-semibold mt-1 line-clamp-2">{fete.nomFr}</p>}
                      <p className="text-[10px] text-[#8A8378] mt-auto hidden md:block">
                        {new Date(jour.dateGregorienne).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fêtes du mois */}
      {fetesDuMois.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 p-6">
          <h4 className="font-serif text-lg font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#C9A227]" />
            Fêtes en {NOMS_MOIS[moisCourant - 1]}
          </h4>
          <div className="space-y-3">
            {fetesDuMois.map((fete, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#C9A227]/5 border border-[#C9A227]/20">
                <div className="w-3 h-3 rounded-full bg-[#C9A227] mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#1E0F2B]">
                    {fete.nomFr}
                    {fete.nomHebrew && <span className="text-[#8C5FA8] ml-2 font-normal">{fete.nomHebrew}</span>}
                  </p>
                  <p className="text-xs text-[#8A8378]">
                    {new Date(fete.dateGregorienne).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <p className="text-xs text-[#8A8378] mt-1">{fete.referenceEcritures}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function organiserJoursParSemaine(jours: JourBiblique[]): (JourBiblique | null)[][] {
  if (jours.length === 0) return [];
  const premierJour = jours[0];
  const decalage = premierJour.jourDeSemaine - 1;
  const joursAvecDecalage: (JourBiblique | null)[] = [...Array(decalage).fill(null), ...jours];
  const semaines: (JourBiblique | null)[][] = [];
  for (let i = 0; i < joursAvecDecalage.length; i += 7) {
    semaines.push(joursAvecDecalage.slice(i, i + 7));
  }
  return semaines;
}
