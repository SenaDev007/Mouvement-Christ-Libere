"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Grid3x3, List, Clock, BookOpen, Download } from "lucide-react";
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
  annee: AnneeBibliqueData;
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

export function CalendrierBibliqueApp({ annee, maintenant }: CalendrierBibliqueAppProps) {
  const [vueActive, setVueActive] = useState<Vue>("aujourdhui");
  const [maintenantLive, setMaintenantLive] = useState(new Date(maintenant));

  // Mettre à jour l'heure chaque minute
  useEffect(() => {
    const timer = setInterval(() => {
      setMaintenantLive(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="aujourdhui" className="bg-ivory py-12 md:py-16">
      <div className="container mx-auto max-w-7xl px-4">
        {/* En-tête : titre + libellé année + export iCal */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-semibold text-ink">
              Année biblique {annee.libelle}
            </h2>
            <p className="text-sm text-stone mt-1">
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

          <a
            href={`/api/calendrier-biblique/ical?annee=${annee.annee}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gold text-ink text-xs font-semibold hover:bg-gold-light transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter en iCal
          </a>
        </div>

        {/* Onglets de navigation */}
        <div className="flex items-center gap-1 mb-8 bg-imperial/5 p-1 rounded-lg overflow-x-auto">
          {VUES.map((vue) => {
            const Icon = vue.icon;
            const isActive = vueActive === vue.id;
            return (
              <button
                key={vue.id}
                onClick={() => setVueActive(vue.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-imperial text-ivory shadow-sm"
                    : "text-ink/60 hover:text-imperial hover:bg-imperial/5"
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
