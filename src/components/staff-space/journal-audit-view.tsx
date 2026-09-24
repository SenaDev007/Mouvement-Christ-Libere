"use client";

/**
 * ⭐ V3.67 — Journal d'audit d'un espace (gouvernance).
 *
 * Affiche QUI a fait QUOI, QUAND, sur QUOI : connexions, créations,
 * corrections, suppressions (avec motif), publications, transferts,
 * caisses, reçus émis, accréditations STAFF_*. Les métadonnées sont
 * montrées en clair — la transparence interne fonde la gouvernance.
 *
 * Utilisé par /secretariat/audit et /tresorerie/audit (endpoint propre).
 */

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { Pagination } from "./pagination";

interface EntreeAudit {
  id: string;
  action: string;
  userId: string;
  userName: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

const PAR_PAGE = 25;

/** Libellé humain d'une action brute (« TRESORERIE_CAISSE_UPDATE » → …). */
function libelleAction(action: string): { libelle: string; couleur: string } {
  const map: Record<string, { libelle: string; couleur: string }> = {
    LOGIN: { libelle: "Connexion", couleur: "text-[#BDB4C9]" },
    CREATE: { libelle: "Création", couleur: "text-[#A3C9B0]" },
    UPDATE: { libelle: "Correction", couleur: "text-[#DDBE55]" },
    DELETE: { libelle: "Suppression", couleur: "text-[#E08B6D]" },
    TRANSFERT: { libelle: "Transfert entre caisses", couleur: "text-[#C9AEE3]" },
    RECU_PDF: { libelle: "Reçu PDF émis", couleur: "text-[#C9AEE3]" },
    TRANSMETTRE: { libelle: "Demande transmise", couleur: "text-[#A3C9B0]" },
    TRAITER: { libelle: "Demande traitée", couleur: "text-[#C9AEE3]" },
    ARCHIVER: { libelle: "Demande archivée", couleur: "text-[#BDB4C9]" },
    ROUVRIR: { libelle: "Demande rouverte", couleur: "text-[#DDBE55]" },
    STAFF_CREATE: { libelle: "Accréditation créée", couleur: "text-[#E08B6D]" },
    STAFF_UPDATE: { libelle: "Accréditation modifiée", couleur: "text-[#DDBE55]" },
  };
  // TRESORERIE_CREATE → CREATE ; DEMANDE_TRANSMETTRE → TRANSMETTRE…
  const suffixe = action.split("_").slice(1).join("_");
  return (
    map[suffixe] || {
      libelle: action
        .split("_")
        .slice(1)
        .join(" ")
        .toLowerCase(),
      couleur: "text-[#FAF6EF]",
    }
  );
}

/** Résumé lisible des métadonnées (limité, sans JSON brut). */
function resumerMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const m = metadata as Record<string, unknown>;
  const fragments: string[] = [];
  if (typeof m.libelle === "string") fragments.push(m.libelle);
  if (typeof m.titre === "string") fragments.push(m.titre);
  if (typeof m.caisse === "string") fragments.push(`caisse « ${m.caisse} »`);
  if (typeof m.source === "string" && typeof m.destination === "string")
    fragments.push(`${m.source} → ${m.destination}`);
  if (typeof m.demandeur === "string") fragments.push(m.demandeur);
  if (typeof m.compte === "string") fragments.push(m.compte);
  if (typeof m.donateur === "string") fragments.push(m.donateur);
  if (typeof m.montant === "number")
    fragments.push(
      `${m.montant}${typeof m.devise === "string" ? ` ${m.devise}` : ""}`
    );
  if (typeof m.motif === "string" && m.motif) fragments.push(`motif : « ${m.motif} »`);
  if (m.changements && typeof m.changements === "object") {
    const keys = Object.keys(m.changements as Record<string, unknown>);
    if (keys.length > 0) fragments.push(`modifié : ${keys.join(", ")}`);
  }
  return fragments.slice(0, 4).join(" · ");
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function JournalAuditView({
  endpoint,
  titreEspace,
}: {
  endpoint: string;
  titreEspace: string;
}) {
  const [items, setItems] = useState<EntreeAudit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    try {
      setChargement(true);
      const res = await fetch(
        `${endpoint}?limit=${PAR_PAGE}&offset=${(page - 1) * PAR_PAGE}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de chargement");
      setItems(json.items || []);
      setTotal(json.total || 0);
      setErreur("");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, [endpoint, page]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif text-[#FAF6EF]">
            Journal d&apos;audit
          </h1>
          <p className="text-sm text-[#BDB4C9] mt-1">
            Gouvernance {titreEspace.toLowerCase()} — chaque action est tracée :
            qui, quoi, quand. Les suppressions portent leur motif.
          </p>
        </div>
        <button
          onClick={charger}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A0826]/70 border border-[#C9A227]/20 text-sm font-medium text-[#FAF6EF] hover:bg-[#C9A227]/10 transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Rafraîchir
        </button>
      </div>

      {chargement && items.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-[#BDB4C9]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : erreur ? (
        <div className="max-w-xl mx-auto mt-12 px-4 py-6 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#E08B6D] text-sm">
          {erreur}
        </div>
      ) : total === 0 ? (
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 px-6 py-14 text-center">
          <ShieldCheck className="w-8 h-8 text-[#FAF6EF]/25 mx-auto mb-3" />
          <p className="text-sm text-[#BDB4C9]">
            Aucune action tracée pour le moment — le journal se remplit dès la
            première connexion ou saisie.
          </p>
        </div>
      ) : (
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 overflow-hidden">
          <ul className="divide-y divide-[#C9A227]/10">
            {items.map((e) => {
              const { libelle, couleur } = libelleAction(e.action);
              const resume = resumerMetadata(e.metadata);
              return (
                <li key={e.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold ${couleur}`}>
                        {libelle}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-[#FAF6EF]/40 font-semibold">
                        {e.action}
                      </span>
                    </div>
                    {resume && (
                      <p className="text-[12px] text-[#FAF6EF]/80 mt-1 break-words">
                        {resume}
                      </p>
                    )}
                    <p className="text-[11px] text-[#BDB4C9] mt-1">
                      Par {e.userName || "compte supprimé"} · {formaterDate(e.createdAt)}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#FAF6EF]/35 font-mono flex-shrink-0 hidden sm:block">
                    {(e.targetId || e.id).substring(0, 10)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[#C9A227]/10 px-4 pb-3">
            <Pagination
              total={total}
              page={page}
              parPage={PAR_PAGE}
              onChange={setPage}
            />
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#C9A227]/10 border border-[#C9A227]/15">
        <ShieldCheck className="w-4 h-4 text-[#C9A227] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#BDB4C9] leading-relaxed">
          Ce journal est la source de vérité de la gouvernance : il ne peut
          être ni modifié ni supprimé depuis les espaces. Les super admins
          (Sœur Afrika, Pasteur Kongo) en conservent la supervision complète.
        </p>
      </div>
    </div>
  );
}
