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
  "Aviv",
  "Ziv",
  "Sivan",
  "Tammouz",
  "Av",
  "Éloul",
  "Éthanim",
  "Boul",
  "Kislev",
  "Tévet",
  "Shevat",
  "Adar",
];

const NOMS_JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// Images saisonnières selon le trimestre du mois
// Trimestre 1 (mois 1-3) : Printemps
// Trimestre 2 (mois 4-6) : Été
// Trimestre 3 (mois 7-9) : Automne
// Trimestre 4 (mois 10-12) : Hiver
const SAISON_MOIS: Array<{ image: string; overlay: string; saison: string }> = [
  // Printemps (mois 1-3)
  {
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.88) 0%, rgba(42,14,61,0.7) 50%, rgba(201,162,39,0.35) 100%)",
    saison: "Printemps",
  },
  // Été (mois 4-6)
  {
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.85) 0%, rgba(201,162,39,0.45) 50%, rgba(42,14,61,0.7) 100%)",
    saison: "Été",
  },
  // Automne (mois 7-9)
  {
    image: "https://images.unsplash.com/photo-1507371341162-763b5e419408?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.85) 0%, rgba(124,92,184,0.4) 50%, rgba(156,126,30,0.5) 100%)",
    saison: "Automne",
  },
  // Hiver (mois 10-12)
  {
    image: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.88) 0%, rgba(250,246,239,0.25) 50%, rgba(42,14,61,0.75) 100%)",
    saison: "Hiver",
  },
];

function saisonPourMois(mois: number) {
  const trimestre = Math.ceil(mois / 3);
  return SAISON_MOIS[trimestre - 1];
}

export function VueMensuelle({ annee }: VueMensuelleProps) {
  const [moisCourant, setMoisCourant] = useState(() => {
    const maintenant = new Date();
    const jourEnCours = annee.jours.find((j) => {
      const dateGreg = new Date(j.dateGregorienne);
      return dateGreg.toDateString() === maintenant.toDateString();
    });
    return jourEnCours?.mois || 1;
  });

  const saison = saisonPourMois(moisCourant);

  const joursDuMois = useMemo(() => {
    return annee.jours.filter((j) => j.mois === moisCourant);
  }, [annee.jours, moisCourant]);

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

  const moisPrecedent = () => {
    setMoisCourant((m) => (m === 1 ? 12 : m - 1));
  };

  const moisSuivant = () => {
    setMoisCourant((m) => (m === 12 ? 1 : m + 1));
  };

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
      {/* Navigation mois */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-[#8A8378]/15 p-3">
        <button
          onClick={moisPrecedent}
          className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#2A0E3D] hover:text-[#9C7E1E] transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="font-serif text-2xl font-bold text-[#1E0F2B]">
            {NOMS_MOIS[moisCourant - 1]}
          </h3>
          <p className="text-xs text-[#8A8378] uppercase tracking-[0.18em] font-bold">
            Mois {moisCourant} · {joursDuMois.length} jours · {saison.saison}
          </p>
        </div>
        <button
          onClick={moisSuivant}
          className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#2A0E3D] hover:text-[#9C7E1E] transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Grille du mois — avec image saisonnière en fond */}
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden shadow-xl border border-[#8A8378]/20"
          style={{
            backgroundImage: `url(${saison.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay saisonnier */}
          <div className="absolute inset-0" style={{ background: saison.overlay }} />

          {/* Contenu */}
          <div className="relative z-10 p-6">
            {/* En-tête jours de la semaine */}
            <div className="grid grid-cols-7 gap-2 mb-3">
              {NOMS_JOURS.map((jour, i) => (
                <div
                  key={jour}
                  className={cn(
                    "text-center text-[10px] uppercase tracking-wider font-bold py-2 rounded-md",
                    i === 6
                      ? "text-[#C9A227] bg-[#FAF6EF]/10"
                      : "text-[#FAF6EF]/70"
                  )}
                >
                  {jour}
                </div>
              ))}
            </div>

            {/* Grille des jours */}
            <div className="grid grid-cols-7 gap-2">
              {semaines.flatMap((semaine, semIdx) =>
                semaine.map((jour, jourIdx) => (
                  <JourMensuelCell
                    key={`${semIdx}-${jourIdx}`}
                    jour={jour}
                    fete={jour ? fetesParJour.get(jour.jourDuMois) : undefined}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar : fêtes du mois */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-[#8A8378]/15 p-5">
            <h4 className="font-serif text-base font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C9A227]" />
              Fêtes en {NOMS_MOIS[moisCourant - 1]}
            </h4>
            {fetesDuMois.length === 0 ? (
              <p className="text-sm text-[#8A8378] italic">
                Aucune fête ce mois-ci.
              </p>
            ) : (
              <div className="space-y-3">
                {fetesDuMois.map((fete) => (
                  <div
                    key={fete.id}
                    className="p-3 rounded-lg border border-[#8A8378]/15 hover:border-[#C9A227]/40 transition-colors bg-[#FAF6EF]/40"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-1 self-stretch rounded-full"
                        style={{ backgroundColor: fete.couleur }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-sm font-bold text-[#1E0F2B]">
                          {fete.nomFr}
                        </p>
                        {fete.nomHebrew && (
                          <p className="text-xs text-[#8A8378] font-serif" dir="rtl">
                            {fete.nomHebrew}
                          </p>
                        )}
                        <p className="text-[11px] text-[#8A8378] mt-1 font-semibold">
                          {new Date(fete.dateGregorienne).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info sur le mois */}
          <div className="bg-white rounded-xl shadow-sm border border-[#8A8378]/15 p-5">
            <p className="text-xs text-[#8A8378] leading-relaxed">
              <strong className="text-[#1E0F2B]">{NOMS_MOIS[moisCourant - 1]}</strong> est le mois
              numéro {moisCourant} du calendrier biblique. Il appartient au trimestre{" "}
              {Math.ceil(moisCourant / 3)} — saison de <strong className="text-[#9C7E1E]">{saison.saison}</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function JourMensuelCell({ jour, fete }: { jour: JourBiblique | null; fete?: Fete }) {
  if (!jour) {
    return <div className="aspect-square rounded-lg bg-[#FAF6EF]/5" />;
  }

  const maintenant = new Date();
  const dateGreg = new Date(jour.dateGregorienne);
  const estAujourdhui = dateGreg.toDateString() === maintenant.toDateString();

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      title={`${jour.jourDuMois} ${jour.nomMois} — ${jour.nomJourSemaine}${fete ? ` — ${fete.nomFr}` : ""}`}
      className={cn(
        "aspect-square rounded-lg p-2 cursor-pointer transition-colors relative flex flex-col backdrop-blur-sm",
        fete
          ? "text-[#FAF6EF] shadow-md"
          : jour.estShabbat
            ? "bg-[#2A0E3D]/40 border border-[#FAF6EF]/20 text-[#FAF6EF]"
            : "bg-[#FAF6EF]/85 border border-[#FAF6EF]/30 text-[#1E0F2B] hover:border-[#C9A227]/60",
        estAujourdhui && "ring-2 ring-[#C9A227] ring-offset-1 ring-offset-[#2A0E3D]/40"
      )}
      style={fete ? { backgroundColor: fete.couleur } : {}}
    >
      <span className="text-sm font-bold">{jour.jourDuMois}</span>
      <span className="text-[9px] opacity-70 mt-auto">
        {dateGreg.toLocaleDateString("fr-FR", { day: "numeric", month: "numeric", timeZone: "UTC" })}
      </span>
      {fete && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#FAF6EF]" />
      )}
    </motion.div>
  );
}

function organiserJoursParSemaine(jours: JourBiblique[]): (JourBiblique | null)[][] {
  if (jours.length === 0) return [];

  const semaines: (JourBiblique | null)[][] = [];
  let semaineCourante: (JourBiblique | null)[] = [];

  const premierJour = jours[0];
  for (let i = 1; i < premierJour.jourDeSemaine; i++) {
    semaineCourante.push(null);
  }

  for (const jour of jours) {
    semaineCourante.push(jour);
    if (semaineCourante.length === 7) {
      semaines.push(semaineCourante);
      semaineCourante = [];
    }
  }

  if (semaineCourante.length > 0) {
    while (semaineCourante.length < 7) {
      semaineCourante.push(null);
    }
    semaines.push(semaineCourante);
  }

  return semaines;
}
