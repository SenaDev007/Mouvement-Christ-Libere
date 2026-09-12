"use client";

/**
 * ⭐ V3.67 — Situation de caisse MULTICAISSE (Trésorerie).
 *
 *  · CARTES PAR CAISSE : solde d'ouverture, recettes, dépenses, transferts
 *    sortants/entrants, solde courant — tout recalculé depuis le journal ;
 *  · GESTION des caisses : création (⭐ V3.72 — sélecteur de caisses
 *    prédéfinies : principale, don, offrande, dîme, subvention… + nom libre),
 *    correction (y compris solde d'ouverture, audité avant/après),
 *    désactivation/réactivation — une caisse portant des écritures ne
 *    s'efface jamais, elle se désactive ;
 *  · ⭐ V3.72 — TRANSFERT ENTRE CAISSES directement depuis la situation
 *    de caisse (bouton en-tête + bouton rapide sur chaque carte) ;
 *  · CONSOLIDATION PAR DEVISE : caisses + compartiment « non affecté »
 *    (écritures antérieures à la multicaisse) + témoin de cohérence ;
 *  · détail par MÉTHODE d'encaissement (conservé V3.66).
 *
 * Données : GET /tresorerie/api/caisse · CRUD /tresorerie/api/caisses ·
 * transferts : POST /tresorerie/api/transactions (type TRANSFERT, V3.67).
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
  CAISSES_PREDEFINIES,
  CAISSES_PREDEFINIES_NOMS,
  CAISSE_PREDEFINIE_AUTRE,
  descriptionCaissePredefinie,
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
  // ⭐ V3.72 — sélecteur de caisse prédéfinie : pré-sélectionnée en création,
  // en édition elle retrouve la prédéfinie si le nom correspond exactement.
  const [predefinie, setPredefinie] = useState(
    caisseInitiale
      ? CAISSES_PREDEFINIES_NOMS.includes(caisseInitiale.name)
        ? caisseInitiale.name
        : CAISSE_PREDEFINIE_AUTRE
      : CAISSES_PREDEFINIES[0].nom
  );
  const [type, setType] = useState(caisseInitiale?.type || "especes");
  const [devise, setDevise] = useState(caisseInitiale?.currency || "EUR");
  const [ouverture, setOuverture] = useState(
    caisseInitiale ? String(caisseInitiale.openingBalance) : "0"
  );
  const [description, setDescription] = useState(caisseInitiale?.description || "");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const changerPredefinie = (valeur: string) => {
    setPredefinie(valeur);
    // Sélection d'une prédéfinie → le nom suit (reste éditable ensuite).
    if (valeur !== CAISSE_PREDEFINIE_AUTRE) {
      setNom(valeur);
    }
    // Bascule vers « Autre » en création → champ vidé pour saisie libre.
    if (valeur === CAISSE_PREDEFINIE_AUTRE && !caisseInitiale) {
      setNom("");
    }
  };

  const changerNom = (valeur: string) => {
    setNom(valeur);
    // Le nom s'écarte de la prédéfinie sélectionnée → le sélecteur bascule
    // honnêtement sur « Autre » (pas de prédéfinie affichée mensongère).
    if (
      predefinie !== CAISSE_PREDEFINIE_AUTRE &&
      valeur !== predefinie
    ) {
      setPredefinie(CAISSE_PREDEFINIE_AUTRE);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/70">
      <div className="bg-white rounded-2xl border border-[#C9A227]/25 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#8A857C]/15">
          <h2 className="text-lg font-bold text-[#000000]">
            {caisseInitiale ? "Modifier la caisse" : "Nouvelle caisse"}
          </h2>
          <button
            onClick={onFermer}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8A857C] hover:bg-[#F0E9DE]"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1">
              Caisse prédéfinie
            </label>
            <select
              value={predefinie}
              onChange={(e) => changerPredefinie(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm bg-white focus:outline-none focus:border-[#C9A227]"
            >
              {CAISSES_PREDEFINIES.map((c) => (
                <option key={c.nom} value={c.nom}>
                  {c.nom}
                </option>
              ))}
              <option value={CAISSE_PREDEFINIE_AUTRE}>
                Autre — nom personnalisé
              </option>
            </select>
            <p className="text-[10px] text-[#8A857C] mt-1">
              {predefinie === CAISSE_PREDEFINIE_AUTRE
                ? "Saisissez librement le nom de la caisse ci-dessous."
                : descriptionCaissePredefinie(predefinie) || ""}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1">
              Nom de la caisse
              {predefinie !== CAISSE_PREDEFINIE_AUTRE && " (pré-rempli, ajustable)"}
            </label>
            <input
              value={nom}
              onChange={(e) => changerNom(e.target.value)}
              placeholder="Caisse principale espèces"
              maxLength={80}
              className="w-full px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm focus:outline-none focus:border-[#C9A227]"
            />
            <p className="text-[10px] text-[#8A857C] mt-1">
              Le nom reste modifiable : affinez-le après sélection de la
              caisse prédéfinie (ex. « Caisse offrande — culte du dimanche »).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Type de caisse
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm bg-white focus:outline-none focus:border-[#C9A227]"
              >
                {CAISSE_TYPE_VALEURS.map((t) => (
                  <option key={t} value={t}>
                    {libelleCaisseType(t)}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#8A857C] mt-1">
                {CAISSE_TYPES[type as keyof typeof CAISSE_TYPES]?.description}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Devise tenue
              </label>
              <select
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
                disabled={Boolean(caisseInitiale)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm bg-white focus:outline-none focus:border-[#C9A227] disabled:bg-[#F0E9DE] disabled:text-[#8A857C]"
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
            <label className="block text-xs font-semibold text-[#000000] mb-1">
              Solde d&apos;ouverture {caisseInitiale ? "(correction audité)" : ""}
            </label>
            <input
              value={ouverture}
              onChange={(e) => setOuverture(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm focus:outline-none focus:border-[#C9A227]"
            />
            <p className="text-[10px] text-[#8A857C] mt-1">
              Encaisse détenue par cette caisse avant la première écriture au
              journal. Toute correction est tracée (avant → après) dans le
              journal d&apos;audit.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1">
              Précisions (facultatif)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Banque, n° de compte, responsable…"
              maxLength={300}
              className="w-full px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm focus:outline-none focus:border-[#C9A227]"
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
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm font-medium text-[#000000] hover:bg-[#F0E9DE]"
            >
              Annuler
            </button>
            <button
              onClick={soumettre}
              disabled={envoi}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#000000] text-[#DDBE55] text-sm font-bold hover:bg-[#161513] disabled:opacity-50 flex items-center justify-center gap-2"
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

/** ⭐ V3.72 — Formulaire de TRANSFERT entre caisses (modal, situation de
 * caisse). Réutilise l'API V3.67 (POST /tresorerie/api/transactions,
 * type TRANSFERT) : contrôles serveur de devise, fonds et traçabilité audit. */
function FormulaireTransfert({
  caisses,
  caisseSourceInitialeId,
  onFermer,
  onTransfere,
}: {
  caisses: LigneCaisse[];
  caisseSourceInitialeId: string | null;
  onFermer: () => void;
  onTransfere: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const actives = caisses.filter((c) => c.isActive);
  const [caisseId, setCaisseId] = useState(
    caisseSourceInitialeId || actives[0]?.id || ""
  );
  const [caisseDestinationId, setCaisseDestinationId] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [libelle, setLibelle] = useState("");
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const source = actives.find((c) => c.id === caisseId) || null;
  // Le serveur refuse les transferts entre devises : on ne propose en
  // destination que les caisses actives de la MÊME devise que la source.
  const destinations = source
    ? actives.filter((c) => c.id !== source.id && c.currency === source.currency)
    : [];

  // Si la destination devient invalide (changement de source), on la réinitialise.
  const destinationValide =
    destinations.some((d) => d.id === caisseDestinationId);
  const destinationEffective = destinationValide
    ? caisseDestinationId
    : destinations[0]?.id || "";

  const montantNombre = Number(montant.replace(",", "."));
  const fondsInsuffisants =
    source !== null &&
    montant.trim() !== "" &&
    Number.isFinite(montantNombre) &&
    montantNombre > source.solde + 0.01;

  const soumettre = async () => {
    if (!source) {
      setErreur("Choisissez une caisse source.");
      return;
    }
    if (!destinationEffective) {
      setErreur(
        `Aucune caisse de destination en ${source.currency} — créez-en une d'abord (les transferts se font à devise constante).`
      );
      return;
    }
    if (caisseId === destinationEffective) {
      setErreur("La source et la destination doivent être différentes.");
      return;
    }
    if (!libelle.trim()) {
      setErreur("Le libellé est requis.");
      return;
    }
    if (!Number.isFinite(montantNombre) || montantNombre <= 0) {
      setErreur("Montant invalide — un nombre strictement positif est attendu.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await onTransfere({
        type: "TRANSFERT",
        caisseId,
        caisseDestinationId: destinationEffective,
        amount: Math.round(montantNombre * 100) / 100,
        label: libelle.trim(),
        date,
        reference: reference.trim() || undefined,
      });
      onFermer();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/70 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#C9A227]/25 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto my-8">
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#8A857C]/15">
          <div>
            <h2 className="text-lg font-bold text-[#000000] flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-[#A3821C]" />
              Transfert entre caisses
            </h2>
            <p className="text-[11px] text-[#8A857C] mt-0.5">
              Mouvement interne : l&apos;argent sort d&apos;une caisse et entre
              dans l&apos;autre — le total consolidé ne change pas.
            </p>
          </div>
          <button
            onClick={onFermer}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8A857C] hover:bg-[#F0E9DE]"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Caisse source *
              </label>
              <select
                value={caisseId}
                onChange={(e) => setCaisseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm bg-white focus:outline-none focus:border-[#C9A227]"
              >
                {actives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {formaterMontant(c.solde, c.currency)}
                  </option>
                ))}
              </select>
              {source && (
                <p className="text-[10px] text-[#8A857C] mt-1">
                  Solde disponible :{" "}
                  <b className="text-[#000000]">
                    {formaterMontant(source.solde, source.currency)}
                  </b>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Caisse destination *
              </label>
              <select
                value={destinationEffective}
                onChange={(e) => setCaisseDestinationId(e.target.value)}
                disabled={destinations.length === 0}
                className="w-full px-3 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm bg-white focus:outline-none focus:border-[#C9A227] disabled:bg-[#F0E9DE] disabled:text-[#8A857C]"
              >
                {destinations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {formaterMontant(c.solde, c.currency)}
                  </option>
                ))}
                {destinations.length === 0 && (
                  <option value="">
                    Aucune caisse en {source?.currency || "cette devise"}
                  </option>
                )}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Montant *{source ? ` (${source.currency})` : ""}
              </label>
              <input
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                inputMode="decimal"
                placeholder="Ex. 500,00"
                className="w-full px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm focus:outline-none focus:border-[#C9A227]"
              />
              {fondsInsuffisants && source && (
                <p className="text-[10px] text-[#B3452E] mt-1">
                  Supérieur au solde courant ({formaterMontant(source.solde, source.currency)}) — le serveur refusera.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Date comptable
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm bg-white focus:outline-none focus:border-[#C9A227]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1">
              Libellé *
            </label>
            <input
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex. Dépôt des offrandes du culte"
              maxLength={200}
              className="w-full px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1">
              Référence / note (facultatif)
            </label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex. BORD-2026-018 (bordereau de dépôt)"
              maxLength={80}
              className="w-full px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm focus:outline-none focus:border-[#C9A227]"
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
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm font-medium text-[#000000] hover:bg-[#F0E9DE]"
            >
              Annuler
            </button>
            <button
              onClick={soumettre}
              disabled={envoi || destinations.length === 0}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#000000] text-[#DDBE55] text-sm font-bold hover:bg-[#161513] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
              Effectuer le transfert
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
  // ⭐ V3.72 — transfert entre caisses depuis la situation de caisse.
  const [transfertOuvert, setTransfertOuvert] = useState(false);
  const [caisseSourceTransfert, setCaisseSourceTransfert] = useState<string | null>(null);

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

  // ⭐ V3.72 — POST /tresorerie/api/transactions (type TRANSFERT, API V3.67 :
  // contrôles serveur devise/fonds + journal d'audit, puis rechargement).
  const effectuerTransfert = async (payload: Record<string, unknown>) => {
    const res = await fetch("/tresorerie/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erreur de transfert");
    await charger();
  };

  const ouvrirTransfert = (caisse?: LigneCaisse) => {
    setCaisseSourceTransfert(caisse?.id || null);
    setTransfertOuvert(true);
  };

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8A857C]">
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
          <h1 className="text-2xl md:text-3xl font-bold text-[#000000]">
            Situation de caisse
          </h1>
          <p className="text-sm text-[#8A857C] mt-1">
            Multicaisse — soldes recalculés en direct depuis le journal et les
            soldes d&apos;ouverture : la caisse affichée est TOUJOURS la caisse
            réelle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/tresorerie/transactions"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#8A857C]/25 text-sm font-medium text-[#000000] hover:bg-white transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4 text-[#8A857C]" />
            Journal
          </a>
          <button
            onClick={() => ouvrirTransfert()}
            disabled={!data || data.caisses.filter((c) => c.isActive).length < 2}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C9A227]/40 bg-[#C9A227]/10 text-sm font-bold text-[#000000] hover:bg-[#C9A227]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              data && data.caisses.filter((c) => c.isActive).length < 2
                ? "Créez au moins deux caisses actives pour transférer"
                : "Déplacer de l'argent d'une caisse vers une autre"
            }
          >
            <ArrowLeftRight className="w-4 h-4 text-[#A3821C]" />
            Transfert
          </button>
          <button
            onClick={() => setCreation(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#000000] text-[#DDBE55] text-sm font-bold hover:bg-[#161513] transition-colors"
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
        <div className="bg-white rounded-xl border border-[#8A857C]/15 px-6 py-14 text-center">
          <Wallet className="w-8 h-8 text-[#8A857C]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A857C] max-w-md mx-auto">
            Aucun mouvement au journal et aucune caisse déclarée. Créez vos
            caisses (espèces, banque, mobile money…) avec leurs soldes
            d&apos;ouverture — la situation s&apos;établit ensuite à chaque
            écriture.
          </p>
        </div>
      )}

      {/* Onglets caisses / méthodes */}
      <div className="flex gap-1 bg-[#F0E9DE] border border-[#8A857C]/15 rounded-xl p-1 w-fit">
        <button
          onClick={() => setOnglet("caisses")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            onglet === "caisses"
              ? "bg-[#000000] text-[#DDBE55]"
              : "text-[#8A857C] hover:text-[#000000]"
          }`}
        >
          Par caisse ({nbCaisses})
        </button>
        <button
          onClick={() => setOnglet("methodes")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            onglet === "methodes"
              ? "bg-[#000000] text-[#DDBE55]"
              : "text-[#8A857C] hover:text-[#000000]"
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
                        ? "border-[#8A857C]/15"
                        : "border-[#8A857C]/10 opacity-60"
                    } p-5 relative overflow-hidden`}
                  >
                    {!c.isActive && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#8A857C]/15 text-[#6B6459] text-[10px] font-bold">
                        Désactivée
                      </span>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#000000] flex items-center justify-center flex-shrink-0">
                          <Icone className="w-5 h-5 text-[#DDBE55]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#000000] truncate">
                            {c.name}
                          </p>
                          <p className="text-[11px] text-[#8A857C]">
                            {libelleCaisseType(c.type)} · {c.currency}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {c.isActive && (
                          <button
                            onClick={() => ouvrirTransfert(c)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#A3821C] hover:text-[#000000] hover:bg-[#C9A227]/15"
                            aria-label={`Transférer depuis ${c.name}`}
                            title={`Transférer depuis ${c.name}`}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setCaisseEditee(c)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A857C] hover:text-[#000000] hover:bg-[#F0E9DE]"
                          aria-label={`Modifier ${c.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => basculerActive(c)}
                          disabled={actionEnCours === c.id}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A857C] hover:text-[#B3452E] hover:bg-[#F0E9DE] disabled:opacity-40"
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
                      className={`text-2xl font-bold ${positif ? "text-[#000000]" : "text-[#B3452E]"}`}
                    >
                      {formaterMontant(c.solde, c.currency)}
                    </p>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-[11px] text-[#8A857C]">
                      <span>
                        Ouverture :{" "}
                        <b className="text-[#000000]">
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
                        <span className="text-[#6B675F]">
                          ↗ {formaterMontant(c.transfertsSortants, c.currency)}{" "}
                          transférés
                        </span>
                      )}
                      {c.transfertsEntrants > 0 && (
                        <span className="text-[#6B675F]">
                          ↘ {formaterMontant(c.transfertsEntrants, c.currency)}{" "}
                          reçus
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-[10px] text-[#8A857C]/80 mt-2 truncate">
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
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A857C] font-bold mb-3 px-1">
                Écritures non affectées (antérieures à la multicaisse)
              </h2>
              <div className="bg-white rounded-xl border border-[#8A857C]/15 divide-y divide-[#8A857C]/10">
                {data.nonAffecte.map((n) => (
                  <div key={n.devise} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 rounded-xl bg-[#F0E9DE] flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-5 h-5 text-[#A3821C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#000000]">
                        Non affecté · {n.devise}
                      </p>
                      <p className="text-[11px] text-[#8A857C]">
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
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A857C] font-bold mb-3 px-1">
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
                      className="bg-[#000000] rounded-xl border border-[#C9A227]/20 p-5 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Landmark className="w-4 h-4 text-[#C9A227]" />
                          <span className="text-sm font-bold text-[#F0E9DE]">
                            {deviseInfo?.libelle ?? d.devise}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#F0E9DE]/50">
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
                        <span className="text-[#F0E9DE]/70">
                          Caisses : {formaterMontant(d.soldeCaisses, d.devise)}
                        </span>
                        {d.soldeNonAffecte !== 0 && (
                          <span className="text-[#F0E9DE]/50">
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
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A857C] font-bold mb-3 px-1">
            Détail par méthode d&apos;encaissement
          </h2>
          <div className="bg-white rounded-xl border border-[#8A857C]/15 divide-y divide-[#8A857C]/10">
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
                    <div className="w-10 h-10 rounded-xl bg-[#F0E9DE] flex items-center justify-center flex-shrink-0">
                      <Icone className="w-5 h-5 text-[#A3821C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#000000]">
                        {libelleMethode(m.methode === "non_precise" ? null : m.methode) ===
                        "Non précisé"
                          ? "Méthode non précisée"
                          : libelleMethode(m.methode)}
                      </p>
                      <p className="text-[11px] text-[#8A857C]">
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
                      <p className="text-[10px] text-[#8A857C]/60">{m.devise}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Note traçabilité */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#F0E9DE] border border-[#8A857C]/15">
        <CheckCircle2 className="w-4 h-4 text-[#5B7052] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#8A857C] leading-relaxed">
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
      {transfertOuvert && data && (
        <FormulaireTransfert
          caisses={data.caisses}
          caisseSourceInitialeId={caisseSourceTransfert}
          onFermer={() => setTransfertOuvert(false)}
          onTransfere={effectuerTransfert}
        />
      )}
    </div>
  );
}
