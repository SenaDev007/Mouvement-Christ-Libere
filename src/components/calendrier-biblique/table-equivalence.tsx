"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, ArrowLeftRight, Calendar } from "lucide-react";
import type { AnneeBibliqueData, JourBiblique } from "./calendrier-app";
import { cn } from "@/lib/utils";

interface TableEquivalenceProps {
  annee: AnneeBibliqueData;
}

export function TableEquivalence({ annee }: TableEquivalenceProps) {
  const [recherche, setRecherche] = useState("");
  const [sens, setSens] = useState<"biblique_vers_gregorien" | "gregorien_vers_biblique">(
    "biblique_vers_gregorien"
  );

  // Filtrer les jours selon la recherche
  const joursFiltres = useMemo(() => {
    if (!recherche.trim()) return annee.jours;

    const q = recherche.toLowerCase().trim();
    return annee.jours.filter((j) => {
      const dateGreg = new Date(j.dateGregorienne);
      const gregStr = dateGreg.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      const gregStrCourt = dateGreg.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });

      return (
        j.nomMois.toLowerCase().includes(q) ||
        j.nomJourSemaine.toLowerCase().includes(q) ||
        j.jourDuMois.toString() === q ||
        j.jourDeAnnee.toString() === q ||
        gregStr.toLowerCase().includes(q) ||
        gregStrCourt.includes(q) ||
        dateGreg.toISOString().split("T")[0].includes(q)
      );
    });
  }, [annee.jours, recherche]);

  // Limiter à 100 résultats pour la performance
  const joursAffiches = joursFiltres.slice(0, 100);

  return (
    <div className="space-y-6">
      {/* Recherche + switch sens */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone" />
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={
              sens === "biblique_vers_gregorien"
                ? "Rechercher par mois, jour biblique..."
                : "Rechercher par date grégorienne (ex: 2026-08-24)..."
            }
            className="w-full pl-11 pr-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
          />
        </div>

        <button
          onClick={() =>
            setSens(
              sens === "biblique_vers_gregorien"
                ? "gregorien_vers_biblique"
                : "biblique_vers_gregorien"
            )
          }
          className="inline-flex items-center gap-2 px-4 py-3 rounded-md border border-imperial/30 text-imperial hover:bg-imperial/5 transition-colors text-sm font-semibold"
        >
          <ArrowLeftRight className="w-4 h-4" />
          {sens === "biblique_vers_gregorien"
            ? "Biblique → Grégorien"
            : "Grégorien → Biblique"}
        </button>
      </div>

      {/* Statistiques */}
      <div className="flex items-center gap-4 text-xs text-stone">
        <span>
          {joursFiltres.length} résultat{joursFiltres.length > 1 ? "s" : ""}
          {recherche && ` pour "${recherche}"`}
        </span>
        {joursFiltres.length > 100 && (
          <span className="text-gold-dark">· 100 premiers affichés</span>
        )}
      </div>

      {/* Tableau */}
      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-imperial text-ivory">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">
                {sens === "biblique_vers_gregorien" ? "Date biblique" : "Date grégorienne"}
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">
                {sens === "biblique_vers_gregorien" ? "Date grégorienne" : "Date biblique"}
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold hidden md:table-cell">
                Jour de semaine
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold hidden md:table-cell">
                Fête
              </th>
            </tr>
          </thead>
          <tbody>
            {joursAffiches.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-stone italic">
                  Aucun résultat. Essayez un mois (ex: « Aviv »), un jour (ex: « 14 »),
                  ou une date grégorienne (ex: « 2026-08-24 »).
                </td>
              </tr>
            ) : (
              joursAffiches.map((jour, i) => {
                const dateGreg = new Date(jour.dateGregorienne);
                const fete = annee.fetes.find((f) => {
                  const dateFete = new Date(f.dateGregorienne);
                  return dateFete.getTime() === dateGreg.getTime();
                });
                const maintenant = new Date();
                const estAujourdhui = dateGreg.toDateString() === maintenant.toDateString();

                return (
                  <motion.tr
                    key={jour.jourDeAnnee}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.005 }}
                    className={cn(
                      "border-b border-stone/15 hover:bg-gold/5",
                      estAujourdhui && "bg-gold/10",
                      jour.estShabbat && "bg-imperial/[0.03]"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-sm font-semibold text-ink">
                          {jour.jourDuMois} {jour.nomMois}
                        </span>
                        {jour.estShabbat && (
                          <span className="text-[10px] uppercase tracking-wider text-imperial font-semibold">
                            Shabbat
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone">Jour {jour.jourDeAnnee}/364</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-stone" />
                        {dateGreg.toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone hidden md:table-cell">
                      {jour.nomJourSemaine}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {fete ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold text-ivory"
                          style={{ backgroundColor: fete.couleur }}
                        >
                          {fete.nomFr}
                        </span>
                      ) : (
                        <span className="text-xs text-stone">—</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <div className="p-4 bg-imperial/5 border border-gold/20 rounded-md">
        <p className="text-xs text-stone leading-relaxed">
          <strong className="text-ink">Astuce :</strong> La recherche fonctionne dans les deux sens.
          Tapez un nom de mois biblique (Aviv, Sivan, Éthanim...), un numéro de jour, ou une date
          grégorienne au format YYYY-MM-DD. Le jour biblique commence au coucher du soleil —
          l&apos;équivalence grégorienne est donc calée sur le jour civil correspondant.
        </p>
      </div>
    </div>
  );
}
