"use client";

/**
 * ⭐ V3.66 — Journal des mouvements (Trésorerie).
 *
 * Registre comptable complet :
 *  · filtres (type, catégorie, devise, période, recherche) + totaux de la
 *    sélection calculés côté serveur (recettes / dépenses filtrées) ;
 *  · saisie d'un mouvement (recette / dépense, catégorie, montant, devise,
 *    méthode, référence, donateur, note) ;
 *  · correction d'une écriture (le type et la devise sont figés — principe
 *    comptable : supprimer et ressaisir si la nature change) ;
 *  · suppression avec trace d'audit (AuditLog côté serveur).
 *
 * Données : /tresorerie/api/transactions (rôles TREASURER / SUPER_ADMIN).
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
}

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
};

export default function TresorerieTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-[#8A8378]">
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
  const [totaux, setTotaux] = useState({ recettes: 0, depenses: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [type, setType] = useState(searchParams.get("type") || "");
  const [categorie, setCategorie] = useState("");
  const [devise, setDevise] = useState(searchParams.get("devise") || "");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState(searchParams.get("q") || "");

  const [editeurOuvert, setEditeurOuvert] = useState(false);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...FORM_VIDE });
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurForm, setErreurForm] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (categorie) params.set("categorie", categorie);
      if (devise) params.set("devise", devise);
      if (du) params.set("du", du);
      if (au) params.set("au", au);
      if (recherche.trim()) params.set("q", recherche.trim());
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
  }, [type, categorie, devise, du, au, recherche]);

  useEffect(() => {
    const t = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [charger, recherche]);

  const ouvrirCreation = () => {
    setEditionId(null);
    setForm({ ...FORM_VIDE, type: type || "RECETTE", currency: devise || "EUR" });
    setErreurForm("");
    setEditeurOuvert(true);
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

  const supprimer = async (t: Transaction) => {
    if (
      !confirm(
        `Supprimer définitivement « ${t.label} » (${formaterMontant(t.amount, t.currency)}) ?\n\nLa trace de suppression sera conservée dans le journal d'audit.`
      )
    )
      return;
    const res = await fetch(`/tresorerie/api/transactions/${t.id}`, {
      method: "DELETE",
    });
    if (res.ok) charger();
  };

  const categoriesCourantes =
    form.type === "RECETTE" ? RECETTE_CATEGORIES : DEPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]">
            Journal des mouvements
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            {total} écriture{total > 1 ? "s" : ""} — recettes et dépenses du
            ministère, tracées ligne par ligne.
          </p>
        </div>
        <button
          onClick={ouvrirCreation}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Saisir un mouvement
        </button>
      </div>

      {/* Totaux de la sélection */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <p className="text-[10px] uppercase font-bold text-[#8A8378] tracking-wider">
            Recettes (filtre)
          </p>
          <p className="text-lg font-bold text-[#3F5039] mt-1">
            {formaterMontant(totaux.recettes, devise || "EUR")}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <p className="text-[10px] uppercase font-bold text-[#8A8378] tracking-wider">
            Dépenses (filtre)
          </p>
          <p className="text-lg font-bold text-[#B3452E] mt-1">
            {formaterMontant(totaux.depenses, devise || "EUR")}
          </p>
        </div>
        <div className="bg-[#2A0E3D] rounded-xl border border-[#C9A227]/20 p-4">
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
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setType("")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                type === ""
                  ? "bg-[#2A0E3D] text-[#FAF6EF]"
                  : "bg-[#FAF6EF] text-[#8A8378] hover:bg-[#C9A227]/10"
              }`}
            >
              Tous
            </button>
            {Object.entries(MOUVEMENT_TYPES).map(([v, t2]) => (
              <button
                key={v}
                onClick={() => setType(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  type === v ? "bg-[#2A0E3D] text-[#FAF6EF]" : "bg-[#FAF6EF] text-[#8A8378] hover:bg-[#C9A227]/10"
                }`}
              >
                {t2.libelle}s
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]/50" />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher (libellé, référence, donateur…)…"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
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
            value={devise}
            onChange={(e) => setDevise(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
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
            onChange={(e) => setDu(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
            aria-label="Date de début"
          />
          <input
            type="date"
            value={au}
            onChange={(e) => setAu(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
            aria-label="Date de fin"
          />
          {(du || au || categorie || type || devise || recherche) && (
            <button
              onClick={() => {
                setType("");
                setCategorie("");
                setDevise("");
                setDu("");
                setAu("");
                setRecherche("");
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
        <div className="flex items-center justify-center py-16 text-[#8A8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#8A8378]/15 px-6 py-14 text-center">
          <BookOpen className="w-8 h-8 text-[#8A8378]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378]">
            Aucune écriture ne correspond aux filtres.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#8A8378]/15 divide-y divide-[#8A8378]/10 overflow-x-auto">
          {/* En-tête tableau (desktop) */}
          <div className="hidden md:grid grid-cols-[110px_1fr_150px_120px_110px_92px] gap-2 px-5 py-3 text-[10px] uppercase font-bold tracking-wider text-[#8A8378]">
            <span>Date</span>
            <span>Libellé</span>
            <span>Catégorie</span>
            <span>Méthode</span>
            <span className="text-right">Montant</span>
            <span className="text-right">Actions</span>
          </div>
          {items.map((t) => {
            const estRecette = t.type === "RECETTE";
            return (
              <div
                key={t.id}
                className="md:grid md:grid-cols-[110px_1fr_150px_120px_110px_92px] flex flex-col md:flex-row gap-1 md:gap-2 px-5 py-3.5 hover:bg-[#FAF6EF]/60 transition-colors items-start md:items-center"
              >
                <span className="text-xs text-[#8A8378] whitespace-nowrap">
                  {new Date(t.date).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1E0F2B] flex items-center gap-1.5">
                    {estRecette ? (
                      <ArrowDownCircle className="w-3.5 h-3.5 text-[#5B7052] flex-shrink-0" />
                    ) : (
                      <ArrowUpCircle className="w-3.5 h-3.5 text-[#B3452E] flex-shrink-0" />
                    )}
                    <span className="truncate">{t.label}</span>
                  </p>
                  <p className="text-[11px] text-[#8A8378] truncate">
                    {t.reference ? `réf. ${t.reference} · ` : ""}
                    {estRecette
                      ? t.isAnonymous
                        ? "don anonyme"
                        : t.donorName || "donateur non précisé"
                      : t.note?.substring(0, 60) || ""}
                  </p>
                </div>
                <span className="text-[11px] text-[#8A8378]">
                  {libelleCategorie(t.category, t.type)}
                </span>
                <span className="text-[11px] text-[#8A8378]">
                  {libelleMethode(t.method)}
                </span>
                <span
                  className={`text-sm font-bold md:text-right ${estRecette ? "text-[#3F5039]" : "text-[#B3452E]"}`}
                >
                  {estRecette ? "+" : "−"}
                  {formaterMontant(t.amount, t.currency)}
                </span>
                <div className="flex gap-1 md:justify-end">
                  <button
                    onClick={() => ouvrirCorrection(t)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:text-[#C9A227] hover:bg-[#C9A227]/10 transition-colors"
                    aria-label="Corriger"
                    title="Corriger l'écriture"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => supprimer(t)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:text-[#B3452E] hover:bg-[#B3452E]/10 transition-colors"
                    aria-label="Supprimer"
                    title="Supprimer l'écriture"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Éditeur de mouvement ── */}
      {editeurOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A0826]/60 overflow-y-auto">
          <form
            onSubmit={enregistrer}
            className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1E0F2B]">
                  {editionId ? "Corriger l'écriture" : "Saisir un mouvement"}
                </h2>
                {editionId && (
                  <p className="text-[11px] text-[#8A8378] mt-0.5">
                    Le type ({form.type}) et la devise ({form.currency}) sont
                    figés — supprimez l&apos;écriture si sa nature doit changer.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditeurOuvert(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:bg-[#FAF6EF]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type (création seulement) */}
            {!editionId && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MOUVEMENT_TYPES).map(([v, t2]) => {
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
                          : "border-[#8A8378]/15 text-[#8A8378] hover:border-[#C9A227]/40"
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
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Montant *
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="Ex. 150,00"
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Devise
                </label>
                <select
                  value={form.currency}
                  disabled={Boolean(editionId)}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm disabled:opacity-60"
                >
                  {DEVISE_CODES.map((d) => (
                    <option key={d} value={d}>
                      {(DEVISES as Record<string, { libelle: string }>)[d]?.libelle ?? d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Catégorie *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                >
                  {Object.entries(categoriesCourantes).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Date comptable
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                Libellé *
              </label>
              <input
                type="text"
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Ex. Offrande du culte du dimanche"
                className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Méthode
                </label>
                <select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
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
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Référence (pièce / reçu)
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="Ex. REC-2026-042"
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                />
              </div>
            </div>

            {form.type === "RECETTE" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                    Donateur (facultatif)
                  </label>
                  <input
                    type="text"
                    value={form.donorName}
                    disabled={form.isAnonymous}
                    onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                    placeholder="Nom du donateur"
                    className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm disabled:opacity-50"
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
                  <span className="text-xs text-[#1E0F2B] font-semibold">
                    Don anonyme
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                Note (facultatif)
              </label>
              <textarea
                rows={3}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Contexte, précisions…"
                className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm resize-none"
              />
            </div>

            {erreurForm && (
              <p className="text-xs text-[#B3452E]">{erreurForm}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditeurOuvert(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#8A8378] hover:text-[#1E0F2B]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enregistrement}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors disabled:opacity-50"
              >
                {enregistrement && <Loader2 className="w-4 h-4 animate-spin" />}
                {editionId ? "Enregistrer la correction" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
