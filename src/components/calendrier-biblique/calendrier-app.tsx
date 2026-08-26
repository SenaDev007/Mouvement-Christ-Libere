"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Grid3x3, List, Clock, BookOpen, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { VueAujourdhui } from "./vue-aujourdhui";
import { VueAnnuelle } from "./vue-annuelle";
import { VueMensuelle } from "./vue-mensuelle";
import { TimelineFetes } from "./timeline-fetes";
import { TableEquivalence } from "./table-equivalence";

export interface JourBiblique {
  jourDeAnnee: number;
  mois: number;
  nomMois: string;
  jourDuMois: number;
  jourDeSemaine: number;
  nomJourSemaine: string;
  estShabbat: boolean;
  dateGregorienne: string; // ISO
  trimestre: number;
}

export interface Fete {
  id: string;
  nomFr: string;
  nomHebrew: string | null;
  referenceEcritures: string;
  description: string;
  categorie: string;
  couleur: string;
  travailInterdit: boolean;
  dureeJours: number;
  jourDeSemaineFixe: number;
  dateBiblique: string;
  dateGregorienne: string; // ISO
  jourDeSemaine: number;
  joursRestants: number;
}

export interface AnneeBibliqueData {
  annee: number;
  libelle: string;
  debut: string;
  fin: string;
  nombreJours: number;
  jours: JourBiblique[];
  fetes: Fete[];
}

interface CalendrierBibliqueAppProps {
  annees: AnneeBibliqueData[];
  anneeCouranteIndex: number;
  maintenant: string;
}

type Vue = "aujourdhui" | "annuelle" | "mensuelle" | "timeline" | "equivalence";

const VUES: Array<{
  id: Vue;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "aujourdhui", label: "Aujourd'hui", icon: Clock },
  { id: "annuelle", label: "Année", icon: Grid3x3 },
  { id: "mensuelle", label: "Mois", icon: Calendar },
  { id: "timeline", label: "Fêtes", icon: List },
  { id: "equivalence", label: "Équivalence", icon: BookOpen },
];

export function CalendrierBibliqueApp({ annees, anneeCouranteIndex, maintenant }: CalendrierBibliqueAppProps) {
  const [vueActive, setVueActive] = useState<Vue>("aujourdhui");
  const [maintenantLive, setMaintenantLive] = useState(new Date(maintenant));
  const [anneeIndex, setAnneeIndex] = useState(anneeCouranteIndex);

  const annee = annees[anneeIndex];

  // Mettre à jour l'heure chaque minute
  useEffect(() => {
    const timer = setInterval(() => {
      setMaintenantLive(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="aujourdhui" className="bg-[#FAF6EF] py-12 md:py-16">
      <div className="container mx-auto max-w-7xl px-4">
        {/* En-tête : navigation années + titre + export iCal */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            {/* Navigation entre années */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAnneeIndex(i => Math.max(0, i - 1))}
                disabled={anneeIndex === 0}
                className="p-2 rounded-lg border border-[#8A8378]/20 text-[#8A8378] hover:bg-[#FAF6EF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Année précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAnneeIndex(i => Math.min(annees.length - 1, i + 1))}
                disabled={anneeIndex === annees.length - 1}
                className="p-2 rounded-lg border border-[#8A8378]/20 text-[#8A8378] hover:bg-[#FAF6EF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Année suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1E0F2B]">
                Année biblique {annee.libelle}
              </h2>
              <p className="text-sm text-[#8A8378] mt-1">
                {new Date(annee.debut).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}{" "}
                —{" "}
                {new Date(annee.fin).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}{" "}
                · {annee.nombreJours} jours · {annee.fetes.length} fêtes
              </p>
            </div>
          </div>

          <a
            href={`/api/calendrier-biblique/ical?annee=${annee.annee}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A227] text-[#2A0E3D] text-xs font-bold hover:bg-[#9C7E1E] hover:text-[#FAF6EF] transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter en iCal
          </a>
        </div>

        {/* Onglets de navigation */}
        <div className="flex items-center gap-1 mb-8 bg-[#2A0E3D]/5 p-1 rounded-xl overflow-x-auto">
          {VUES.map((vue) => {
            const Icon = vue.icon;
            const isActive = vueActive === vue.id;
            return (
              <button
                key={vue.id}
                onClick={() => setVueActive(vue.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-[#2A0E3D] text-[#FAF6EF] shadow-sm"
                    : "text-[#1E0F2B]/60 hover:text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
                )}
              >
                <Icon className="w-4 h-4" />
                {vue.label}
              </button>
            );
          })}
        </div>

        {/* Contenu de la vue active */}
        <AnimatePresence mode="wait">
          <motion.div
            key={vueActive}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {vueActive === "aujourdhui" && (
              <VueAujourdhui annee={annee} maintenant={maintenantLive} />
            )}
            {vueActive === "annuelle" && <VueAnnuelle annee={annee} />}
            {vueActive === "mensuelle" && <VueMensuelle annee={annee} />}
            {vueActive === "timeline" && <TimelineFetes fetes={annee.fetes} />}
            {vueActive === "equivalence" && <TableEquivalence annee={annee} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
