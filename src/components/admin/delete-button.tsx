"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface DeleteButtonProps {
  entity: string;
  id: string;
  redirectTo?: string;
  /** ⭐ V4.05 — libellé (nom/email) affiché dans la confirmation renforcée
   *  des comptes utilisateur : « Suppression définitive de <label>… ». */
  label?: string;
}

export function DeleteButton({ entity, id, redirectTo, label }: DeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // ⭐ V4.05 — CONFIRMATION RENFORCÉE pour les comptes utilisateur : la
  // suppression est DÉFINITIVE (hard delete + cascades — messages,
  // historique, canaux perdus, irrécupérable). Après la suppression
  // accidentelle de plusieurs membres (restaurés à la main en V4.05),
  // un simple clic « Confirmer » ne suffit plus : il faut taper le mot
  // SUPPRIMER pour armer le bouton.
  const confirmationForte = entity === "users";
  const [motTape, setMotTape] = useState("");
  const motValide = motTape.trim() === "SUPPRIMER";

  const annuler = () => {
    setConfirming(false);
    setMotTape("");
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/admin/api/${entity}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
      setConfirming(false);
      setMotTape("");
    }
  };

  // ⭐ V4.05 — Panneau de confirmation renforcé (comptes utilisateur
  // uniquement) : avertissement + champ « Tapez SUPPRIMER ». Le bouton
  // reste désactivé tant que le mot exact n'est pas saisi.
  if (confirming && confirmationForte) {
    return (
      <span
        role="alertdialog"
        aria-label="Confirmer la suppression définitive du compte"
        className="inline-flex flex-col gap-2 p-3 rounded-xl bg-state-danger/10 border border-state-danger/40"
      >
        <span className="flex items-center gap-2 text-[11px] leading-snug font-semibold text-state-danger max-w-64">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          Suppression définitive de {label ? label : "ce compte"} : messages,
          historique et abonnements seront perdus — impossible d'annuler ensuite.
        </span>
        <span className="flex items-center gap-1 flex-wrap">
          <input
            autoFocus
            value={motTape}
            onChange={(e) => setMotTape(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && motValide) handleDelete();
              if (e.key === "Escape") annuler();
            }}
            placeholder="Tapez SUPPRIMER"
            aria-label="Tapez SUPPRIMER pour confirmer la suppression définitive"
            disabled={deleting}
            className="w-40 px-3 py-2 min-h-[44px] rounded-lg text-[11px] bg-[#1A0826] border border-stone/30 text-[#FAF6EF] placeholder:text-stone/40 focus:outline-none focus:border-state-danger/70"
          />
          <button
            onClick={handleDelete}
            disabled={deleting || !motValide}
            title={motValide ? "Supprimer définitivement" : "Tapez SUPPRIMER pour armer ce bouton"}
            className="inline-flex items-center justify-center min-h-[44px] px-3 rounded-lg text-[10px] font-semibold bg-state-danger text-ivory transition-opacity disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
          >
            {deleting ? (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
            ) : (
              "Supprimer définitivement"
            )}
          </button>
          <button
            onClick={annuler}
            disabled={deleting}
            className="inline-flex items-center justify-center min-h-[44px] px-3 rounded-lg text-[10px] font-semibold border border-stone/30 text-stone hover:bg-stone/10"
          >
            Annuler
          </button>
        </span>
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center justify-center min-h-[44px] px-3 rounded text-[10px] font-semibold bg-state-danger text-ivory hover:opacity-90 transition-opacity"
        >
          {deleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            "Confirmer"
          )}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="inline-flex items-center justify-center min-h-[44px] px-3 rounded text-[10px] font-semibold border border-stone/30 text-stone hover:bg-stone/10"
        >
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded hover:bg-state-danger/10 text-stone hover:text-state-danger transition-colors"
      aria-label="Supprimer"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
