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
    try {
      const res = await apiFetch("/api/live/stop", {
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
