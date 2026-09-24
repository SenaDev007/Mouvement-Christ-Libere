"use client";

/**
 * ⭐ V3.66/V3.67 — Tableau de bord de la Trésorerie.
 *
 * KPIs calculés en direct depuis le journal (solde par devise, mois
 * courant), séries 6 mois + catégories (recharts), dernières écritures.
 * ⭐ V3.67 — panneau MULTICAISSE : solde réel (ouvertures incluses),
 * soldes par caisse de la devise courante, compartiment non affecté.
 * Données : GET /tresorerie/api/stats?devise=EUR|XOF|USD
 * (rôles TREASURER / SUPER_ADMIN).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  BookOpen,
  ArrowUpRight,
  Receipt,
  Coins,
} from "lucide-react";
import {
  formaterMontant,
  libelleCategorie,
  libelleMethode,
  DEVISES,
  DEVISE_CODES,
  MOUVEMENT_TYPES,
} from "@/lib/staff-space/constants";
import {
  DEVISE_PAR_DEFAUT,
  equivalentFormate,
  noteTauxReference,
} from "@/lib/staff-space/devises";
import {
  GrapheMensuel,
  GrapheCategories,
  type SerieMensuelle,
  type DonneeCategorie,
} from "@/components/staff-space/tresorerie-graphes";

interface StatsTresorerie {
  devise: string;
  total: {
    recettes: number;
    depenses: number;
    solde: number;
    nbMouvements: number;
  };
  multicaisse?: {
    nbCaisses: number;
    soldeReel: number;
    soldeNonAffecte: number;
    coherent: boolean;
    caisses: {
      id: string;
      name: string;
      type: string;
      isActive: boolean;
      devise: string;
      solde: number;
      soldeConverti: number;
    }[];
  };
  // ⭐ V3.88 — détail natif par devise (transparence des conversions).
  detailParDevise?: { devise: string; recettes: number; depenses: number }[];
  moisCourant: { recettes: number; depenses: number };
  serie6Mois: SerieMensuelle[];
  categories: DonneeCategorie[];
  dernieres: {
    id: string;
    type: string;
    category: string;
    amount: number;
    currency: string;
    method: string | null;
    label: string;
    date: string;
    reference: string | null;
    donorName?: string | null;
    isAnonymous?: boolean;
  }[];
}

export default function TresorerieDashboardPage() {
  // ⭐ V3.88 — franc CFA par défaut (le ministère opère en XOF).
  const [devise, setDevise] = useState(DEVISE_PAR_DEFAUT);
  const [stats, setStats] = useState<StatsTresorerie | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      setChargement(true);
      try {
        const res = await fetch(`/tresorerie/api/stats?devise=${devise}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de chargement");
        setStats(data);
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setChargement(false);
      }
    })();
  }, [devise]);

  if (chargement && !stats) {
    return (
      <div className="flex items-center justify-center py-24 text-[#BDB4C9]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (erreur && !stats) {
    return (
      <div className="max-w-xl mx-auto mt-12 px-4 py-6 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#E08B6D] text-sm">
        {erreur}
      </div>
    );
  }

  const t = stats?.total;
  const soldePositif = (t?.solde ?? 0) >= 0;

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] bg-grain-dark p-6 md:p-8 text-white shadow-xl border border-[#C9A227]/15">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none animate-pulse-slow" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#DDBE55]/80 font-semibold mb-2">
              Trésorerie du royaume
            </p>
            <h1 className="text-2xl md:text-3xl font-bold font-serif mb-1">
              Tableau de{" "}
              <span className="relative inline-block">
                bord
                <span className="absolute left-0 -bottom-1 h-[3px] w-full bg-gradient-to-r from-[#C9A227] to-transparent" />
              </span>
            </h1>
            <p className="text-sm text-white/70">
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#C9A227]" />
            <select
              value={devise}
              onChange={(e) => setDevise(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#1A0826]/10 backdrop-blur-sm border border-white/10 text-white text-xs font-semibold focus:outline-none [&>option]:text-[#FAF6EF]"
              aria-label="Devise affichée"
            >
              {DEVISE_CODES.map((d) => (
                <option key={d} value={d}>
                  {(DEVISES as Record<string, { libelle: string }>)[d]?.libelle ?? d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-3 px-1">
          Indicateurs clés — {stats?.devise}
        </h2>
        {/* ⭐ V3.88 — conversion automatique : les totaux regroupent toutes
            les devises, converties vers la devise d'affichage (jamais de
            « 0 € » quand le journal est tenu en francs CFA). */}
        {(stats?.detailParDevise?.length ?? 0) > 1 && (
          <p className="text-[11px] text-[#BDB4C9] mb-2 px-1">
            Toutes devises confondues ·{" "}
            {stats!.detailParDevise!.map((d) => d.devise).join(" + ")} —{" "}
            {noteTauxReference(devise)}
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href={`/tresorerie/transactions?type=RECETTE&devise=${devise}`}
            className="group relative bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 hover:border-[#5B7052]/40 hover:shadow-lg transition-all overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5B7052] to-[#3F5039] opacity-80" />
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-[#5B7052]/10">
                <TrendingUp className="w-4 h-4 text-[#FAF6EF]" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#FAF6EF]/25 group-hover:text-[#A3C9B0] transition-colors" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-[#A3C9B0]">
              {formaterMontant(t?.recettes ?? 0, devise)}
            </div>
            <div className="text-[11px] text-[#BDB4C9] font-medium mt-0.5">
              Total recettes
            </div>
          </Link>
          <Link
            href={`/tresorerie/transactions?type=DEPENSE&devise=${devise}`}
            className="group relative bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 hover:border-[#B3452E]/40 hover:shadow-lg transition-all overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B3452E] to-[#8A2F1F] opacity-80" />
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-[#B3452E]/10">
                <TrendingDown className="w-4 h-4 text-[#FAF6EF]" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#FAF6EF]/25 group-hover:text-[#E08B6D] transition-colors" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-[#E08B6D]">
              {formaterMontant(t?.depenses ?? 0, devise)}
            </div>
            <div className="text-[11px] text-[#BDB4C9] font-medium mt-0.5">
              Total dépenses
            </div>
          </Link>
          <Link
            href="/tresorerie/caisse"
            className="group relative bg-[#3D1A54] rounded-xl border border-[#C9A227]/20 p-4 hover:border-[#C9A227]/50 hover:shadow-lg transition-all overflow-hidden col-span-2"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C] opacity-90" />
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-[#C9A227]/15">
                <Wallet className="w-4 h-4 text-[#C9A227]" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#FAF6EF]/40 group-hover:text-[#C9A227] transition-colors" />
            </div>
            <div
              className={`text-xl md:text-2xl font-bold ${soldePositif ? "text-[#DDBE55]" : "text-[#E88A76]"}`}
            >
              {formaterMontant(t?.solde ?? 0, devise)}
            </div>
            <div className="text-[11px] text-[#FAF6EF]/60 font-medium mt-0.5">
              Solde de caisse — {t?.nbMouvements ?? 0} mouvement
              {(t?.nbMouvements ?? 0) > 1 ? "s" : ""} au journal
            </div>
          </Link>
        </div>
      </div>

      {/* ⭐ V3.67 — Panneau multicaisse (V3.88 : toutes devises, équivalents) */}
      {stats?.multicaisse && stats.multicaisse.nbCaisses > 0 && (
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold">
              Caisses ({stats.multicaisse.nbCaisses}) — solde natif · équivalent en {devise}
            </h2>
            <Link
              href="/tresorerie/caisse"
              className="text-xs text-[#C9A227] hover:text-[#DDBE55] font-semibold"
            >
              Situation complète →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.multicaisse.caisses.map((c) => (
              <Link
                key={c.id}
                href={`/tresorerie/transactions?caisse=${c.id}`}
                className={`flex items-center justify-between gap-2 px-4 py-3 rounded-lg border transition-colors hover:bg-[#C9A227]/10 ${
                  c.isActive
                    ? "border-[#C9A227]/15"
                    : "border-[#C9A227]/10 opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-[#FAF6EF] truncate block">
                    {c.name}
                  </span>
                  {c.devise !== devise && c.soldeConverti !== c.solde && (
                    <span className="text-[10px] text-[#BDB4C9]">
                      ≈ {formaterMontant(c.soldeConverti, devise)}
                    </span>
                  )}
                </div>
                <span
                  className={`text-sm font-bold flex-shrink-0 ${
                    c.solde >= 0 ? "text-[#A3C9B0]" : "text-[#E08B6D]"
                  }`}
                >
                  {formaterMontant(c.solde, c.devise)}
                </span>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#C9A227]/10">
            <span className="text-xs text-[#BDB4C9]">
              Solde réel consolidé (ouvertures incluses, converti en {devise})
            </span>
            <span
              className={`text-lg font-bold ${
                stats.multicaisse.soldeReel >= 0 ? "text-[#A3C9B0]" : "text-[#E08B6D]"
              }`}
            >
              {formaterMontant(stats.multicaisse.soldeReel, devise)}
            </span>
          </div>
          {!stats.multicaisse.coherent && (
            <p className="text-[11px] text-[#E08B6D] mt-2">
              Écart de cohérence détecté — vérifier les transferts et ouvertures
              (page Situation de caisse).
            </p>
          )}
        </div>
      )}

      {/* Mois courant */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#5B7052]/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-[#A3C9B0]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#BDB4C9] font-semibold uppercase tracking-wider">
              Recettes de {new Date().toLocaleDateString("fr-FR", { month: "long" })}
            </p>
            <p className="text-lg font-bold text-[#A3C9B0]">
              {formaterMontant(stats?.moisCourant.recettes ?? 0, devise)}
            </p>
          </div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#B3452E]/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-[#E08B6D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#BDB4C9] font-semibold uppercase tracking-wider">
              Dépenses de {new Date().toLocaleDateString("fr-FR", { month: "long" })}
            </p>
            <p className="text-lg font-bold text-[#E08B6D]">
              {formaterMontant(stats?.moisCourant.depenses ?? 0, devise)}
            </p>
          </div>
        </div>
      </div>

      {/* Graphe 6 mois */}
      <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-4">
          Évolution des 6 derniers mois — {devise}
        </h2>
        <GrapheMensuel serie={stats?.serie6Mois ?? []} devise={devise} />
      </div>

      {/* Catégories */}
      <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-4">
          Répartition par catégorie — {devise}
        </h2>
        <GrapheCategories categories={stats?.categories ?? []} devise={devise} />
      </div>

      {/* Dernières écritures */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold px-1">
            Dernières écritures
          </h2>
          <Link
            href="/tresorerie/transactions"
            className="text-xs text-[#C9A227] hover:text-[#DDBE55] font-semibold"
          >
            Journal complet →
          </Link>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 divide-y divide-[#C9A227]/10">
          {stats?.dernieres.length === 0 && (
            <p className="px-5 py-8 text-sm text-[#BDB4C9] text-center">
              Aucun mouvement au journal —{" "}
              <Link href="/tresorerie/transactions" className="text-[#C9A227] underline">
                saisir la première écriture
              </Link>
              .
            </p>
          )}
          {stats?.dernieres.map((mouvement) => {
            const estRecette = mouvement.type === "RECETTE";
            const estTransfert = mouvement.type === "TRANSFERT";
            return (
              <Link
                key={mouvement.id}
                href={`/tresorerie/transactions?q=${encodeURIComponent(mouvement.label)}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#C9A227]/10 transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    estTransfert
                      ? "bg-[#8C5FA8]"
                      : estRecette
                        ? "bg-[#5B7052]"
                        : "bg-[#B3452E]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#FAF6EF] truncate">
                    {mouvement.label}
                  </p>
                  <p className="text-[11px] text-[#BDB4C9] truncate">
                    {libelleCategorie(mouvement.category, mouvement.type)} ·{" "}
                    {libelleMethode(mouvement.method)}
                    {mouvement.reference ? ` · réf. ${mouvement.reference}` : ""}
                    {mouvement.type === "RECETTE" && mouvement.donorName
                      ? ` · ${mouvement.donorName}`
                      : ""}
                    {mouvement.type === "RECETTE" &&
                    !mouvement.donorName &&
                    !mouvement.isAnonymous
                      ? " · donateur non précisé"
                      : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-sm font-bold ${
                      estTransfert
                        ? "text-[#C9AEE3]"
                        : estRecette
                          ? "text-[#A3C9B0]"
                          : "text-[#E08B6D]"
                    }`}
                  >
                    {estRecette ? "+" : "−"}
                    {formaterMontant(mouvement.amount, mouvement.currency)}
                  </p>
                  {/* ⭐ V3.88 — équivalent converti sous le montant natif. */}
                  {equivalentFormate(
                    mouvement.amount,
                    mouvement.currency,
                    devise
                  ) && (
                    <p className="text-[10px] text-[#FAF6EF]/50">
                      {equivalentFormate(mouvement.amount, mouvement.currency, devise)}
                    </p>
                  )}
                  <p className="text-[10px] text-[#FAF6EF]/50">
                    {new Date(mouvement.date).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Accès rapides */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Link
          href="/tresorerie/transactions"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-[#3D1A54] text-[#FAF6EF] hover:bg-[#3D1A54] transition-colors"
        >
          <BookOpen className="w-5 h-5 text-[#C9A227]" />
          <span className="text-xs font-semibold">Journal</span>
        </Link>
        <Link
          href="/tresorerie/caisse"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-[#3D1A54] text-[#FAF6EF] hover:bg-[#3D1A54] transition-colors"
        >
          <Wallet className="w-5 h-5 text-[#C9A227]" />
          <span className="text-xs font-semibold">Caisse</span>
        </Link>
        <Link
          href="/tresorerie/rapports"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-[#3D1A54] text-[#FAF6EF] hover:bg-[#3D1A54] transition-colors"
        >
          <BookOpen className="w-5 h-5 text-[#C9A227]" />
          <span className="text-xs font-semibold">Rapports</span>
        </Link>
      </div>
    </div>
  );
}
