"use client";

/**
 * ⭐ V3.10 — Bouton « Télécharger PDF » du hero de la page calendrier
 * biblique (remplace l'ancien lien « Télécharger iCal »). Même style que
 * le CTA secondaire du hero ; ouvre le modal de choix de découpe
 * (par mois / par trimestre / toute l'année) puis télécharge le PDF
 * généré par le backend.
 */

import { useState } from "react";
import { FileDown } from "lucide-react";
import { ModalExportPdf } from "./modal-export-pdf";
import { libelleAnneeBiblique } from "@/lib/calendrier/conversion";

interface BoutonHeroPdfProps {
  /** Année civile de début (ex: 2026 pour l'année biblique 2026-2027). */
  annee: number;
}

export function BoutonHeroPdf({ annee }: BoutonHeroPdfProps) {
  const [ouvert, setOuvert] = useState(false);
  const libelle = libelleAnneeBiblique(annee);

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300"
      >
        <FileDown className="w-4 h-4 mr-2" />
        Télécharger PDF
      </button>
      <ModalExportPdf
        ouverte={ouvert}
        onFermer={() => setOuvert(false)}
        annee={annee}
        libelle={libelle}
      />
    </>
  );
}
