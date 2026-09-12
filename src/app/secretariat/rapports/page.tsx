"use client";

/**
 * ⭐ V3.66 — Rapports PDF du Secrétariat.
 *
 * Génération à la demande des registres officiels :
 *  · « Registre des demandes de rencontre » (période + filtre statut) ;
 *  · « Registre des annonces du ministère » (période).
 *
 * Le PDF est généré côté serveur (pdf-lib, polices + €, logo officiel) et
 * téléchargé directement — POST /secretariat/api/rapports.
 */

import { useState } from "react";
import { FileText, Loader2, Download, CalendarRange, Info } from "lucide-react";
import { DEMANDE_STATUTS } from "@/lib/staff-space/constants";

function dateInputDefaut(jours: number): string {
  const d = new Date(Date.now() - jours * 86400_000);
  return d.toISOString().slice(0, 10);
}

function dateInputAujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SecretariatRapportsPage() {
  const [du, setDu] = useState(dateInputDefaut(90));
  const [au, setAu] = useState(dateInputAujourdhui());
  const [statut, setStatut] = useState("");
  const [generation, setGeneration] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");

  const generer = async (type: "demandes" | "annonces") => {
    setGeneration(type);
    setErreur("");
    try {
      const res = await fetch("/secretariat/api/rapports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, du, au, statut: statut || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la génération");
      }
      // Téléchargement direct du binaire.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registre-${type}-${du}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setGeneration(null);
    }
  };

  const rapports = [
    {
      type: "demandes" as const,
      titre: "Registre des demandes de rencontre",
      description:
        "Toutes les demandes de la période : demandeur, contact, serviteur, objet, message, urgence, statut et transmission. Document officiel du secrétariat.",
      bouton: "Générer le registre",
    },
    {
      type: "annonces" as const,
      titre: "Registre des annonces du ministère",
      description:
        "Annonces publiées et brouillons de la période, par catégorie, avec mention du relais Yeshua Connect.",
      bouton: "Générer le registre",
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]">
          Rapports PDF
        </h1>
        <p className="text-sm text-[#8A8378] mt-1">
          Documents officiels du secrétariat — en-tête du ministère, période
          couverte, date de génération et pagination.
        </p>
      </div>

      {/* Période commune */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1E0F2B]">
          <CalendarRange className="w-4 h-4 text-[#C9A227]" />
          Période couverte
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] text-[#8A8378] mb-1 font-semibold">
              Du
            </label>
            <input
              type="date"
              value={du}
              onChange={(e) => setDu(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
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
              className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#8A8378] mb-1 font-semibold">
              Statut (demandes)
            </label>
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(DEMANDE_STATUTS).map(([v, s]) => (
                <option key={v} value={v}>
                  {s.libelle}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#B3452E] text-xs border border-[#B3452E]/30">
          {erreur}
        </div>
      )}

      {/* Rapports disponibles */}
      <div className="grid md:grid-cols-2 gap-4">
        {rapports.map((r) => (
          <div
            key={r.type}
            className="bg-white rounded-xl border border-[#8A8378]/15 p-5 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-[#2A0E3D] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#C9A227]" />
              </div>
              <h2 className="text-sm font-bold text-[#1E0F2B]">{r.titre}</h2>
            </div>
            <p className="text-xs text-[#8A8378] leading-relaxed flex-1">
              {r.description}
            </p>
            <button
              onClick={() => generer(r.type)}
              disabled={generation !== null}
              className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors disabled:opacity-50"
            >
              {generation === r.type ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {generation === r.type ? "Génération…" : r.bouton}
            </button>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FAF6EF] border border-[#8A8378]/15">
        <Info className="w-4 h-4 text-[#C9A227] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#8A8378] leading-relaxed">
          Les registres sont générés en temps réel depuis les données du
          secrétariat — ils reflètent toujours l&apos;état exact du registre au
          moment de la génération. Format A4, en-tête officielle du Mouvement
          Christ Libère, pagination et date d&apos;émission sur chaque page.
        </p>
      </div>
    </div>
  );
}
