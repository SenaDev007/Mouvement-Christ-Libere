"use client";

import { motion } from "framer-motion";
import { Clock, BookOpen, Calendar, ChevronRight } from "lucide-react";
import type { Fete } from "./calendrier-app";
import { cn } from "@/lib/utils";

interface TimelineFetesProps {
  fetes: Fete[];
}

export function TimelineFetes({ fetes }: TimelineFetesProps) {
  const maintenant = new Date();

  return (
    <div className="space-y-8">
      {/* Frise horizontale (desktop) */}
      <div className="hidden lg:block relative">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent -translate-y-1/2" />
        <div className="relative flex items-center justify-between gap-2">
          {fetes.map((fete, idx) => {
            const dateFete = new Date(fete.dateGregorienne);
            const estPassee = dateFete.getTime() < maintenant.getTime();
            const estAvenir = !estPassee;

            return (
              <motion.div
                key={fete.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className="relative flex flex-col items-center"
              >
                {/* Point sur la frise */}
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 border-ivory z-10",
                    estAvenir ? "animate-pulse" : ""
                  )}
                  style={{ backgroundColor: fete.couleur }}
                />

                {/* Label */}
                <div className="absolute top-6 text-center w-24">
                  <p className="text-xs font-semibold text-ink truncate">
                    {fete.nomFr}
                  </p>
                  <p className="text-[10px] text-stone mt-0.5">
                    {dateFete.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="h-16" />
      </div>

      {/* Liste verticale des fêtes (mobile + desktop) */}
      <div className="space-y-3">
        <h3 className="font-serif text-lg font-semibold text-ink mb-4">
          Les 11 fêtes de l&apos;Éternel
        </h3>
        {fetes.map((fete, idx) => {
          const dateFete = new Date(fete.dateGregorienne);
          const estPassee = dateFete.getTime() < maintenant.getTime();

          return (
            <motion.div
              key={fete.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
              className={cn(
                "card-gold-top p-5 flex items-start gap-4",
                estPassee && "opacity-60"
              )}
            >
              {/* Couleur de la fête */}
              <div
                className="w-2 self-stretch rounded-full flex-shrink-0"
                style={{ backgroundColor: fete.couleur }}
              />

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h4 className="font-serif text-lg font-semibold text-ink">
                      {fete.nomFr}
                    </h4>
                    {fete.nomHebrew && (
                      <p className="text-sm text-stone font-serif" dir="rtl">
                        {fete.nomHebrew}
                      </p>
                    )}
                  </div>
                  {fete.joursRestants >= 0 && !estPassee && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gold/15 text-gold-dark border border-gold/30 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {fete.joursRestants === 0
                        ? "Aujourd'hui"
                        : `Dans ${fete.joursRestants} j`}
                    </span>
                  )}
                  {estPassee && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone/10 text-stone border border-stone/20 flex-shrink-0">
                      Passée
                    </span>
                  )}
                </div>

                <p className="text-sm text-ink/75 leading-relaxed mb-3">
                  {fete.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-stone">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {dateFete.toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "UTC",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-gold" />
                    <span className="verse-ref">{fete.referenceEcritures}</span>
                  </span>
                  {fete.travailInterdit && (
                    <span className="text-state-danger font-semibold">
                      Pas de travail
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
