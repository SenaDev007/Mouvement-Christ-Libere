"use client";

/**
 * ⭐ V3.67 — Situation de caisse MULTICAISSE (Trésorerie).
 *
 *  · CARTES PAR CAISSE : solde d'ouverture, recettes, dépenses, transferts
 *    sortants/entrants, solde courant — tout recalculé depuis le journal ;
 *  · GESTION des caisses : création, correction (y compris solde d'ouverture,
 *    audité avant/après), désactivation/réactivation — une caisse portant
 *    des écritures ne s'efface jamais, elle se désactive ;
 *  · CONSOLIDATION PAR DEVISE : caisses + compartiment « non affecté »
 *    (écritures antérieures à la multicaisse) + témoin de cohérence ;
 *  · détail par MÉTHODE d'encaissement (conservé V3.66).
 *
 * Données : GET /tresorerie/api/caisse · CRUD /tresorerie/api/caisses.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Wallet,
  Loader2,
  Coins,
  Banknote,
  Smartphone,
  Landmark,
  CreditCard,
  HelpCircle,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Pencil,
  Power,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  formaterMontant,
  libelleMethode,
  libelleCaisseType,
  CAISSE_TYPES,
  CAISSE_TYPE_VALEURS,
  DEVISES,
  DEVISE_CODES,
} from "@/lib/staff-space/constants";

interface LigneCaisse {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  openingBalance: number;
  isActive: boolean;
  description: string | null;
  recettes: number;
  depenses: number;
  transfertsSortants: number;
  transfertsEntrants: number;
  solde: number;
  nbMouvements: number;
}

interface CaisseData {
  caisses: LigneCaisse[];
  nonAffecte: {
    devise: string;
    recettes: number;
    depenses: number;
    solde: number;
    nbMouvements: number;
  }[];
  consolide: {
    devise: string;
    soldeCaisses: number;
    soldeNonAffecte: number;
    solde: number;
    nbCaisses: number;
  }[];
  coherent: boolean;
  methodes: {
    devise: string;
    methode: string;
    recettes: number;
    depenses: number;
    solde: number;
  }[];
}

const ICONES_METHODES: Record<string, React.ComponentType<{ className?: string }>> = {
  especes: Banknote,
  mobile_money: Smartphone,
  virement: ArrowRight,
  carte: CreditCard,
  crypto: Coins,
  non_precise: HelpCircle,
};

const ICONES_CAISSES: Record<string, React.ComponentType<{ className?: string }>> = {
  especes: Banknote,
  banque: Landmark,
  mobile_money: Smartphone,
  autre: HelpCircle,
};

/** Formulaire création/correction d'une caisse (modal). */
function FormulaireCaisse({
  caisseInitiale,
  onFermer,
  onSauve,
}: {
  caisseInitiale: LigneCaisse | null;
  onFermer: () => void;
  onSauve: (payload: Record<string, unknown>, id?: string) => Promise<void>;
}) {
  const [nom, setNom] = useState(caisseInitiale?.name || "");
  const [type, setType] = useState(caisseInitiale?.type || "especes");
  const [devise, setDevise] = useState(caisseInitiale?.currency || "EUR");
  const [ouverture, setOuverture] = useState(
    caisseInitiale ? String(caisseInitiale.openingBalance) : "0"
  );
  const [description, setDescription] = useState(caisseInitiale?.description || "");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async () => {
    if (!nom.trim()) {
      setErreur("Le nom de la caisse est requis.");
      return;
    }
    const ouvertureNombre = Number(ouverture.replace(",", "."));
    if (!Number.isFinite(ouvertureNombre)) {
      setErreur("Solde d'ouverture invalide.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await onSauve(
        {
          name: nom.trim(),
          type,
          currency: devise,
          openingBalance: ouvertureNombre,
          description: description.trim() || undefined,
        },
        caisseInitiale?.id
      );
      onFermer();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A0826]/70">
      <div className="bg-white rounded-2xl border border-[#C9A227]/25 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#8A8378]/15">
          <h2 className="text-lg font-bold text-[#1E0F2B]">
            {caisseInitiale ? "Modifier la caisse" : "Nouvelle caisse"}
          </h2>
          <button
            onClick={onFermer}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8A8378] hover:bg-[#FAF6EF]"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
              Nom de la caisse
            </label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Caisse principale espèces"
              maxLength={80}
              className="w-full px-4 py-2.5 rounded-lg border border-[#8A8378]/25 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                Type de caisse
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/25 text-sm bg-white focus:outline-none focus:border-[#C9A227]"
              >
                {CAISSE_TYPE_VALEURS.map((t) => (
                  <option key={t} value={t}>
                    {libelleCaisseType(t)}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#8A8378] mt-1">
                {CAISSE_TYPES[type as keyof typeof CAISSE_TYPES]?.description}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                Devise tenue
              </label>
              <select
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
                disabled={Boolean(caisseInitiale)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/25 text-sm bg-white focus:outline-none focus:border-[#C9A227] disabled:bg-[#FAF6EF] disabled:text-[#8A8378]"
              >
                {DEVISE_CODES.map((d) => (
                  <option key={d} value={d}>
                    {DEVISES[d as keyof typeof DEVISES].libelle}
                  </option>
                ))}
              </select>
              {caisseInitiale && (
                <p className="text-[10px] text-[#B3452E] mt-1">
                  La devise ne change plus après création.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
              Solde d&apos;ouverture {caisseInitiale ? "(correction audité)" : ""}
            </label>
            <input
              value={ouverture}
              onChange={(e) => setOuverture(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-lg border border-[#8A8378]/25 text-sm focus:outline-none focus:border-[#C9A227]"
            />
            <p className="text-[10px] text-[#8A8378] mt-1">
              Encaisse détenue par cette caisse avant la première écriture au
              journal. Toute correction est tracée (avant → après) dans le
              journal d&apos;audit.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
              Précisions (facultatif)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Banque, n° de compte, responsable…"
              maxLength={300}
              className="w-full px-4 py-2.5 rounded-lg border border-[#8A8378]/25 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          {erreur && (
            <p className="text-xs text-[#B3452E] bg-[#B3452E]/10 border border-[#B3452E]/25 rounded-lg px-3 py-2">
              {erreur}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onFermer}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#8A8378]/25 text-sm font-medium text-[#1E0F2B] hover:bg-[#FAF6EF]"
            >
              Annuler
            </button>
            <button
              onClick={soumettre}
              disabled={envoi}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#2A0E3D] text-[#DDBE55] text-sm font-bold hover:bg-[#3D1A54] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
              {caisseInitiale ? "Enregistrer" : "Créer la caisse"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TresorerieCaissePage() {
  const [data, setData] = useState<CaisseData | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [caisseEditee, setCaisseEditee] = useState<LigneCaisse | null>(null);
  const [creation, setCreation] = useState(false);
  const [actionEnCours, setActionEnCours] = useState("");
  const [onglet, setOnglet] = useState<"caisses" | "methodes">("caisses");

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/tresorerie/api/caisse", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de chargement");
      setData(json);
      setErreur("");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const sauverCaisse = async (
    payload: Record<string, unknown>,
    id?: string
  ) => {
    const res = await fetch(
      id ? `/tresorerie/api/caisses/${id}` : "/tresorerie/api/caisses",
      {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erreur d'enregistrement");
    await charger();
  };

  const basculerActive = async (caisse: LigneCaisse) => {
    setActionEnCours(caisse.id);
    try {
      const res = await fetch(`/tresorerie/api/caisses/${caisse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !caisse.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      await charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setActionEnCours("");
    }
  };

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8A8378]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (erreur && !data) {
    return (
      <div className="max-w-xl mx-auto mt-12 px-4 py-6 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#B3452E] text-sm">
        {erreur}
      </div>
    );
  }

  const nbCaisses = data?.caisses.length || 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]">
            Situation de caisse
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Multicaisse — soldes recalculés en direct depuis le journal et les
            soldes d&apos;ouverture : la caisse affichée est TOUJOURS la caisse
            réelle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/tresorerie/transactions"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#8A8378]/25 text-sm font-medium text-[#1E0F2B] hover:bg-white transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4 text-[#8C5FA8]" />
            Journal & transferts
          </a>
          <button
            onClick={() => setCreation(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2A0E3D] text-[#DDBE55] text-sm font-bold hover:bg-[#3D1A54] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle caisse
          </button>
        </div>
      </div>

      {erreur && (
        <p className="text-xs text-[#B3452E] bg-[#B3452E]/10 border border-[#B3452E]/25 rounded-lg px-3 py-2">
          {erreur}
        </p>
      )}

      {/* Témoin de cohérence */}
      {data && !data.coherent && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30">
          <AlertTriangle className="w-4 h-4 text-[#B3452E] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#B3452E] leading-relaxed">
            Écart détecté entre la somme des caisses et le journal
            (Σ ouvertures + recettes − dépenses). Vérifiez les écritures de
            transfert et les soldes d&apos;ouverture — le détail par caisse
            ci-dessous localise l&apos;écart.
          </p>
        </div>
      )}

      {/* Première fois : aucune caisse */}
      {nbCaisses === 0 && (data?.nonAffecte.length || 0) === 0 && (
        <div className="bg-white rounded-xl border border-[#8A8378]/15 px-6 py-14 text-center">
          <Wallet className="w-8 h-8 text-[#8A8378]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] max-w-md mx-auto">
            Aucun mouvement au journal et aucune caisse déclarée. Créez vos
            caisses (espèces, banque, mobile money…) avec leurs soldes
            d&apos;ouverture — la situation s&apos;établit ensuite à chaque
            écriture.
          </p>
        </div>
      )}

      {/* Onglets caisses / méthodes */}
      <div className="flex gap-1 bg-[#FAF6EF] border border-[#8A8378]/15 rounded-xl p-1 w-fit">
        <button
          onClick={() => setOnglet("caisses")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            onglet === "caisses"
              ? "bg-[#2A0E3D] text-[#DDBE55]"
              : "text-[#8A8378] hover:text-[#1E0F2B]"
          }`}
        >
          Par caisse ({nbCaisses})
        </button>
        <button
          onClick={() => setOnglet("methodes")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            onglet === "methodes"
              ? "bg-[#2A0E3D] text-[#DDBE55]"
              : "text-[#8A8378] hover:text-[#1E0F2B]"
          }`}
        >
          Par méthode
        </button>
      </div>

      {onglet === "caisses" && (
        <>
          {/* Cartes par caisse */}
          {data && data.caisses.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {data.caisses.map((c) => {
                const Icone =
                  ICONES_CAISSES[c.type] || HelpCircle;
                const positif = c.solde >= 0;
                return (
                  <div
                    key={c.id}
                    className={`bg-white rounded-xl border ${
                      c.isActive
                        ? "border-[#8A8378]/15"
                        : "border-[#8A8378]/10 opacity-60"
                    } p-5 relative overflow-hidden`}
                  >
                    {!c.isActive && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#8A8378]/15 text-[#6B6459] text-[10px] font-bold">
                        Désactivée
                      </span>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#2A0E3D] flex items-center justify-center flex-shrink-0">
                          <Icone className="w-5 h-5 text-[#DDBE55]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#1E0F2B] truncate">
                            {c.name}
                          </p>
                          <p className="text-[11px] text-[#8A8378]">
                            {libelleCaisseType(c.type)} · {c.currency}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setCaisseEditee(c)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:text-[#1E0F2B] hover:bg-[#FAF6EF]"
                          aria-label={`Modifier ${c.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => basculerActive(c)}
                          disabled={actionEnCours === c.id}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:text-[#B3452E] hover:bg-[#FAF6EF] disabled:opacity-40"
                          aria-label={
                            c.isActive ? `Désactiver ${c.name}` : `Réactiver ${c.name}`
                          }
                        >
                          {actionEnCours === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p
                      className={`text-2xl font-bold ${positif ? "text-[#2A0E3D]" : "text-[#B3452E]"}`}
                    >
                      {formaterMontant(c.solde, c.currency)}
                    </p>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-[11px] text-[#8A8378]">
                      <span>
                        Ouverture :{" "}
                        <b className="text-[#1E0F2B]">
                          {formaterMontant(c.openingBalance, c.currency)}
                        </b>
                      </span>
                      <span>
                        {c.nbMouvements} mouvement{c.nbMouvements > 1 ? "s" : ""}
                      </span>
                      <span className="text-[#3F5039]">
                        + {formaterMontant(c.recettes, c.currency)} recettes
                      </span>
                      <span className="text-[#B3452E]">
                        − {formaterMontant(c.depenses, c.currency)} dépenses
                      </span>
                      {c.transfertsSortants > 0 && (
                        <span className="text-[#6B4480]">
                          ↗ {formaterMontant(c.transfertsSortants, c.currency)}{" "}
                          transférés
                        </span>
                      )}
                      {c.transfertsEntrants > 0 && (
                        <span className="text-[#6B4480]">
                          ↘ {formaterMontant(c.transfertsEntrants, c.currency)}{" "}
                          reçus
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-[10px] text-[#8A8378]/80 mt-2 truncate">
                        {c.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Non affecté */}
          {data && data.nonAffecte.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-3 px-1">
                Écritures non affectées (antérieures à la multicaisse)
              </h2>
              <div className="bg-white rounded-xl border border-[#8A8378]/15 divide-y divide-[#8A8378]/10">
                {data.nonAffecte.map((n) => (
                  <div key={n.devise} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EF] flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-5 h-5 text-[#A3821C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1E0F2B]">
                        Non affecté · {n.devise}
                      </p>
                      <p className="text-[11px] text-[#8A8378]">
                        {n.nbMouvements} écriture(s) saisies avant la
                        multicaisse — rattachez-les à une caisse par correction
                        (journal).
                      </p>
                    </div>
                    <p
                      className={`text-sm font-bold flex-shrink-0 ${n.solde >= 0 ? "text-[#3F5039]" : "text-[#B3452E]"}`}
                    >
                      {formaterMontant(n.solde, n.devise)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consolidation par devise */}
          {data && data.consolide.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-3 px-1">
                Consolidation par devise
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {data.consolide.map((d) => {
                  const deviseInfo = (DEVISES as Record<string, { libelle: string }>)[
                    d.devise
                  ];
                  return (
                    <div
                      key={d.devise}
                      className="bg-[#2A0E3D] rounded-xl border border-[#C9A227]/20 p-5 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Landmark className="w-4 h-4 text-[#C9A227]" />
                          <span className="text-sm font-bold text-[#FAF6EF]">
                            {deviseInfo?.libelle ?? d.devise}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#FAF6EF]/50">
                          {d.nbCaisses} caisse{d.nbCaisses > 1 ? "s" : ""}
                          {d.soldeNonAffecte !== 0 ? " + non affecté" : ""}
                        </span>
                      </div>
                      <p
                        className={`text-2xl font-bold ${d.solde >= 0 ? "text-[#DDBE55]" : "text-[#E88A76]"}`}
                      >
                        {formaterMontant(d.solde, d.devise)}
                      </p>
                      <div className="flex gap-4 mt-2 text-[11px]">
                        <span className="text-[#FAF6EF]/70">
                          Caisses : {formaterMontant(d.soldeCaisses, d.devise)}
                        </span>
                        {d.soldeNonAffecte !== 0 && (
                          <span className="text-[#FAF6EF]/50">
                            Non affecté : {formaterMontant(d.soldeNonAffecte, d.devise)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Par méthode (conservé V3.66) */}
      {onglet === "methodes" && data && data.methodes.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-3 px-1">
            Détail par méthode d&apos;encaissement
          </h2>
          <div className="bg-white rounded-xl border border-[#8A8378]/15 divide-y divide-[#8A8378]/10">
            {data.methodes
              .slice()
              .sort((a, b) => b.solde - a.solde)
              .map((m) => {
                const Icone = ICONES_METHODES[m.methode] || HelpCircle;
                const positif = m.solde >= 0;
                return (
                  <div
                    key={`${m.devise}:${m.methode}`}
                    className="flex items-center gap-4 px-5 py-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EF] flex items-center justify-center flex-shrink-0">
                      <Icone className="w-5 h-5 text-[#A3821C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1E0F2B]">
                        {libelleMethode(m.methode === "non_precise" ? null : m.methode) ===
                        "Non précisé"
                          ? "Méthode non précisée"
                          : libelleMethode(m.methode)}
                      </p>
                      <p className="text-[11px] text-[#8A8378]">
                        {formaterMontant(m.recettes, m.devise)} encaissés ·{" "}
                        {formaterMontant(m.depenses, m.devise)} décaissés
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-bold ${positif ? "text-[#3F5039]" : "text-[#B3452E]"}`}
                      >
                        {formaterMontant(m.solde, m.devise)}
                      </p>
                      <p className="text-[10px] text-[#8A8378]/60">{m.devise}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Note traçabilité */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FAF6EF] border border-[#8A8378]/15">
        <CheckCircle2 className="w-4 h-4 text-[#5B7052] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#8A8378] leading-relaxed">
          Traçabilité multicaisse : chaque écriture porte sa caisse, les
          transferts sont internes (sortie d&apos;une caisse = entrée dans une
          autre), les soldes d&apos;ouverture et leurs corrections sont tracés
          dans le journal d&apos;audit, et les soldes ne sont jamais stockés —
          toujours la somme exacte des écritures et des ouvertures.
        </p>
      </div>

      {/* Modals */}
      {creation && (
        <FormulaireCaisse
          caisseInitiale={null}
          onFermer={() => setCreation(false)}
          onSauve={sauverCaisse}
        />
      )}
      {caisseEditee && (
        <FormulaireCaisse
          caisseInitiale={caisseEditee}
          onFermer={() => setCaisseEditee(null)}
          onSauve={sauverCaisse}
        />
      )}
    </div>
  );
}
