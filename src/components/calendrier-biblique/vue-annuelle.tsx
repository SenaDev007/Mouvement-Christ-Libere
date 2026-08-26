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

// Images de fond saisonnières (Unsplash — paysages bibliques professionnels)
const SAISON_BG: Array<{
  image: string;
  overlay: string;
  emoji: string;
}> = [
  // Printemps — champ de fleurs sauvages en Israël
  {
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.85) 0%, rgba(42,14,61,0.65) 50%, rgba(201,162,39,0.3) 100%)",
    emoji: "printemps",
  },
  // Été — champ de blé doré sous soleil
  {
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.82) 0%, rgba(201,162,39,0.45) 50%, rgba(42,14,61,0.7) 100%)",
    emoji: "été",
  },
  // Automne — vignes et feuilles rouilles
  {
    image: "https://images.unsplash.com/photo-1507371341162-763b5e419408?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.85) 0%, rgba(124,92,184,0.4) 50%, rgba(156,126,30,0.5) 100%)",
    emoji: "automne",
  },
  // Hiver — montagnes enneigées de Jérusalem
  {
    image: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.88) 0%, rgba(250,246,239,0.25) 50%, rgba(42,14,61,0.75) 100%)",
    emoji: "hiver",
  },
];

const NOMS_JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function VueAnnuelle({ annee }: VueAnnuelleProps) {
  // Grouper les jours par trimestre
  const trimestres = [1, 2, 3, 4].map((numT) => ({
    numero: numT,
    nom: NOMS_TRIMESTRES[numT - 1],
    jours: annee.jours.filter((j) => j.trimestre === numT),
    saison: SAISON_BG[numT - 1],
  }));

  // Construire un map jour de l'année → fêtes
  const fetesMap = new Map<number, Fete>();
  for (const fete of annee.fetes) {
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
      <div className="flex flex-wrap items-center gap-4 text-xs bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-[#8A8378]/15 shadow-sm">
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

      {/* Grille des 4 trimestres avec images saisonnières */}
      <div className="grid lg:grid-cols-2 gap-6">
        {trimestres.map((trimestre, idx) => (
          <motion.div
            key={trimestre.numero}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="relative rounded-2xl overflow-hidden shadow-xl border border-[#8A8378]/20"
            style={{
              backgroundImage: `url(${trimestre.saison.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Overlay coloré pour la lisibilité */}
            <div
              className="absolute inset-0"
              style={{ background: trimestre.saison.overlay }}
            />

            {/* Contenu */}
            <div className="relative z-10 p-6 backdrop-blur-[1px]">
              {/* En-tête trimestre */}
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-serif text-xl font-bold text-[#FAF6EF] drop-shadow-lg">
                  {trimestre.nom}
                </h3>
              </div>
              <p className="text-xs text-[#FAF6EF]/80 mb-5 font-semibold uppercase tracking-[0.12em]">
                {trimestre.jours.length} jours · 13 semaines
              </p>

              {/* En-tête jours de la semaine */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {NOMS_JOURS_COURTS.map((jour, i) => (
                  <div
                    key={jour}
                    className={cn(
                      "text-center text-[10px] uppercase tracking-wider font-bold py-1 rounded",
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
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function JourCell({ jour, fete }: { jour: JourBiblique | null; fete?: Fete }) {
  if (!jour) {
    return <div className="aspect-square rounded bg-[#FAF6EF]/5" />;
  }

  const maintenant = new Date();
  const dateGreg = new Date(jour.dateGregorienne);
  const estAujourdhui = dateGreg.toDateString() === maintenant.toDateString();

  return (
    <div
      title={`${jour.jourDuMois} ${jour.nomMois} — ${jour.nomJourSemaine}${fete ? ` — ${fete.nomFr}` : ""}`}
      className={cn(
        "aspect-square rounded-md text-[10px] flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 hover:z-10 relative backdrop-blur-sm",
        fete
          ? "text-[#FAF6EF] font-bold shadow-md"
          : jour.estShabbat
            ? "bg-[#2A0E3D]/40 text-[#FAF6EF] font-medium border border-[#FAF6EF]/20"
            : "bg-[#FAF6EF]/85 border border-[#FAF6EF]/30 text-[#1E0F2B] hover:border-[#C9A227]/60 hover:bg-[#FAF6EF]",
        estAujourdhui && "ring-2 ring-[#C9A227] ring-offset-1 ring-offset-[#2A0E3D]/40"
      )}
      style={fete ? { backgroundColor: fete.couleur } : {}}
    >
      <span>{jour.jourDuMois}</span>
      {fete && (
        <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-[#FAF6EF]" />
      )}
    </div>
  );
}

function organiserJoursParSemaine(jours: JourBiblique[]): (JourBiblique | null)[][] {
  if (jours.length === 0) return [];

  const semaines: (JourBiblique | null)[][] = [];
  let semaineCourante: (JourBiblique | null)[] = [];

  const premierJour = jours[0];
  const jourDeSemainePremier = premierJour.jourDeSemaine;

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
