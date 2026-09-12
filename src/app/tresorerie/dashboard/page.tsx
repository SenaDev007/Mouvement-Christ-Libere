"use client";

/**
 * ⭐ V3.66 — Tableau de bord de la Trésorerie.
 *
 * KPIs calculés en direct depuis le journal (solde par devise, mois
 * courant), séries 6 mois + catégories (recharts), dernières écritures.
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
  }[];
}

export default function TresorerieDashboardPage() {
  const [devise, setDevise] = useState("EUR");
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
      <div className="flex items-center justify-center py-24 text-[#8A8378]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (erreur && !stats) {
    return (
      <div className="max-w-xl mx-auto mt-12 px-4 py-6 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#B3452E] text-sm">
        {erreur}
      </div>
    );
  }

  const t = stats?.total;
  const soldePositif = (t?.solde ?? 0) >= 0;

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#DDBE55]/80 font-semibold mb-2">
              Trésorerie du royaume
            </p>
            <h1
              className="text-2xl md:text-3xl font-bold mb-1"
              style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
            >
              Tableau de bord
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
              className="px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-white text-xs font-semibold focus:outline-none [&>option]:text-[#1E0F2B]"
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
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-3 px-1">
          Indicateurs clés — {stats?.devise}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href={`/tresorerie/transactions?type=RECETTE&devise=${devise}`}
            className="group relative bg-white rounded-xl border border-[#8A8378]/15 p-4 hover:border-[#5B7052]/40 hover:shadow-lg transition-all overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5B7052] to-[#3F5039] opacity-80" />
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-[#5B7052]/10">
                <TrendingUp className="w-4 h-4 text-[#1E0F2B]" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#8A8378]/40 group-hover:text-[#5B7052] transition-colors" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-[#3F5039]">
              {formaterMontant(t?.recettes ?? 0, devise)}
            </div>
            <div className="text-[11px] text-[#8A8378] font-medium mt-0.5">
              Total recettes
            </div>
          </Link>
          <Link
            href={`/tresorerie/transactions?type=DEPENSE&devise=${devise}`}
            className="group relative bg-white rounded-xl border border-[#8A8378]/15 p-4 hover:border-[#B3452E]/40 hover:shadow-lg transition-all overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B3452E] to-[#8A2F1F] opacity-80" />
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-[#B3452E]/10">
                <TrendingDown className="w-4 h-4 text-[#1E0F2B]" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#8A8378]/40 group-hover:text-[#B3452E] transition-colors" />
            </div>
            <div className="text-xl md:text-2xl font-bold text-[#B3452E]">
              {formaterMontant(t?.depenses ?? 0, devise)}
            </div>
            <div className="text-[11px] text-[#8A8378] font-medium mt-0.5">
              Total dépenses
            </div>
          </Link>
          <Link
            href="/tresorerie/caisse"
            className="group relative bg-[#2A0E3D] rounded-xl border border-[#C9A227]/20 p-4 hover:border-[#C9A227]/50 hover:shadow-lg transition-all overflow-hidden col-span-2"
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

      {/* Mois courant */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#5B7052]/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-[#3F5039]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#8A8378] font-semibold uppercase tracking-wider">
              Recettes de {new Date().toLocaleDateString("fr-FR", { month: "long" })}
            </p>
            <p className="text-lg font-bold text-[#3F5039]">
              {formaterMontant(stats?.moisCourant.recettes ?? 0, devise)}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#B3452E]/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-[#B3452E]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#8A8378] font-semibold uppercase tracking-wider">
              Dépenses de {new Date().toLocaleDateString("fr-FR", { month: "long" })}
            </p>
            <p className="text-lg font-bold text-[#B3452E]">
              {formaterMontant(stats?.moisCourant.depenses ?? 0, devise)}
            </p>
          </div>
        </div>
      </div>

      {/* Graphe 6 mois */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-4">
          Évolution des 6 derniers mois — {devise}
        </h2>
        <GrapheMensuel serie={stats?.serie6Mois ?? []} devise={devise} />
      </div>

      {/* Catégories */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-4">
          Répartition par catégorie — {devise}
        </h2>
        <GrapheCategories categories={stats?.categories ?? []} devise={devise} />
      </div>

      {/* Dernières écritures */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold px-1">
            Dernières écritures
          </h2>
          <Link
            href="/tresorerie/transactions"
            className="text-xs text-[#C9A227] hover:text-[#A3821C] font-semibold"
          >
            Journal complet →
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-[#8A8378]/15 divide-y divide-[#8A8378]/10">
          {stats?.dernieres.length === 0 && (
            <p className="px-5 py-8 text-sm text-[#8A8378] text-center">
              Aucun mouvement au journal —{" "}
              <Link href="/tresorerie/transactions" className="text-[#C9A227] underline">
                saisir la première écriture
              </Link>
              .
            </p>
          )}
          {stats?.dernieres.map((mouvement) => {
            const estRecette = mouvement.type === "RECETTE";
            return (
              <Link
                key={mouvement.id}
                href={`/tresorerie/transactions?q=${encodeURIComponent(mouvement.label)}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAF6EF] transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${estRecette ? "bg-[#5B7052]" : "bg-[#B3452E]"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1E0F2B] truncate">
                    {mouvement.label}
                  </p>
                  <p className="text-[11px] text-[#8A8378]">
                    {libelleCategorie(mouvement.category, mouvement.type)} ·{" "}
                    {libelleMethode(mouvement.method)}
                    {mouvement.reference ? ` · réf. ${mouvement.reference}` : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-sm font-bold ${estRecette ? "text-[#3F5039]" : "text-[#B3452E]"}`}
                  >
                    {estRecette ? "+" : "−"}
                    {formaterMontant(mouvement.amount, mouvement.currency)}
                  </p>
                  <p className="text-[10px] text-[#8A8378]/70">
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
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] hover:bg-[#3D1A54] transition-colors"
        >
          <BookOpen className="w-5 h-5 text-[#C9A227]" />
          <span className="text-xs font-semibold">Journal</span>
        </Link>
        <Link
          href="/tresorerie/caisse"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] hover:bg-[#3D1A54] transition-colors"
        >
          <Wallet className="w-5 h-5 text-[#C9A227]" />
          <span className="text-xs font-semibold">Caisse</span>
        </Link>
        <Link
          href="/tresorerie/rapports"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] hover:bg-[#3D1A54] transition-colors"
        >
          <BookOpen className="w-5 h-5 text-[#C9A227]" />
          <span className="text-xs font-semibold">Rapports</span>
        </Link>
      </div>
    </div>
  );
}
