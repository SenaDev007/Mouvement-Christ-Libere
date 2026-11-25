"use client";

/**
 * ⭐ V3.66 — Tableau de bord du Secrétariat.
 *
 * KPIs (demandes par statut, par serviteur, urgentes, annonces) +
 * dernières demandes reçues + dernières annonces publiées. Données via
 * GET /secretariat/api/stats (rôles SECRETARY / SUPER_ADMIN).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Inbox,
  Send,
  CheckCircle2,
  Archive,
  AlertTriangle,
  Heart,
  Megaphone,
  ArrowUpRight,
  Loader2,
  FileText,
  BadgeCheck,
} from "lucide-react";
import { DEMANDE_STATUTS, SERVITEURS_RENDEZ_VOUS } from "@/lib/staff-space/constants";

interface StatsSecretariat {
  demandes: {
    recues: number;
    transmises: number;
    validees: number;
    traitees: number;
    archivees: number;
    urgentesAttente: number;
    pourAfrika: number;
    pourKongo: number;
  };
  annonces: { publiees: number; brouillons: number };
  dernieresDemandes: {
    id: string;
    requesterName: string;
    servantCode: string;
    subject: string;
    urgency: string;
    status: string;
    createdAt: string;
  }[];
  dernieresAnnonces: {
    id: string;
    title: string;
    category: string;
    publishedAt: string | null;
  }[];
}

export default function SecretariatDashboardPage() {
  const [stats, setStats] = useState<StatsSecretariat | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/secretariat/api/stats", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de chargement");
        setStats(data);
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8a8378]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="max-w-xl mx-auto mt-12 px-4 py-6 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#c05a3c] text-sm">
        {erreur}
      </div>
    );
  }

  const d = stats?.demandes;
  const kpis = [
    {
      label: "Reçues",
      value: d?.recues ?? 0,
      icon: Inbox,
      href: "/secretariat/demandes?statut=RECUE",
      couleur: "from-[#C9A227] to-[#A3821C]",
      bg: "bg-[#C9A227]/10",
    },
    {
      label: "Transmises",
      value: d?.transmises ?? 0,
      icon: Send,
      href: "/secretariat/demandes?statut=TRANSMISE",
      couleur: "from-[#5B7052] to-[#3F5039]",
      bg: "bg-[#5B7052]/10",
    },
    {
      label: "Traitées",
      value: d?.traitees ?? 0,
      icon: CheckCircle2,
      href: "/secretariat/demandes?statut=TRAITEE",
      couleur: "from-[#8C5FA8] to-[#6B4480]",
      bg: "bg-[#8C5FA8]/10",
    },
    {
      label: "Urgentes en attente",
      value: d?.urgentesAttente ?? 0,
      icon: AlertTriangle,
      href: "/secretariat/demandes?urgence=urgente",
      couleur: "from-[#B3452E] to-[#8A2F1F]",
      bg: "bg-[#B3452E]/10",
    },
    {
      label: "Annonces publiées",
      value: stats?.annonces.publiees ?? 0,
      icon: Megaphone,
      href: "/secretariat/annonces",
      couleur: "from-[#C9A227] to-[#A3821C]",
      bg: "bg-[#C9A227]/10",
      sub: `${stats?.annonces.brouillons ?? 0} brouillon${(stats?.annonces.brouillons ?? 0) > 1 ? "s" : ""}`,
    },
    {
      label: "Archivées",
      value: d?.archivees ?? 0,
      icon: Archive,
      href: "/secretariat/demandes?statut=ARCHIVEE",
      couleur: "from-[#8A8378] to-[#6B6459]",
      bg: "bg-[#FAF6EF]/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ⭐ V3.74 — validations des serviteurs en attente de clôture */}
      {(d?.validees ?? 0) > 0 && (
        <Link
          href="/secretariat/demandes?statut=VALIDEE"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#C9A227]/10 border border-[#c9a227]/60 hover:bg-[#C9A227]/20 transition-colors"
        >
          <BadgeCheck className="w-5 h-5 text-[#a3821c] flex-shrink-0" />
          <p className="text-sm text-[#000000]">
            <strong>{d?.validees} demande{d && d.validees > 1 ? "s" : ""} validée{d && d.validees > 1 ? "s" : ""}</strong>{" "}
            par les serviteurs de Dieu — à marquer traitées.
          </p>
          <ArrowUpRight className="w-4 h-4 text-[#a3821c] ml-auto flex-shrink-0" />
        </Link>
      )}

      {/* En-tête */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#f3ecf8] via-[#f3ecf8] to-[#f3ecf8] bg-grain p-6 md:p-8 text-[#1e0f2b] shadow-xl border border-[#c9a227]/35">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none animate-pulse-slow" />
        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#a3821c] font-semibold mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DDBE55] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C9A227]" />
            </span>
            Secrétariat du ministère
          </p>
          <h1 className="text-2xl md:text-3xl font-bold font-serif mb-1">
            Tableau de{" "}
            <span className="relative inline-block">
              bord
              <span className="absolute left-0 -bottom-1 h-[3px] w-full bg-gradient-to-r from-[#C9A227] to-transparent" />
            </span>
          </h1>
          <p className="text-sm text-[#1e0f2b]/70">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#8a8378] font-bold mb-3 px-1">
          Indicateurs clés
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="group relative bg-white rounded-2xl shadow-lg border border-[#c9a227]/35 p-4 hover:border-[#c9a227]/60 hover:shadow-lg transition-all overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.couleur} opacity-80`} />
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon className="w-4 h-4 text-[#1e0f2b]" />
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#1e0f2b]/25 group-hover:text-[#a3821c] transition-colors" />
                </div>
                <div className="text-2xl font-bold font-serif text-[#1e0f2b]">{kpi.value}</div>
                <div className="text-[11px] text-[#8a8378] font-medium leading-tight mt-0.5">
                  {kpi.label}
                </div>
                {kpi.sub && (
                  <div className="text-[10px] text-[#1e0f2b]/40 mt-0.5">{kpi.sub}</div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Répartition par serviteur */}
      <div className="grid md:grid-cols-2 gap-3">
        {(Object.keys(SERVITEURS_RENDEZ_VOUS) as (keyof typeof SERVITEURS_RENDEZ_VOUS)[]).map(
          (code) => {
            const serviteur = SERVITEURS_RENDEZ_VOUS[code];
            const actives =
              code === "afrika" ? d?.pourAfrika ?? 0 : d?.pourKongo ?? 0;
            return (
              <Link
                key={code}
                href={`/secretariat/demandes?servant=${code}`}
                className="flex items-center gap-4 bg-white rounded-2xl shadow-lg border border-[#c9a227]/35 p-5 hover:border-[#c9a227]/60 transition-all"
              >
                <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center">
                  <Heart className="w-5 h-5 text-[#a3821c]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1e0f2b] text-sm">
                    {serviteur.libelle}
                  </p>
                  <p className="text-xs text-[#8a8378]">
                    {actives} demande{actives > 1 ? "s" : ""} en cours (reçues + transmises)
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#1e0f2b]/25" />
              </Link>
            );
          }
        )}
      </div>

      {/* Dernières demandes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#8a8378] font-bold px-1">
            Dernières demandes reçues
          </h2>
          <Link
            href="/secretariat/demandes"
            className="text-xs text-[#a3821c] hover:text-[#a3821c] font-semibold"
          >
            Tout voir →
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-[#c9a227]/35 divide-y divide-[#C9A227]/10">
          {stats?.dernieresDemandes.length === 0 && (
            <p className="px-5 py-8 text-sm text-[#8a8378] text-center">
              Aucune demande pour l&apos;instant.
            </p>
          )}
          {stats?.dernieresDemandes.map((demande) => {
            const statut = DEMANDE_STATUTS[demande.status as keyof typeof DEMANDE_STATUTS];
            return (
              <Link
                key={demande.id}
                href={`/secretariat/demandes?q=${encodeURIComponent(demande.requesterName)}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#C9A227]/10 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statut?.point || "#8A8378" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#1e0f2b] truncate">
                      {demande.requesterName}
                    </span>
                    <span className="text-[10px] text-[#8a8378]">
                      →{" "}
                      {SERVITEURS_RENDEZ_VOUS[demande.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS]?.libelle ??
                        demande.servantCode}
                    </span>
                    {demande.urgency === "urgente" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#B3452E]/10 text-[#c05a3c]">
                        URGENTE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8a8378] truncate">{demande.subject}</p>
                </div>
                <span className="text-[10px] text-[#1e0f2b]/50 flex-shrink-0">
                  {new Date(demande.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Dernières annonces */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#8a8378] font-bold px-1">
            Dernières annonces publiées
          </h2>
          <Link
            href="/secretariat/annonces"
            className="text-xs text-[#a3821c] hover:text-[#a3821c] font-semibold"
          >
            Gérer →
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-[#c9a227]/35 divide-y divide-[#C9A227]/10">
          {stats?.dernieresAnnonces.length === 0 && (
            <p className="px-5 py-8 text-sm text-[#8a8378] text-center">
              Aucune annonce publiée —{" "}
              <Link href="/secretariat/annonces" className="text-[#a3821c] underline">
                rédiger la première
              </Link>
              .
            </p>
          )}
          {stats?.dernieresAnnonces.map((annonce) => (
            <Link
              key={annonce.id}
              href="/secretariat/annonces"
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#C9A227]/10 transition-colors"
            >
              <Megaphone className="w-4 h-4 text-[#a3821c] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1e0f2b] truncate">
                  {annonce.title}
                </p>
              </div>
              <span className="text-[10px] text-[#1e0f2b]/50 flex-shrink-0">
                {annonce.publishedAt
                  ? new Date(annonce.publishedAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })
                  : "brouillon"}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Accès rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/secretariat/demandes"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-white text-[#1e0f2b] hover:bg-white transition-colors"
        >
          <Inbox className="w-5 h-5 text-[#a3821c]" />
          <span className="text-xs font-semibold">Demandes</span>
        </Link>
        <Link
          href="/secretariat/annonces"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-white text-[#1e0f2b] hover:bg-white transition-colors"
        >
          <Megaphone className="w-5 h-5 text-[#a3821c]" />
          <span className="text-xs font-semibold">Annonces</span>
        </Link>
        <Link
          href="/secretariat/rapports"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-white text-[#1e0f2b] hover:bg-white transition-colors"
        >
          <FileText className="w-5 h-5 text-[#a3821c]" />
          <span className="text-xs font-semibold">Rapports PDF</span>
        </Link>
        <a
          href="/rendez-vous"
          target="_blank"
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-[#c9a227]/60 text-[#1e0f2b] hover:bg-[#C9A227]/5 transition-colors"
        >
          <LayoutDashboard className="w-5 h-5 text-[#a3821c]" />
          <span className="text-xs font-semibold text-center leading-tight">
            Page publique
            <br />
            /rendez-vous
          </span>
        </a>
      </div>
    </div>
  );
}
