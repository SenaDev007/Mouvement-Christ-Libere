"use client";

/**
 * ⭐ V3.66/V3.67 — Journal des mouvements (Trésorerie).
 *
 * Registre comptable complet :
 *  · filtres (type, catégorie, devise, CAISSE, période, recherche) + totaux
 *    de la sélection calculés côté serveur ;
 *  · saisie d'un mouvement (recette / dépense, catégorie, montant, devise,
 *    méthode, référence, donateur, note, CAISSE de rattachement) ;
 *  · ⭐ V3.67 — TRANSFERT INTERNE entre caisses (source → destination, même
 *    devise, fonds suffisants vérifiés) ;
 *  · correction d'une écriture (type et devise figés — principe comptable :
 *    supprimer et ressaisir si la nature change ; la caisse peut être
 *    rattachée/recorrigée) ;
 *  · suppression avec MOTIF obligatoire (gouvernance V3.67 — trace complète
 *    dans le journal d'audit) ;
 *  · ⭐ V3.67 — pagination, export CSV (filtres actifs) et REÇU DE DON PDF
 *    sur chaque recette.
 *
 * Données : /tresorerie/api/transactions · /tresorerie/api/caisses.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Download,
  FileText,
} from "lucide-react";
import {
  formaterMontant,
  libelleCategorie,
  libelleMethode,
  MOUVEMENT_TYPES,
  RECETTE_CATEGORIES,
  DEPENSE_CATEGORIES,
  MOUVEMENT_METHODS,
  DEVISE_CODES,
  DEVISES,
} from "@/lib/staff-space/constants";
import { Pagination } from "@/components/staff-space/pagination";

interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  currency: string;
  method: string | null;
  label: string;
  date: string;
  reference: string | null;
  donorName: string | null;
  isAnonymous: boolean;
  note: string | null;
  caisseId?: string | null;
  caisseDestinationId?: string | null;
  caisseNom?: string | null;
  caisseDestinationNom?: string | null;
}

interface CaisseLegere {
  id: string;
  name: string;
  type: string;
  currency: string;
  isActive: boolean;
  solde: number;
}

const PAR_PAGE = 50;

const FORM_VIDE = {
  type: "RECETTE",
  category: "don",
  amount: "",
  currency: "EUR",
  method: "",
  label: "",
  date: new Date().toISOString().slice(0, 10),
  reference: "",
  donorName: "",
  isAnonymous: false,
  note: "",
  caisseId: "",
};

const FORM_TRANSFERT_VIDE = {
  caisseId: "",
  caisseDestinationId: "",
  amount: "",
  label: "",
  date: new Date().toISOString().slice(0, 10),
  reference: "",
  note: "",
};

export default function TresorerieTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-[#8A857C]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <TransactionsContenu />
    </Suspense>
  );
}

function TransactionsContenu() {
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totaux, setTotaux] = useState({ recettes: 0, depenses: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [caisses, setCaisses] = useState<CaisseLegere[]>([]);

  const [type, setType] = useState(searchParams.get("type") || "");
  const [categorie, setCategorie] = useState("");
  const [devise, setDevise] = useState(searchParams.get("devise") || "");
  const [caisseFiltre, setCaisseFiltre] = useState(
    searchParams.get("caisse") || ""
  );
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState(searchParams.get("q") || "");

  const [editeurOuvert, setEditeurOuvert] = useState(false);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...FORM_VIDE });
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurForm, setErreurForm] = useState("");

  const [transfertOuvert, setTransfertOuvert] = useState(false);
  const [formTransfert, setFormTransfert] = useState({ ...FORM_TRANSFERT_VIDE });
  const [erreurTransfert, setErreurTransfert] = useState("");

  const [suppression, setSuppression] = useState<Transaction | null>(null);
  const [motifSuppression, setMotifSuppression] = useState("");
  const [erreurSuppression, setErreurSuppression] = useState("");

  // Chargement des caisses (sélecteurs du formulaire + filtre).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/tresorerie/api/caisses", { cache: "no-store" });
        const json = await res.json();
        if (res.ok) {
          setCaisses(
            (json.caisses || []).map((c: CaisseLegere & { currency: string }) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              currency: c.currency,
              isActive: c.isActive,
              solde: c.solde,
            }))
          );
        }
      } catch {
        // silencieux : sélecteurs vides → « non affecté ».
      }
    })();
  }, [chargement]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (categorie) params.set("categorie", categorie);
      if (devise) params.set("devise", devise);
      if (caisseFiltre) params.set("caisse", caisseFiltre);
      if (du) params.set("du", du);
      if (au) params.set("au", au);
      if (recherche.trim()) params.set("q", recherche.trim());
      params.set("limit", String(PAR_PAGE));
      params.set("offset", String((page - 1) * PAR_PAGE));
      const res = await fetch(`/tresorerie/api/transactions?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotaux(data.totaux || { recettes: 0, depenses: 0 });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, [type, categorie, devise, caisseFiltre, du, au, recherche, page]);

  useEffect(() => {
    const t = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [charger, recherche]);

  const ouvrirCreation = () => {
    setEditionId(null);
    const caissesDevise = caisses.filter(
      (c) => c.isActive && c.currency === (devise || "EUR")
    );
    setForm({
      ...FORM_VIDE,
      type: type === "DEPENSE" ? "DEPENSE" : "RECETTE",
      category:
        type === "DEPENSE"
          ? Object.keys(DEPENSE_CATEGORIES)[0]
          : Object.keys(RECETTE_CATEGORIES)[0],
      currency: devise || "EUR",
      caisseId: caissesDevise[0]?.id || "",
    });
    setErreurForm("");
    setEditeurOuvert(true);
  };

  const ouvrirTransfert = () => {
    const actives = caisses.filter((c) => c.isActive);
    setFormTransfert({
      ...FORM_TRANSFERT_VIDE,
      caisseId: actives[0]?.id || "",
      caisseDestinationId: actives[1]?.id || "",
    });
    setErreurTransfert("");
    setTransfertOuvert(true);
  };

  const ouvrirCorrection = (t: Transaction) => {
    setEditionId(t.id);
    setForm({
      type: t.type,
      category: t.category,
      amount: String(t.amount),
      currency: t.currency,
      method: t.method || "",
      label: t.label,
      date: new Date(t.date).toISOString().slice(0, 10),
      reference: t.reference || "",
      donorName: t.donorName || "",
      isAnonymous: t.isAnonymous,
      note: t.note || "",
      caisseId: t.caisseId || "",
    });
    setErreurForm("");
    setEditeurOuvert(true);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseFloat(form.amount.replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      setErreurForm("Le montant doit être un nombre strictement positif.");
      return;
    }
    setEnregistrement(true);
    setErreurForm("");
    try {
      const res = await fetch(
        editionId
          ? `/tresorerie/api/transactions/${editionId}`
          : "/tresorerie/api/transactions",
        {
          method: editionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            amount: montant,
            method: form.method || undefined,
            caisseId: form.caisseId || (editionId ? null : undefined),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setEditeurOuvert(false);
      charger();
    } catch (err) {
      setErreurForm(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setEnregistrement(false);
    }
  };

  const enregistrerTransfert = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseFloat(formTransfert.amount.replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      setErreurTransfert("Le montant doit être un nombre strictement positif.");
      return;
    }
    setEnregistrement(true);
    setErreurTransfert("");
    try {
      const res = await fetch("/tresorerie/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TRANSFERT",
          caisseId: formTransfert.caisseId,
          caisseDestinationId: formTransfert.caisseDestinationId,
          amount: montant,
          label: formTransfert.label,
          date: formTransfert.date,
          reference: formTransfert.reference || undefined,
          note: formTransfert.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setTransfertOuvert(false);
      charger();
    } catch (err) {
      setErreurTransfert(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setEnregistrement(false);
    }
  };

  const confirmerSuppression = async () => {
    if (!suppression) return;
    if (motifSuppression.trim().length < 3) {
      setErreurSuppression("Un motif d'au moins 3 caractères est obligatoire.");
      return;
    }
    try {
      const res = await fetch(
        `/tresorerie/api/transactions/${suppression.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motif: motifSuppression.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setSuppression(null);
      setMotifSuppression("");
      setErreurSuppression("");
      charger();
    } catch (err) {
      setErreurSuppression(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const exporterCsv = () => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (categorie) params.set("categorie", categorie);
    if (devise) params.set("devise", devise);
    if (caisseFiltre) params.set("caisse", caisseFiltre);
    if (du) params.set("du", du);
    if (au) params.set("au", au);
    if (recherche.trim()) params.set("q", recherche.trim());
    params.set("format", "csv");
    window.location.href = `/tresorerie/api/transactions?${params}`;
  };

  /** Reçu de don PDF : POST → blob → nouvel onglet (imprimable). */
  const ouvrirRecu = async (t: Transaction) => {
    try {
      const res = await fetch(`/tresorerie/api/rapports/recu/${t.id}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur de génération du reçu");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const categoriesCourantes =
    form.type === "RECETTE" ? RECETTE_CATEGORIES : DEPENSE_CATEGORIES;

  const caissesDuFormulaire = caisses.filter(
    (c) => c.isActive && c.currency === form.currency
  );

  const caissesActives = caisses.filter((c) => c.isActive);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#000000]">
            Journal des mouvements
          </h1>
          <p className="text-sm text-[#8A857C] mt-1">
            {total} écriture{total > 1 ? "s" : ""} — recettes, dépenses et
            transferts internes, tracés ligne par ligne.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exporterCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#8A857C]/25 text-sm font-medium text-[#000000] hover:bg-white transition-colors"
            title="Exporter la sélection en CSV (Excel)"
          >
            <Download className="w-4 h-4 text-[#C9A227]" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={ouvrirTransfert}
            disabled={caissesActives.length < 2}
            title={
              caissesActives.length < 2
                ? "Créez au moins deux caisses actives pour transférer"
                : "Transférer des fonds entre deux caisses"
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#8A857C]/30 text-sm font-medium text-[#6B675F] hover:bg-[#8A857C]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="hidden sm:inline">Transfert</span>
          </button>
          <button
            onClick={ouvrirCreation}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#000000] text-[#F0E9DE] text-sm font-semibold hover:bg-[#161513] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Saisir
          </button>
        </div>
      </div>

      {/* Totaux de la sélection */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#8A857C]/15 p-4">
          <p className="text-[10px] uppercase font-bold text-[#8A857C] tracking-wider">
            Recettes (filtre)
          </p>
          <p className="text-lg font-bold text-[#3F5039] mt-1">
            {formaterMontant(totaux.recettes, devise || "EUR")}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#8A857C]/15 p-4">
          <p className="text-[10px] uppercase font-bold text-[#8A857C] tracking-wider">
            Dépenses (filtre)
          </p>
          <p className="text-lg font-bold text-[#B3452E] mt-1">
            {formaterMontant(totaux.depenses, devise || "EUR")}
          </p>
        </div>
        <div className="bg-[#000000] rounded-xl border border-[#C9A227]/20 p-4">
          <p className="text-[10px] uppercase font-bold text-[#DDBE55] tracking-wider">
            Solde (filtre)
          </p>
          <p
            className={`text-lg font-bold mt-1 ${
              totaux.recettes - totaux.depenses >= 0 ? "text-[#DDBE55]" : "text-[#E88A76]"
            }`}
          >
            {formaterMontant(totaux.recettes - totaux.depenses, devise || "EUR")}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-[#8A857C]/15 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPage(1);
                setType("");
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                type === ""
                  ? "bg-[#000000] text-[#F0E9DE]"
                  : "bg-[#F0E9DE] text-[#8A857C] hover:bg-[#FF7A1A]/10"
              }`}
            >
              Tous
            </button>
            {Object.entries(MOUVEMENT_TYPES).map(([v, t2]) => (
              <button
                key={v}
                onClick={() => {
                  setPage(1);
                  setType(v);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  type === v ? "bg-[#000000] text-[#F0E9DE]" : "bg-[#F0E9DE] text-[#8A857C] hover:bg-[#FF7A1A]/10"
                }`}
              >
                {t2.libelle}s
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A857C]/50" />
            <input
              type="search"
              value={recherche}
              onChange={(e) => {
                setPage(1);
                setRecherche(e.target.value);
              }}
              placeholder="Rechercher (libellé, référence, donateur…)…"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categorie}
            onChange={(e) => {
              setPage(1);
              setCategorie(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
            aria-label="Filtrer par catégorie"
          >
            <option value="">Toutes catégories</option>
            {Object.entries(RECETTE_CATEGORIES).map(([v, l]) => (
              <option key={`r-${v}`} value={v}>
                Recette · {l}
              </option>
            ))}
            {Object.entries(DEPENSE_CATEGORIES).map(([v, l]) => (
              <option key={`d-${v}`} value={v}>
                Dépense · {l}
              </option>
            ))}
          </select>
          <select
            value={caisseFiltre}
            onChange={(e) => {
              setPage(1);
              setCaisseFiltre(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
            aria-label="Filtrer par caisse"
          >
            <option value="">Toutes caisses</option>
            {caisses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={devise}
            onChange={(e) => {
              setPage(1);
              setDevise(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
            aria-label="Filtrer par devise"
          >
            <option value="">Toutes devises</option>
            {DEVISE_CODES.map((d) => (
              <option key={d} value={d}>
                {(DEVISES as Record<string, { libelle: string }>)[d]?.libelle ?? d}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={du}
            onChange={(e) => {
              setPage(1);
              setDu(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
            aria-label="Date de début"
          />
          <input
            type="date"
            value={au}
            onChange={(e) => {
              setPage(1);
              setAu(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
            aria-label="Date de fin"
          />
          {(du || au || categorie || type || devise || caisseFiltre || recherche) && (
            <button
              onClick={() => {
                setType("");
                setCategorie("");
                setDevise("");
                setCaisseFiltre("");
                setDu("");
                setAu("");
                setRecherche("");
                setPage(1);
              }}
              className="text-xs text-[#C9A227] hover:text-[#A3821C] font-semibold px-2"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#B3452E] text-xs border border-[#B3452E]/30">
          <AlertCircle className="w-4 h-4" />
          {erreur}
        </div>
      )}

      {/* Liste */}
      {chargement ? (
        <div className="flex items-center justify-center py-16 text-[#8A857C]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#8A857C]/15 px-6 py-14 text-center">
          <BookOpen className="w-8 h-8 text-[#8A857C]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A857C]">
            Aucune écriture ne correspond aux filtres.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#8A857C]/15 divide-y divide-[#8A857C]/10 overflow-x-auto">
          {/* En-tête tableau (desktop) */}
          <div className="hidden md:grid grid-cols-[110px_1fr_150px_120px_110px_118px] gap-2 px-5 py-3 text-[10px] uppercase font-bold tracking-wider text-[#8A857C]">
            <span>Date</span>
            <span>Libellé</span>
            <span>Catégorie</span>
            <span>Caisse</span>
            <span className="text-right">Montant</span>
            <span className="text-right">Actions</span>
          </div>
          {items.map((t) => {
            const estRecette = t.type === "RECETTE";
            const estTransfert = t.type === "TRANSFERT";
            return (
              <div
                key={t.id}
                className="md:grid md:grid-cols-[110px_1fr_150px_120px_110px_118px] flex flex-col md:flex-row gap-1 md:gap-2 px-5 py-3.5 hover:bg-[#F0E9DE]/60 transition-colors items-start md:items-center"
              >
                <span className="text-xs text-[#8A857C] whitespace-nowrap">
                  {new Date(t.date).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#000000] flex items-center gap-1.5">
                    {estTransfert ? (
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#8A857C] flex-shrink-0" />
                    ) : estRecette ? (
                      <ArrowDownCircle className="w-3.5 h-3.5 text-[#5B7052] flex-shrink-0" />
                    ) : (
                      <ArrowUpCircle className="w-3.5 h-3.5 text-[#B3452E] flex-shrink-0" />
                    )}
                    <span className="truncate">{t.label}</span>
                  </p>
                  <p className="text-[11px] text-[#8A857C] truncate">
                    {estTransfert ? (
                      <>
                        {t.caisseNom || "?"} → {t.caisseDestinationNom || "?"}
                        {t.reference ? ` · réf. ${t.reference}` : ""}
                      </>
                    ) : (
                      <>
                        {t.reference ? `réf. ${t.reference} · ` : ""}
                        {estRecette
                          ? t.isAnonymous
                            ? "don anonyme"
                            : t.donorName || "donateur non précisé"
                          : t.note?.substring(0, 60) || ""}
                      </>
                    )}
                  </p>
                </div>
                <span className="text-[11px] text-[#8A857C]">
                  {libelleCategorie(t.category, t.type)}
                </span>
                <span className="text-[11px] text-[#8A857C] truncate">
                  {estTransfert
                    ? `${t.caisseNom || "?"} → ${t.caisseDestinationNom || "?"}`
                    : t.caisseNom || (
                        <span className="italic text-[#8A857C]/60">non affecté</span>
                      )}
                </span>
                <span
                  className={`text-sm font-bold md:text-right ${
                    estTransfert
                      ? "text-[#6B675F]"
                      : estRecette
                        ? "text-[#3F5039]"
                        : "text-[#B3452E]"
                  }`}
                >
                  {estRecette ? "+" : "−"}
                  {formaterMontant(t.amount, t.currency)}
                </span>
                <div className="flex gap-1 md:justify-end">
                  {estRecette && (
                    <button
                      onClick={() => ouvrirRecu(t)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A857C] hover:text-[#8A857C] hover:bg-[#8A857C]/10 transition-colors"
                      aria-label="Reçu PDF"
                      title="Reçu de don PDF"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!estTransfert && (
                    <button
                      onClick={() => ouvrirCorrection(t)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A857C] hover:text-[#FF7A1A] hover:bg-[#FF7A1A]/10 transition-colors"
                      aria-label="Corriger"
                      title="Corriger l'écriture"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSuppression(t);
                      setMotifSuppression("");
                      setErreurSuppression("");
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A857C] hover:text-[#B3452E] hover:bg-[#B3452E]/10 transition-colors"
                    aria-label="Supprimer"
                    title="Supprimer l'écriture (motif obligatoire)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="border-t border-[#8A857C]/10 px-4 pb-3">
            <Pagination
              total={total}
              page={page}
              parPage={PAR_PAGE}
              onChange={setPage}
            />
          </div>
        </div>
      )}

      {/* ── Éditeur de mouvement ── */}
      {editeurOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/60 overflow-y-auto">
          <form
            onSubmit={enregistrer}
            className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#000000]">
                  {editionId ? "Corriger l'écriture" : "Saisir un mouvement"}
                </h2>
                {editionId && (
                  <p className="text-[11px] text-[#8A857C] mt-0.5">
                    Le type ({form.type}) et la devise ({form.currency}) sont
                    figés — supprimez l&apos;écriture si sa nature doit changer.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditeurOuvert(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A857C] hover:bg-[#F0E9DE]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type (création seulement) */}
            {!editionId && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MOUVEMENT_TYPES)
                  .filter(([v]) => v !== "TRANSFERT")
                  .map(([v, t2]) => {
                    const actif = form.type === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            type: v,
                            category:
                              v === "RECETTE"
                                ? Object.keys(RECETTE_CATEGORIES)[0]
                                : Object.keys(DEPENSE_CATEGORIES)[0],
                          })
                        }
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                          actif
                            ? v === "RECETTE"
                              ? "border-[#5B7052] bg-[#5B7052]/5 text-[#3F5039]"
                              : "border-[#B3452E] bg-[#B3452E]/5 text-[#B3452E]"
                            : "border-[#8A857C]/15 text-[#8A857C] hover:border-[#FF7A1A]/40"
                        }`}
                      >
                        {v === "RECETTE" ? (
                          <ArrowDownCircle className="w-4 h-4" />
                        ) : (
                          <ArrowUpCircle className="w-4 h-4" />
                        )}
                        {t2.libelle}
                      </button>
                    );
                  })}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Montant *
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="Ex. 150,00"
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Devise
                </label>
                <select
                  value={form.currency}
                  disabled={Boolean(editionId)}
                  onChange={(e) => setForm({ ...form, currency: e.target.value, caisseId: "" })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm disabled:opacity-60"
                >
                  {DEVISE_CODES.map((d) => (
                    <option key={d} value={d}>
                      {(DEVISES as Record<string, { libelle: string }>)[d]?.libelle ?? d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Catégorie *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                >
                  {Object.entries(categoriesCourantes).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Date comptable
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                />
              </div>
            </div>

            {/* ⭐ V3.67 — Caisse de rattachement */}
            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Caisse (multicaisse)
              </label>
              <select
                value={form.caisseId}
                onChange={(e) => setForm({ ...form, caisseId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
              >
                <option value="">
                  {caissesDuFormulaire.length > 0
                    ? "— Non affecté (hors multicaisse) —"
                    : "Aucune caisse dans cette devise — créez une caisse (page Situation de caisse)"}
                </option>
                {caissesDuFormulaire.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {caissesDuFormulaire.length > 0 && !form.caisseId && (
                <p className="text-[10px] text-[#A3821C] mt-1">
                  Recommandé : rattacher chaque écriture à une caisse pour une
                  situation multicaisse exacte.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Libellé *
              </label>
              <input
                type="text"
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Ex. Offrande du culte du dimanche"
                className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Méthode
                </label>
                <select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                >
                  <option value="">Non précisée</option>
                  {Object.entries(MOUVEMENT_METHODS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Référence (pièce / reçu)
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="Ex. REC-2026-042"
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                />
              </div>
            </div>

            {form.type === "RECETTE" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-[#000000] mb-1">
                    Donateur (facultatif)
                  </label>
                  <input
                    type="text"
                    value={form.donorName}
                    disabled={form.isAnonymous}
                    onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                    placeholder="Nom du donateur"
                    className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm disabled:opacity-50"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isAnonymous}
                    onChange={(e) =>
                      setForm({ ...form, isAnonymous: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#C9A227]"
                  />
                  <span className="text-xs text-[#000000] font-semibold">
                    Don anonyme
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Note (facultatif)
              </label>
              <textarea
                rows={3}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Contexte, précisions…"
                className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm resize-none"
              />
            </div>

            {erreurForm && (
              <p className="text-xs text-[#B3452E]">{erreurForm}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditeurOuvert(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#8A857C] hover:text-[#000000]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enregistrement}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#000000] text-[#F0E9DE] text-sm font-semibold hover:bg-[#161513] transition-colors disabled:opacity-50"
              >
                {enregistrement && <Loader2 className="w-4 h-4 animate-spin" />}
                {editionId ? "Enregistrer la correction" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Transfert entre caisses (V3.67) ── */}
      {transfertOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/60 overflow-y-auto">
          <form
            onSubmit={enregistrerTransfert}
            className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#000000] flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-[#8A857C]" />
                  Transfert entre caisses
                </h2>
                <p className="text-[11px] text-[#8A857C] mt-0.5">
                  Mouvement interne : l&apos;argent sort d&apos;une caisse et
                  entre dans l&apos;autre — le total consolidé ne change pas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransfertOuvert(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A857C] hover:bg-[#F0E9DE]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Caisse source *
                </label>
                <select
                  value={formTransfert.caisseId}
                  onChange={(e) =>
                    setFormTransfert({ ...formTransfert, caisseId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                >
                  {caissesActives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {formaterMontant(c.solde, c.currency)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Caisse destination *
                </label>
                <select
                  value={formTransfert.caisseDestinationId}
                  onChange={(e) =>
                    setFormTransfert({
                      ...formTransfert,
                      caisseDestinationId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                >
                  {caissesActives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {formaterMontant(c.solde, c.currency)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Montant *
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={formTransfert.amount}
                  onChange={(e) =>
                    setFormTransfert({ ...formTransfert, amount: e.target.value })
                  }
                  placeholder="Ex. 500,00"
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#000000] mb-1">
                  Date comptable
                </label>
                <input
                  type="date"
                  value={formTransfert.date}
                  onChange={(e) =>
                    setFormTransfert({ ...formTransfert, date: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Libellé *
              </label>
              <input
                type="text"
                required
                value={formTransfert.label}
                onChange={(e) =>
                  setFormTransfert({ ...formTransfert, label: e.target.value })
                }
                placeholder="Ex. Dépôt des offrandes en banque"
                className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Référence / note (facultatif)
              </label>
              <input
                type="text"
                value={formTransfert.reference}
                onChange={(e) =>
                  setFormTransfert({ ...formTransfert, reference: e.target.value })
                }
                placeholder="Ex. BORD-2026-018 (bordereau de dépôt)"
                className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
              />
            </div>

            {formTransfert.caisseId &&
              formTransfert.caisseDestinationId &&
              formTransfert.caisseId === formTransfert.caisseDestinationId && (
                <p className="text-xs text-[#B3452E]">
                  La source et la destination doivent être des caisses différentes.
                </p>
              )}

            {erreurTransfert && (
              <p className="text-xs text-[#B3452E]">{erreurTransfert}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransfertOuvert(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#8A857C] hover:text-[#000000]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enregistrement}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#000000] text-[#F0E9DE] text-sm font-semibold hover:bg-[#161513] transition-colors disabled:opacity-50"
              >
                {enregistrement && <Loader2 className="w-4 h-4 animate-spin" />}
                Effectuer le transfert
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Suppression avec motif (gouvernance V3.67) ── */}
      {suppression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/60">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#B3452E] flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Supprimer l&apos;écriture
            </h2>
            <p className="text-sm text-[#000000]">
              « {suppression.label} » ·{" "}
              <b>{formaterMontant(suppression.amount, suppression.currency)}</b>
            </p>
            <p className="text-xs text-[#8A857C] leading-relaxed">
              Gouvernance : l&apos;écriture disparaît du journal, mais son
              contenu complet, votre nom et le motif ci-dessous restent
              consignés dans le journal d&apos;audit.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#000000] mb-1">
                Motif de suppression * (au moins 3 caractères)
              </label>
              <input
                type="text"
                value={motifSuppression}
                onChange={(e) => setMotifSuppression(e.target.value)}
                placeholder="Ex. Doublon de saisie, erreur de montant…"
                className="w-full px-3 py-2 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm"
                autoFocus
              />
            </div>
            {erreurSuppression && (
              <p className="text-xs text-[#B3452E]">{erreurSuppression}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSuppression(null)}
                className="px-4 py-2 rounded-lg text-sm text-[#8A857C] hover:text-[#000000]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmerSuppression}
                className="px-5 py-2 rounded-lg bg-[#B3452E] text-white text-sm font-semibold hover:bg-[#9A3B26] transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
