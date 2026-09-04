"use client";

/**
 * ⭐ V2.8 — Bouton « Modifier » d'un serviteur : ouvre le MODAL
 * d'édition (plus de navigation vers une page edit pleine).
 * Le modal gère la photo (compressée ≤ 60 Ko) et PATCH /admin/api/servants/:id.
 */

import { useState } from "react";
import { Pencil } from "lucide-react";
import { EditServantModal, type ServantLight } from "./edit-servant-modal";

interface ServantEditButtonProps {
  servant: ServantLight;
}

export function ServantEditButton({ servant }: ServantEditButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/60 text-[#8A8378] hover:text-[#1E0F2B] transition-colors"
        aria-label="Modifier"
        title={`Modifier ${servant.fullName}`}
      >
        <Pencil className="w-4 h-4" />
      </button>
      {open && <EditServantModal servant={servant} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
