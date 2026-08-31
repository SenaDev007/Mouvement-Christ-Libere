"use client";

/**
 * ⭐ V3.2 — Actions sur une demande d'intercession (back-office) :
 * changer le statut (en prière / exaucé / archivé), enregistrer un
 * témoignage d'exaucement, supprimer la demande.
 * Utilise l'API admin générique /admin/api/intercessionrequests/[id].
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, HandHeart, CheckCircle2, Archive, RotateCcw, Trash2, MessageSquareQuote } from "lucide-react";

const API = "/admin/api/intercessionrequests";

export function IntercessionActions({
  id,
  statut,
  temoignageExaucement,
}: {
  id: string;
  statut: string;
  temoignageExaucement: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [showTestimony, setShowTestimony] = useState(false);
  const [testimony, setTestimony] = useState(temoignageExaucement || "");
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
      setShowTestimony(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm("Supprimer définitivement cette demande de prière ?")) return;
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
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        {statut !== "en_priere" && (
          <button
            onClick={() => patch({ statut: "en_priere" }, "prier")}
            disabled={!!busy}
            title="Marquer « en prière »"
            className="p-2 rounded-lg text-[#8A8378] hover:bg-[#C9A227]/15 hover:text-[#A3821C] transition-colors disabled:opacity-50"
          >
            {busy === "prier" ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandHeart className="w-4 h-4" />}
          </button>
        )}
        {statut !== "exauce" && (
          <button
            onClick={() => patch({ statut: "exauce" }, "exauce")}
            disabled={!!busy}
            title="Marquer « exaucé »"
            className="p-2 rounded-lg text-[#8A8378] hover:bg-emerald-100 hover:text-emerald-700 transition-colors disabled:opacity-50"
          >
            {busy === "exauce" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={() => setShowTestimony((v) => !v)}
          disabled={!!busy}
          title="Témoignage d'exaucement"
          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
            showTestimony || temoignageExaucement
              ? "text-[#A3821C] bg-[#C9A227]/15"
              : "text-[#8A8378] hover:bg-[#C9A227]/15 hover:text-[#A3821C]"
          }`}
        >
          <MessageSquareQuote className="w-4 h-4" />
        </button>
        {statut !== "archive" ? (
          <button
            onClick={() => patch({ statut: "archive" }, "archive")}
            disabled={!!busy}
            title="Archiver"
            className="p-2 rounded-lg text-[#8A8378] hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            {busy === "archive" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
          </button>
        ) : (
          <button
            onClick={() => patch({ statut: "ouvert" }, "ouvrir")}
            disabled={!!busy}
            title="Réouvrir"
            className="p-2 rounded-lg text-[#8A8378] hover:bg-[#C9A227]/15 hover:text-[#A3821C] transition-colors disabled:opacity-50"
          >
            {busy === "ouvrir" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={remove}
          disabled={!!busy}
          title="Supprimer"
          className="p-2 rounded-lg text-[#8A8378] hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {showTestimony && (
        <div className="w-full sm:w-80 bg-[#FAF6EF] border border-[#C9A227]/25 rounded-xl p-3">
          <textarea
            value={testimony}
            onChange={(e) => setTestimony(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Comment le Seigneur a répondu…"
            className="w-full text-xs text-[#1E0F2B] bg-white border border-[#8A8378]/20 rounded-lg p-2 outline-none focus:ring-2 focus:ring-[#C9A227]/30 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowTestimony(false)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#8A8378] hover:bg-white transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() =>
                patch(
                  testimony.trim()
                    ? { temoignageExaucement: testimony.trim(), statut: "exauce" }
                    : { temoignageExaucement: null },
                  "temoignage",
                )
              }
              disabled={!!busy}
              className="px-3 py-1 rounded-lg text-[11px] font-bold bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors disabled:opacity-50 inline-flex items-center gap-1"
            >
              {busy === "temoignage" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
