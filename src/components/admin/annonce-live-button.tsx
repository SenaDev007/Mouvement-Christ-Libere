"use client";

import { useState } from "react";
import { Megaphone, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface AnnonceLiveButtonProps {
  liveId: string;
  /** Statut du live — CANCELLED annonce l'annulation, sinon l'annonce du live. */
  status?: string | null;
}

interface EtapeRapport {
  etape: string;
  ok: boolean;
  detail?: string;
  erreur?: string;
}

/**
 * ⭐ V3.40 — Bouton « Annoncer maintenant » du module Lives.
 *
 * Le relay automatique (création V3.36, reprogrammation/annulation V3.38)
 * est BEST-EFFORT et différé (after) : si son envoi échoue en coulisses,
 * l'administrateur n'a AUCUN signal et la communauté n'est pas informée.
 *
 * Ce bouton est le filet de sécurité visible :
 *   - un clic relance l'annonce (POST /admin/api/lives/[id]/annonce) ;
 *   - le RÉSULTAT est affiché : « Annonce envoyée ✓ » ou le DIAGNOSTIC
 *     étape par étape (l'étape fautive et son erreur exacte) — plus
 *     besoin des logs Vercel pour comprendre un échec ;
 *   - statut CANCELLED → annonce d'annulation automatiquement.
 */
export function AnnonceLiveButton({ liveId, status }: AnnonceLiveButtonProps) {
  const [loading, setLoading] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etapes, setEtapes] = useState<EtapeRapport[] | null>(null);

  const handleAnnoncer = async () => {
    setLoading(true);
    setEnvoye(false);
    setErreur(null);
    setEtapes(null);
    try {
      const res = await fetch(`/admin/api/lives/${liveId}/annonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: status === "CANCELLED" ? "ANNULE" : "PROGRAMME",
        }),
      });
      const data = (await res.json()) as {
        succes?: boolean;
        etapes?: EtapeRapport[];
        error?: string;
      };
      if (res.ok && data.succes) {
        setEnvoye(true);
        // Le libellé « Envoyée ✓ » s'estompe après quelques secondes.
        setTimeout(() => setEnvoye(false), 6000);
      } else {
        // Échec : montrer le diagnostic (étapes + erreurs) quand il est
        // disponible — l'administrateur voit la cause immédiatement.
        setErreur(data.error || "Échec de l'annonce");
        setEtapes(data.etapes ?? null);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const etapesKO = etapes?.filter((e) => !e.ok) ?? [];

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleAnnoncer}
        disabled={loading}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#A3821C] bg-[#C9A227]/10 hover:bg-[#C9A227]/20 disabled:opacity-50 transition-colors"
        title="Envoyer l'annonce de ce live dans le canal « Annonces officielles » de Yeshua Connect (filet de sécurité si l'envoi automatique échoue)"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : envoye ? (
          <CheckCircle2 className="w-3 h-3 text-[#5B7052]" />
        ) : (
          <Megaphone className="w-3 h-3" />
        )}
        {envoye ? "Envoyée ✓" : "Annoncer"}
      </button>

      {erreur && (
        <div className="max-w-xs text-[11px] leading-snug bg-red-50 border border-red-200/60 text-red-700 rounded-lg px-2 py-1.5">
          <span className="inline-flex items-center gap-1 font-bold">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {erreur}
          </span>
          {etapesKO.length > 0 && (
            <ul className="mt-1 space-y-0.5 pl-4 list-disc">
              {etapesKO.map((e) => (
                <li key={e.etape}>
                  <span className="font-semibold">{e.etape}</span>
                  {e.erreur ? ` : ${e.erreur.slice(0, 140)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
