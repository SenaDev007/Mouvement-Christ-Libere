"use client";

/**
 * ⭐ V3.10 — MODAL D'EXPORT PDF du calendrier biblique.
 *
 * Remplace les boutons « Télécharger iCal » / « Exporter en iCal ».
 * Avant génération, l'utilisateur choisit la découpe :
 *   · Par mois      : 12 planches (un mois par page, avec les fêtes) ;
 *   · Par trimestre : 4 planches (les 3 mois du trimestre côte à côte) ;
 *   · Toute l'année : vue d'ensemble des 12 mois + table des fêtes.
 *
 * Le PDF est généré par le BACKEND (/api/calendrier-biblique/pdf) puis
 * téléchargé en blob.
 *
 * Composant partagé : page publique (/calendrier-biblique) et calendrier
 * intégré de Yeshua Connect (CalendarWorkspace).
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileDown, CalendarDays, LayoutGrid, Grid3x3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODES_PDF, type ModePdfCalendrier } from "@/lib/calendrier/pdf/modes";

interface ModalExportPdfProps {
  ouverte: boolean;
  onFermer: () => void;
  /** Année civile de début (ex: 2026 pour 2026-2027). */
  annee: number;
  /** Libellé affiché (ex: « 2026-2027 »). */
  libelle: string;
}

const ICONES_MODE: Record<ModePdfCalendrier, React.ComponentType<{ className?: string }>> = {
  mois: CalendarDays,
  trimestre: LayoutGrid,
  annee: Grid3x3,
};

export function ModalExportPdf({ ouverte, onFermer, annee, libelle }: ModalExportPdfProps) {
  const [mode, setMode] = useState<ModePdfCalendrier>("annee");
  const [telechargement, setTelechargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  // Échap pour fermer + focus
  useEffect(() => {
    if (!ouverte) return;
    const onEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", onEchap);
    return () => window.removeEventListener("keydown", onEchap);
  }, [ouverte, onFermer]);

  const telecharger = async () => {
    if (telechargement) return;
    setTelechargement(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/calendrier-biblique/pdf?annee=${annee}&mode=${mode}`);
      if (!res.ok) {
        throw new Error("Le serveur n'a pas pu générer le PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calendrier-biblique-${libelle.replace("-", "-")}-${mode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onFermer();
    } catch {
      setErreur("Le téléchargement a échoué. Vérifiez votre connexion puis réessayez.");
    } finally {
      setTelechargement(false);
    }
  };

  return (
    <AnimatePresence>
      {ouverte && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#1E0F2B]/60 backdrop-blur-sm"
          onClick={onFermer}
          role="dialog"
          aria-modal="true"
          aria-label="Exporter le calendrier en PDF"
        >
          <motion.div
            ref={zoneRef}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="w-full max-w-md bg-[#FAF6EF] rounded-2xl shadow-2xl border border-[#8A8378]/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="relative bg-[#2A0E3D] px-5 py-4">
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#C9A227] to-transparent" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#FAF6EF] leading-tight">
                    Télécharger en PDF
                  </h3>
                  <p className="text-xs text-[#C9A227] font-semibold mt-0.5">
                    Année biblique {libelle}
                  </p>
                </div>
                <button
                  onClick={onFermer}
                  className="p-1.5 rounded-lg text-[#FAF6EF]/60 hover:text-[#FAF6EF] hover:bg-white/10 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Choix du mode */}
            <div className="p-5 space-y-4">
              <p className="text-[11px] text-[#8A8378] font-semibold uppercase tracking-wider">
                Comment découper le calendrier ?
              </p>

              <div className="space-y-2.5">
                {MODES_PDF.map((m) => {
                  const Icone = ICONES_MODE[m.id];
                  const actif = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "w-full flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all",
                        actif
                          ? "border-[#C9A227] bg-[#C9A227]/12 shadow-sm"
                          : "border-[#8A8378]/25 bg-white hover:border-[#C9A227]/50 hover:bg-[#C9A227]/5"
                      )}
                      aria-pressed={actif}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-colors",
                          actif ? "bg-[#C9A227] text-[#2A0E3D]" : "bg-[#FAF6EF] text-[#8A8378] border border-[#8A8378]/20"
                        )}
                      >
                        <Icone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm font-bold leading-tight",
                          actif ? "text-[#1E0F2B]" : "text-[#1E0F2B]/80"
                        )}>
                          {m.titre}
                        </p>
                        <p className="text-[11px] text-[#8A8378] leading-snug mt-0.5">
                          {m.detail}
                        </p>
                      </div>
                      {/* Radio */}
                      <div
                        className={cn(
                          "ml-auto flex-shrink-0 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center",
                          actif ? "border-[#C9A227]" : "border-[#8A8378]/40"
                        )}
                      >
                        {actif && <div className="w-2.5 h-2.5 rounded-full bg-[#C9A227]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {erreur && (
                <p className="text-xs text-[#B5502F] font-semibold bg-[#B5502F]/10 rounded-lg px-3 py-2">
                  {erreur}
                </p>
              )}

              <p className="text-[10px] text-[#8A8378] leading-relaxed">
                Document généré par le serveur, fidèle au calendrier affiché : couverture,
                couleurs des fêtes de l&apos;Éternel, Shabbat, noms hébreux des jours et
                correspondances grégoriennes.
              </p>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex items-center gap-2.5">
              <button
                onClick={telecharger}
                disabled={telechargement}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#C9A227] text-[#2A0E3D] text-sm font-bold hover:bg-[#9C7E1E] hover:text-[#FAF6EF] disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {telechargement ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération…
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    Télécharger le PDF
                  </>
                )}
              </button>
              <button
                onClick={onFermer}
                className="px-4 py-2.5 rounded-lg border border-[#8A8378]/30 text-[#1E0F2B]/70 text-sm font-bold hover:bg-[#FAF6EF] transition-colors"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
