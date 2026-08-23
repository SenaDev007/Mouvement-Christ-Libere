"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

interface DeleteButtonProps {
  entity: string;
  id: string;
  redirectTo?: string;
}

export function DeleteButton({ entity, id, redirectTo }: DeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    }
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-2 py-1 rounded text-[10px] font-semibold bg-state-danger text-ivory hover:opacity-90 transition-opacity"
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
          className="px-2 py-1 rounded text-[10px] font-semibold border border-stone/30 text-stone hover:bg-stone/10"
        >
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-2 rounded hover:bg-state-danger/10 text-stone hover:text-state-danger transition-colors"
      aria-label="Supprimer"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
