"use client";

/**
 * ⭐ V3.100 — ACTIONS SUR UN TÉMOIGNAGE DE CROYANT (back-office
 * /admin/vie-transformee) : publier (valider), rejeter avec note,
 * remettre en attente, supprimer.
 *
 * Utilise l'API admin générique /admin/api/croyantstemoignages/[id]
 * (PATCH/DELETE — garde de session par le proxy, même mécanisme que
 * le module Intercession).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, CheckCircle2, XCircle, RotateCcw, Trash2, MessageSquareQuote,
} from "lucide-react";

const API = "/admin/api/croyantstemoignages";

export function VieTransformeeActions({
  id,
  statut,
  noteAdmin,
}: {
  id: string;
  statut: string;
  noteAdmin: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(noteAdmin || "");
  const [error, setError] = useState("");

  const patch = async (data: Record<string, unknown>, label: string) => {
    setBusy(label);
    setError("");
    try {
      const res = await fetch(`${API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Erreur");
      }
      setShowNote(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm("Supprimer définitivement ce témoignage ? (les données du témoin seront effacées)"))
      return;
    setBusy("delete");
    try {
      const res = await fetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full">
      {showNote && (
        <div className="mb-3 w-full">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note interne (motif du rejet, remarque de relecture…)"
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-[#C9A227]/30 bg-[#150920] text-sm text-[#FAF6EF] placeholder:text-[#BDB4C9]/50 focus:outline-none focus:border-[#C9A227] resize-y"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => patch({ statut: "rejete", noteAdmin: note || null }, "rejete")}
              disabled={!!busy}
              className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-400/30 text-red-300 text-xs font-bold hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy === "rejete" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Confirmer le rejet
            </button>
            <button
              onClick={() => setShowNote(false)}
              className="px-3 py-1.5 rounded-lg text-[#BDB4C9] text-xs font-semibold hover:bg-[#FAF6EF]/5 transition-colors cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 flex-wrap">
        {statut !== "publie" && (
          <button
            onClick={() =>
              patch(
                { statut: "publie", publishedAt: new Date().toISOString() },
                "publie"
              )
            }
            disabled={!!busy}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy === "publie" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            {statut === "rejete" ? " Republier" : " Valider & publier"}
          </button>
        )}
        {statut === "en_attente" && !showNote && (
          <button
            onClick={() => { setNote(noteAdmin || ""); setShowNote(true); }}
            disabled={!!busy}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-400/25 text-red-300/90 text-xs font-bold hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <XCircle className="w-3 h-3" /> Rejeter
          </button>
        )}
        {statut === "rejete" && (
          <span className="text-[10px] text-[#BDB4C9] italic inline-flex items-center gap-1">
            <MessageSquareQuote className="w-3 h-3" />
            {noteAdmin ? noteAdmin.slice(0, 60) : "rejeté"}
          </span>
        )}
        {statut === "publie" && (
          <button
            onClick={() => patch({ statut: "en_attente", publishedAt: null }, "attente")}
            disabled={!!busy}
            className="px-3 py-1.5 rounded-lg bg-[#FAF6EF]/10 border border-[#C9A227]/25 text-[#BDB4C9] text-xs font-bold hover:bg-[#FAF6EF]/15 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy === "attente" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Dépublier
          </button>
        )}
        <button
          onClick={remove}
          disabled={!!busy}
          className="px-3 py-1.5 rounded-lg text-red-300/70 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Supprimer"
          title="Supprimer définitivement"
        >
          {busy === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-300 mt-2 text-right">{error}</p>
      )}
    </div>
  );
}
