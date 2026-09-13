"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareModal } from "@/components/videos/share-modal";

/**
 * ⭐ V3.36 — Bouton « Partager » de la page live.
 *
 * Avant : petit popover (200 px, 3 plateformes) sans fermeture par clic
 * extérieur sur mobile. Désormais : ouvre le GRAND modal de partage complet
 * (ShareModal) — toutes les plateformes visibles d'un coup, fermeture par
 * clic extérieur / ✕ / Échap, feuille plein écran sur mobile.
 */

interface ShareButtonProps {
  url: string;
  title: string;
  /** Miniature affichée dans la fiche du modal (optionnelle). */
  thumbnailUrl?: string | null;
}

export function ShareButton({ url, title, thumbnailUrl }: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#2A0E3D]/5 rounded-full hover:bg-[#2A0E3D]/10 transition-colors"
        title="Partager ce live"
      >
        <Share2 className="w-4 h-4 text-[#1E0F2B]" />
        <span className="text-xs font-medium text-[#1E0F2B] hidden sm:inline">Partager</span>
      </button>

      {/* ⭐ V3.36 — Grand modal de partage complet */}
      <ShareModal
        open={open}
        onClose={() => setOpen(false)}
        url={url}
        title={title}
        thumbnailUrl={thumbnailUrl ?? null}
      />
    </div>
  );
}
