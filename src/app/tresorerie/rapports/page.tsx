"use client";

/**
 * ⭐ V3.66/V3.67 — Rapports financiers PDF (Trésorerie).
 *
 * Génération à la demande du « Rapport financier » : synthèse (totaux,
 * solde), situation PAR CAISSE (V3.67), récapitulatif par catégorie,
 * journal détaillé avec solde cumulé — ordre chronologique, une devise
 * par document. Les reçus de don PDF s'émettent depuis le journal
 * (bouton « Reçu » sur chaque recette).
 *
 * POST /tresorerie/api/rapports → binaire application/pdf.
 */

import { useState } from "react";
import { FileText, Loader2, Download, CalendarRange, Info, ShieldCheck } from "lucide-react";
import { DEVISE_CODES, DEVISES } from "@/lib/staff-space/constants";

function dateInputDefaut(jours: number): string {
  const d = new Date(Date.now() - jours * 86400_000);
  return d.toISOString().slice(0, 10);
}

function dateInputAujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TresorerieRapportsPage() {
  const [du, setDu] = useState(dateInputDefaut(90));
  const [au, setAu] = useState(dateInputAujourdhui());
  const [devise, setDevise] = useState("EUR");
  const [generation, setGeneration] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const generer = async () => {
    setGeneration(true);
    setErreur("");
    setSucces("");
    try {
      const res = await fetch("/tresorerie/api/rapports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ du, au, devise }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la génération");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-financier-${devise}-${du}_${au}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSucces(
        "Rapport généré et téléchargé — vérifiez vos téléchargements."
      );
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setGeneration(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]">
          Rapports financiers
        </h1>
        <p className="text-sm text-[#8A8378] mt-1">
          Document officiel de la trésorerie du Mouvement Christ Libère —
          synthèse, situation par caisse, catégories et journal détaillé avec
          solde cumulé. Reçus de don : bouton « Reçu » du journal.
        </p>
      </div>

      {/* Paramètres */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1E0F2B]">
          <CalendarRange className="w-4 h-4 text-[#C9A227]" />
          Paramètres du rapport
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-[#8A8378] mb-1 font-semibold">
              Du
            </label>
            <input
              type="date"
              value={du}
              onChange={(e) => setDu(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#8A8378] mb-1 font-semibold">
              Au
            </label>
            <input
              type="date"
              value={au}
              onChange={(e) => setAu(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#8A8378] mb-1 font-semibold">
              Devise
            </label>
            <select
              value={devise}
              onChange={(e) => setDevise(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
            >
              {DEVISE_CODES.map((d) => (
                <option key={d} value={d}>
                  {(DEVISES as Record<string, { libelle: string }>)[d]?.libelle ?? d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erreur && (
          <p className="text-xs text-[#B3452E]">{erreur}</p>
        )}
        {succes && (
          <p className="flex items-center gap-1.5 text-xs text-[#3F5039]">
            <ShieldCheck className="w-4 h-4" />
            {succes}
          </p>
        )}

        <button
          onClick={generer}
          disabled={generation}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors disabled:opacity-50"
        >
          {generation ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {generation ? "Génération…" : "Générer le rapport financier"}
        </button>
      </div>

      {/* Contenu du document */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[#2A0E3D] flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#C9A227]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1E0F2B]">
              Contenu du document
            </h2>
            <p className="text-[11px] text-[#8A8378]">
              Format A4 · en-tête officielle · pagination · une devise par document
            </p>
          </div>
        </div>
        <ol className="space-y-2.5 text-xs text-[#8A8378] list-decimal list-inside">
          <li>
            <strong className="text-[#1E0F2B]">Synthèse de la période</strong> —
            total des recettes, total des dépenses, solde, nombre de
            mouvements.
          </li>
          <li>
            <strong className="text-[#1E0F2B]">Recettes par catégorie</strong> —
            dons, offrandes, dîmes, financements projet, autres.
          </li>
          <li>
            <strong className="text-[#1E0F2B]">Dépenses par catégorie</strong> —
            charges, matériel, transport, communication, aide, projet, autres.
          </li>
          <li>
            <strong className="text-[#1E0F2B]">Journal des mouvements</strong> —
            chaque écriture avec date, libellé, catégorie, référence, recette
            ou dépense, et SOLDE CUMULÉ ligne par ligne.
          </li>
          <li>
            <strong className="text-[#1E0F2B]">Ligne de total</strong> clôturant
            le document, signée de la date et heure de génération.
          </li>
        </ol>
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FAF6EF] border border-[#8A8378]/15">
        <Info className="w-4 h-4 text-[#C9A227] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#8A8378] leading-relaxed">
          Le rapport est généré en temps réel depuis le journal — il reflète
          toujours l&apos;état exact des écritures au moment de la génération.
          Les montants sont libellés dans la devise sélectionnée (jamais de
          mélange de devises dans un même document) et les corrections
          éventuelles restent tracées dans le journal d&apos;audit.
        </p>
      </div>
    </div>
  );
}
