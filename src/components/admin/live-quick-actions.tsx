"use client";

import { apiFetch } from "@/lib/api-client";
import { useState } from "react";
import { Play, Square, Loader2 } from "lucide-react";

interface LiveQuickActionsProps {
  liveId: string;
  status: string;
}

/**
 * Boutons d'action rapide pour démarrer/terminer un live directement depuis la liste.
 */
export function LiveQuickActions({ liveId, status }: LiveQuickActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!confirm("Terminer ce live ? Le replay sera archivé si disponible.")) return;
    setLoading(true);
    setError("");
    // ⭐ V3.33 — /api/live/stop fait un nettoyage complet (LiveKit + YouTube
    // + archivage replay) qui dépasse légitimement les 8 s du timeout par
    // défaut d'apiFetch — d'où « API fetch timeout 8000 ms » en boucle.
    // Timeout relevé (25 s) + une relance : la route marque ENDED en base
    // EN PREMIER, donc un 2ᵉ appel est purement idempotent.
    const stopOnce = async () => {
      try {
        const res = await apiFetch("/api/live/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveId }),
          timeoutMs: 25_000,
        });
        if (res.ok) return;
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      } catch (err) {
        // Vérifier l'état réel : l'arrêt a souvent déjà eu lieu.
        try {
          const statsRes = await apiFetch(`/api/live/${liveId}/stats`);
          if (statsRes.ok) {
            const stats = await statsRes.json();
            if (stats.status === "ENDED") return;
          }
        } catch {}
        throw err;
      }
    };
    try {
      try {
        await stopOnce();
      } catch {
        await stopOnce(); // une relance (idempotent côté serveur)
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(false);
    }
  };

  if (status === "SCHEDULED") {
    return (
      <>
        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
          title="Démarrer le live"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        {error && <span className="sr-only">{error}</span>}
      </>
    );
  }

  if (status === "LIVE") {
    return (
      <>
        <button
          type="button"
          onClick={handleStop}
          disabled={loading}
          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
          title="Terminer le live"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        {error && <span className="sr-only">{error}</span>}
      </>
    );
  }

  return null;
}
