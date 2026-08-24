"use client";

import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import type { AnneeBibliqueData, JourBiblique, Fete } from "./calendrier-app";
import { cn } from "@/lib/utils";

interface VueAnnuelleProps {
  annee: AnneeBibliqueData;
}

const NOMS_TRIMESTRES = [
  "Trimestre 1 — Printemps",
  "Trimestre 2 — Été",
  "Trimestre 3 — Automne",
  "Trimestre 4 — Hiver",
];

const NOMS_JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function VueAnnuelle({ annee }: VueAnnuelleProps) {
  // Grouper les jours par trimestre
  const trimestres = [1, 2, 3, 4].map((numT) => ({
    numero: numT,
    nom: NOMS_TRIMESTRES[numT - 1],
    jours: annee.jours.filter((j) => j.trimestre === numT),
  }));

  // Map des fêtes par jour de l'année
  const fetesParJour = new Map<number, Fete[]>();
  for (const fete of annee.fetes) {
    // Calculer le jour de l'année pour cette fête
    const STRUCTURE_MOIS_JOURS = [30, 30, 31, 30, 30, 31, 30, 30, 31, 30, 30, 31];
    const numMois = parseInt(fete.dateBiblique.split(" ")[0]) || 0;
    let jourAnnee = 0;
    for (let m = 1; m < fete.jourDeSemaineFixe; m++) {
      jourAnnee += STRUCTURE_MOIS_JOURS[m - 1] || 0;
    }
    // Plus simple : chercher dans annee.fetes
  }

  // Construire un map jour de l'année → fêtes
  const fetesMap = new Map<number, Fete>();
  for (const fete of annee.fetes) {
    // Trouver le jour de l'année correspondant
    const jourCorrespondant = annee.jours.find((j) => {
      const dateGreg = new Date(j.dateGregorienne).getTime();
      const dateFete = new Date(fete.dateGregorienne).getTime();
      return dateGreg === dateFete;
    });
    if (jourCorrespondant) {
      fetesMap.set(jourCorrespondant.jourDeAnnee, fete);
    }
  }

  return (
    <div className="space-y-8">
      {/* Légende */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gold" />
          Fête de l&apos;Éternel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-imperial/30" />
          Shabbat hebdomadaire
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-gold bg-ivory" />
          Jour en cours
        </span>
      </div>

      {/* Grille des 4 trimestres */}
      <div className="grid lg:grid-cols-2 gap-6">
        {trimestres.map((trimestre, idx) => (
          <motion.div
            key={trimestre.numero}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="card-gold-top p-6"
          >
            <h3 className="font-serif text-lg font-semibold text-ink mb-4">
              {trimestre.nom}
            </h3>
            <p className="text-xs text-stone mb-4">
              {trimestre.jours.length} jours · 13 semaines
            </p>

            {/* En-tête jours de la semaine */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {NOMS_JOURS_COURTS.map((jour, i) => (
                <div
                  key={jour}
                  className={cn(
                    "text-center text-[10px] uppercase tracking-wider font-semibold py-1",
                    i === 6 ? "text-imperial" : "text-stone"
                  )}
                >
                  {jour}
                </div>
              ))}
            </div>

            {/* Grille des jours */}
            <div className="grid grid-cols-7 gap-1">
              {organiserJoursParSemaine(trimestre.jours).map((semaine, semIdx) =>
                semaine.map((jour, jourIdx) => (
                  <JourCell
                    key={`${semIdx}-${jourIdx}`}
                    jour={jour}
                    fete={jour ? fetesMap.get(jour.jourDeAnnee) : undefined}
                  />
                ))
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function JourCell({ jour, fete }: { jour: JourBiblique | null; fete?: Fete }) {
  if (!jour) {
    return <div className="aspect-square rounded bg-stone/5" />;
  }

  const maintenant = new Date();
  const dateGreg = new Date(jour.dateGregorienne);
  const estAujourdhui = dateGreg.toDateString() === maintenant.toDateString();

  return (
    <div
      title={`${jour.jourDuMois} ${jour.nomMois} — ${jour.nomJourSemaine}${fete ? ` — ${fete.nomFr}` : ""}`}
      className={cn(
        "aspect-square rounded text-[10px] flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 hover:z-10 relative",
        fete
          ? "text-ivory font-semibold"
          : jour.estShabbat
            ? "bg-imperial/20 text-imperial font-medium"
            : "bg-ivory border border-stone/15 text-ink hover:border-gold/40",
        estAujourdhui && "ring-2 ring-gold"
      )}
      style={fete ? { backgroundColor: fete.couleur } : {}}
    >
      <span>{jour.jourDuMois}</span>
      {fete && (
        <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-ivory" />
      )}
    </div>
  );
}

function organiserJoursParSemaine(jours: JourBiblique[]): (JourBiblique | null)[][] {
  if (jours.length === 0) return [];

  const semaines: (JourBiblique | null)[][] = [];
  let semaineCourante: (JourBiblique | null)[] = [];

  // Le premier jour du trimestre commence toujours un mercredi (jour 4)
  // Donc on remplit avec des null pour Dimanche (1), Lundi (2), Mardi (3)
  const premierJour = jours[0];
  const jourDeSemainePremier = premierJour.jourDeSemaine; // 1-7

  for (let i = 1; i < jourDeSemainePremier; i++) {
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
