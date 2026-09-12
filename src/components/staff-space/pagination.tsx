"use client";

/**
 * ⭐ V3.67 — Pagination partagée des espaces Secrétariat & Trésorerie
 * (gap du bilan V3.66 : « pagination UI absente »).
 *
 * Pagination sobre adaptée au registre : « Précédent / page x / Suivant » +
 * compteur d'entrées. L'état de page vit dans le composant parent (le filtre
 * réinitialise à la page 1) ; ce composant ne rend RIEN si une seule page.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  total: number;
  page: number; // 1-indexée
  parPage: number;
  onChange: (page: number) => void;
}

export function Pagination({ total, page, parPage, onChange }: PaginationProps) {
  const nbPages = Math.max(1, Math.ceil(total / parPage));
  if (nbPages <= 1) return null;

  const debut = total === 0 ? 0 : (page - 1) * parPage + 1;
  const fin = Math.min(page * parPage, total);

  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-3">
      <p className="text-[11px] text-[#8A857C]">
        {debut}–{fin} sur {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#8A857C]/20 text-[#000000] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F0E9DE] transition-colors"
          aria-label="Page précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-3 text-xs font-semibold text-[#000000] tabular-nums">
          {page} / {nbPages}
        </span>
        <button
          onClick={() => onChange(Math.min(nbPages, page + 1))}
          disabled={page >= nbPages}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#8A857C]/20 text-[#000000] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F0E9DE] transition-colors"
          aria-label="Page suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
