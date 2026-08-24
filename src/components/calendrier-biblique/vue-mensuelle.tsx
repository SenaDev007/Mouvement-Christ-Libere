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

export function VueMensuelle({ annee }: VueMensuelleProps) {
  const [moisCourant, setMoisCourant] = useState(() => {
    // Déterminer le mois en cours
    const maintenant = new Date();
    const jourEnCours = annee.jours.find((j) => {
      const dateGreg = new Date(j.dateGregorienne);
      return dateGreg.toDateString() === maintenant.toDateString();
    });
    return jourEnCours?.mois || 1;
  });

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

  // Organiser les jours en semaines
  const semaines = organiserJoursParSemaine(joursDuMois);

  // Map des fêtes par jour du mois
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
      <div className="flex items-center justify-between">
        <button
          onClick={moisPrecedent}
          className="p-2 rounded hover:bg-gold/10 text-imperial hover:text-gold transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="font-serif text-2xl font-semibold text-ink">
            {NOMS_MOIS[moisCourant - 1]}
          </h3>
          <p className="text-xs text-stone uppercase tracking-[0.18em] font-semibold">
            Mois {moisCourant} · {joursDuMois.length} jours
          </p>
        </div>
        <button
          onClick={moisSuivant}
          className="p-2 rounded hover:bg-gold/10 text-imperial hover:text-gold transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Grille du mois */}
        <div className="lg:col-span-2 card-gold-top p-6">
          {/* En-tête jours de la semaine */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {NOMS_JOURS.map((jour, i) => (
              <div
                key={jour}
                className={cn(
                  "text-center text-[10px] uppercase tracking-wider font-semibold py-2",
                  i === 6 ? "text-imperial bg-imperial/5 rounded" : "text-stone"
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

        {/* Sidebar : fêtes du mois */}
        <div className="space-y-4">
          <div className="card-gold-top p-5">
            <h4 className="font-serif text-base font-semibold text-ink mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gold" />
              Fêtes en {NOMS_MOIS[moisCourant - 1]}
            </h4>
            {fetesDuMois.length === 0 ? (
              <p className="text-sm text-stone italic">
                Aucune fête ce mois-ci.
              </p>
            ) : (
              <div className="space-y-3">
                {fetesDuMois.map((fete) => (
                  <div
                    key={fete.id}
                    className="p-3 rounded-md border border-stone/15 hover:border-gold/40 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-1 self-stretch rounded-full"
                        style={{ backgroundColor: fete.couleur }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-sm font-semibold text-ink">
                          {fete.nomFr}
                        </p>
                        {fete.nomHebrew && (
                          <p className="text-xs text-stone font-serif" dir="rtl">
                            {fete.nomHebrew}
                          </p>
                        )}
                        <p className="text-[11px] text-stone mt-1">
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
          <div className="card-gold-top p-5">
            <p className="text-xs text-stone leading-relaxed">
              <strong className="text-ink">{NOMS_MOIS[moisCourant - 1]}</strong> est le mois
              numéro {moisCourant} du calendrier biblique. Il appartient au trimestre{" "}
              {Math.ceil(moisCourant / 3)}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function JourMensuelCell({ jour, fete }: { jour: JourBiblique | null; fete?: Fete }) {
  if (!jour) {
    return <div className="aspect-square rounded-md bg-stone/5" />;
  }

  const maintenant = new Date();
  const dateGreg = new Date(jour.dateGregorienne);
  const estAujourdhui = dateGreg.toDateString() === maintenant.toDateString();

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      title={`${jour.jourDuMois} ${jour.nomMois} — ${jour.nomJourSemaine}${fete ? ` — ${fete.nomFr}` : ""}`}
      className={cn(
        "aspect-square rounded-md p-2 cursor-pointer transition-colors relative flex flex-col",
        fete
          ? "text-ivory"
          : jour.estShabbat
            ? "bg-imperial/10 border border-imperial/20 text-imperial"
            : "bg-ivory border border-stone/15 text-ink hover:border-gold/40",
        estAujourdhui && "ring-2 ring-gold"
      )}
      style={fete ? { backgroundColor: fete.couleur } : {}}
    >
      <span className="text-sm font-semibold">{jour.jourDuMois}</span>
      <span className="text-[9px] opacity-70 mt-auto">
        {dateGreg.toLocaleDateString("fr-FR", { day: "numeric", month: "numeric", timeZone: "UTC" })}
      </span>
      {fete && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-ivory" />
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
