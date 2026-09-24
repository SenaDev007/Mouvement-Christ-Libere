"use client";

/**
 * ⭐ V3.88 — Historique des donateurs (Trésorerie).
 *
 * La demande du pasteur : « pour qu'on puisse avoir vraiment une
 * historique de tous ceux qui ont fait le don sur une certaine période,
 * en tout cas, pour que les serviteurs de Dieu puissent par exemple
 * pouvoir prier pour ces cas, pour ces personnes qui ont fait ces dons. »
 *
 *  · période libre (du / au) + raccourcis (ce mois, 30 jours, cette
 *    année, tout l'historique) ;
 *  · un donateur = une carte : identité, email, nombre de dons, total
 *    (XOF — conversion automatique des autres devises), natures (don,
 *    offrande, dîme), premier et dernier don ;
 *  · chaque don détaillé au dépliage : date, nature, montant natif,
 *    passerelle pour les dons en ligne, message laissé par le donateur ;
 *  · les dons anonymes sont comptés à part (bloc dédié) ;
 *  · tout est pensé pour être lu À VOIX HAUTE dans la prière.
 *
 * Données : /tresorerie/api/donateurs.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  HeartHandshake,
  Mail,
  MessageSquare,
  Globe,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { formaterMontant, libelleCategorie } from "@/lib/staff-space/constants";
import { cn } from "@/lib/utils";

interface DonAgrege {
  date: string;
  categorie: string;
  montant: number;
  devise: string;
  montantXof: number;
  methode: string | null;
  reference: string | null;
  enLigne: boolean;
  provider: string | null;
  statut: string | null;
  message: string | null;
}

interface Donateur {
  identite: string;
  email: string | null;
  nbDons: number;
  totalXof: number;
  types: Record<string, number>;
  premierDon: string;
  dernierDon: string;
  dons: DonAgrege[];
}

interface ReponseDonateurs {
  periode: { du: string | null; au: string | null };
  devise: string;
  totaux: { nbDonateurs: number; nbDons: number; totalXof: number };
  anonymes: { nb: number; totalXof: number };
  donateurs: Donateur[];
}

function aujourdhuiIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ilYAMois(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

const LIBELLES_TYPES: Record<string, string> = {
  don: "Don",
  offrande: "Offrande",
  dime: "Dîme",
  projet: "Projet",
  autre: "Autre",
};

const COULEURS_TYPES: Record<string, string> = {
  don: "bg-[#5B7052]/15 text-[#A3C9B0] border-[#5B7052]/30",
  offrande: "bg-[#C9A227]/15 text-[#DDBE55] border-[#C9A227]/30",
  dime: "bg-[#8C5FA8]/15 text-[#C9AEE3] border-[#8C5FA8]/30",
};

export default function TresorerieDonateursPage() {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [donnees, setDonnees] = useState<ReponseDonateurs | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [deplie, setDeplie] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (du) params.set("du", du);
      if (au) params.set("au", au);
      const res = await fetch(`/tresorerie/api/donateurs?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setDonnees(data);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, [du, au]);

  useEffect(() => {
    charger();
  }, [charger]);

  const raccourci = (debut: string) => {
    setDu(debut);
    setAu(aujourdhuiIso());
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif text-[#FAF6EF]">
            Donateurs
          </h1>
          <p className="text-sm text-[#BDB4C9] mt-1 flex items-center gap-1.5">
            <HeartHandshake className="w-4 h-4 text-[#C9A227]" />
            Tous ceux qui ont donné — pour les porter dans la prière et
            bénir leur geste.
          </p>
        </div>
      </div>

      {/* Période */}
      <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#BDB4C9]" />
          <input
            type="date"
            value={du}
            onChange={(e) => setDu(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#C9A227]/25 bg-[#C9A227]/10 text-sm"
            aria-label="Début de la période"
          />
          <span className="text-xs text-[#BDB4C9]">→</span>
          <input
            type="date"
            value={au}
            onChange={(e) => setAu(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#C9A227]/25 bg-[#C9A227]/10 text-sm"
            aria-label="Fin de la période"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              libelle: "Ce mois",
              valeur: () =>
                raccourci(
                  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`
                ),
            },
            { libelle: "30 derniers jours", valeur: () => raccourci(ilYAMois(1)) },
            {
              libelle: "Cette année",
              valeur: () => raccourci(`${new Date().getFullYear()}-01-01`),
            },
            {
              libelle: "Tout l'historique",
              valeur: () => {
                setDu("");
                setAu("");
              },
            },
          ].map((r) => (
            <button
              key={r.libelle}
              onClick={r.valeur}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#C9A227]/10 text-[#BDB4C9] hover:bg-[#C9A227]/10 transition-colors"
            >
              {r.libelle}
            </button>
          ))}
        </div>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#E08B6D] text-xs border border-[#B3452E]/30">
          <AlertCircle className="w-4 h-4" />
          {erreur}
        </div>
      )}

      {/* Totaux */}
      {chargement ? (
        <div className="flex items-center justify-center py-16 text-[#BDB4C9]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : !donnees || donnees.donateurs.length === 0 ? (
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 px-6 py-14 text-center">
          <HeartHandshake className="w-8 h-8 text-[#FAF6EF]/25 mx-auto mb-3" />
          <p className="text-sm text-[#BDB4C9]">
            Aucun donateur identifié sur cette période.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4">
              <p className="text-[10px] uppercase font-bold text-[#BDB4C9] tracking-wider">
                Donateurs
              </p>
              <p className="text-2xl font-bold font-serif text-[#FAF6EF] mt-1">
                {donnees.totaux.nbDonateurs}
              </p>
            </div>
            <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4">
              <p className="text-[10px] uppercase font-bold text-[#BDB4C9] tracking-wider">
                Dons reçus
              </p>
              <p className="text-2xl font-bold font-serif text-[#FAF6EF] mt-1">
                {donnees.totaux.nbDons}
              </p>
            </div>
            <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/25 p-4">
              <p className="text-[10px] uppercase font-bold text-[#BDB4C9] tracking-wider">
                Total de la période
              </p>
              <p className="text-lg md:text-xl font-bold text-[#DDBE55] mt-1">
                {formaterMontant(donnees.totaux.totalXof, "XOF")}
              </p>
            </div>
            <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4">
              <p className="text-[10px] uppercase font-bold text-[#BDB4C9] tracking-wider">
                Dons anonymes
              </p>
              <p className="text-2xl font-bold font-serif text-[#FAF6EF] mt-1">
                {donnees.anonymes.nb}
                <span className="text-xs font-medium text-[#BDB4C9]">
                  {" "}
                  · {formaterMontant(donnees.anonymes.totalXof, "XOF")}
                </span>
              </p>
            </div>
          </div>

          {/* Liste des donateurs */}
          <div className="space-y-3">
            {donnees.donateurs.map((donateur, index) => {
              const ouvert = deplie === donateur.identite + index;
              return (
                <div
                  key={donateur.identite + index}
                  className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 overflow-hidden"
                >
                  <button
                    onClick={() => setDeplie(ouvert ? null : donateur.identite + index)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#C9A227]/15 transition-colors"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                        index === 0
                          ? "bg-[#C9A227]"
                          : index === 1
                            ? "bg-[#8C5FA8]"
                            : index === 2
                              ? "bg-[#5B7052]"
                              : "bg-[#FAF6EF]/10"
                      }`}
                    >
                      {donateur.identite
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((m) => m[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold font-serif text-[#FAF6EF] truncate">
                        {donateur.identite}
                      </p>
                      <p className="text-[11px] text-[#BDB4C9] truncate flex items-center gap-2 flex-wrap">
                        <span>
                          {donateur.nbDons} don{donateur.nbDons > 1 ? "s" : ""}
                        </span>
                        <span>·</span>
                        <span>
                          du{" "}
                          {new Date(donateur.premierDon).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {" au "}
                          {new Date(donateur.dernierDon).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {donateur.email && (
                          <span className="inline-flex items-center gap-1 text-[#C9AEE3]">
                            <Mail className="w-3 h-3" />
                            {donateur.email}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#DDBE55]">
                        {formaterMontant(donateur.totalXof, "XOF")}
                      </p>
                      <div className="flex gap-1 justify-end mt-1">
                        {Object.entries(donateur.types)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([type, nb]) => (
                            <span
                              key={type}
                              className={cn(
                                "px-1.5 py-0.5 rounded-full text-[9px] font-bold border",
                                COULEURS_TYPES[type] ||
                                  "bg-[#FAF6EF]/10 text-[#BDB4C9] border-[#C9A227]/25"
                              )}
                            >
                              {LIBELLES_TYPES[type] || type} ×{nb}
                            </span>
                          ))}
                      </div>
                    </div>
                    {ouvert ? (
                      <ChevronUp className="w-4 h-4 text-[#BDB4C9] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#BDB4C9] flex-shrink-0" />
                    )}
                  </button>

                  {ouvert && (
                    <div className="border-t border-[#C9A227]/10 px-5 py-4 space-y-3 bg-[#C9A227]/15">
                      {donateur.dons.map((don, i) => (
                        <div
                          key={`${don.reference || "don"}-${i}`}
                          className="bg-[#1A0826]/70 rounded-lg shadow border border-[#C9A227]/15 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-xs font-semibold text-[#FAF6EF]">
                              {new Date(don.date).toLocaleDateString("fr-FR", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                              {" · "}
                              <span className="text-[#BDB4C9]">
                                {LIBELLES_TYPES[don.categorie] ||
                                  libelleCategorie(don.categorie, "RECETTE")}
                              </span>
                            </p>
                            <p className="text-sm font-bold text-[#A3C9B0]">
                              {formaterMontant(don.montant, don.devise)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#BDB4C9]">
                            {don.enLigne && (
                              <span className="inline-flex items-center gap-1 text-[#C9AEE3]">
                                <Globe className="w-3 h-3" />
                                {don.provider === "fedapay"
                                  ? "FedaPay"
                                  : don.provider === "paystack"
                                    ? "Paystack"
                                    : "En ligne"}
                              </span>
                            )}
                            {don.reference && <span>réf. {don.reference}</span>}
                          </div>
                          {don.message && (
                            <div className="px-3 py-2 rounded-md bg-[#C9A227]/10 border border-[#C9A227]/20 flex items-start gap-2">
                              <MessageSquare className="w-3 h-3 text-[#C9A227] flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-[#FAF6EF]/75 italic">
                                {don.message}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Note de prière + anonymes */}
          <div className="rounded-xl bg-gradient-to-br from-[#2A0E3D] to-[#3D1A54] border border-[#C9A227]/25 p-5 text-[#FAF6EF]">
            <p className="text-xs font-semibold flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#DDBE55]" />
              <span className="text-[#DDBE55] uppercase tracking-wider text-[10px] font-bold">
                Pour la prière
              </span>
            </p>
            <p className="text-sm text-white/80 leading-relaxed">
              {donnees.donateurs.length} personne{donnees.donateurs.length > 1 ? "s" : ""}{" "}
              donné{donnees.donateurs.length > 1 ? "ont" : "a"} soutenu le
              ministère sur cette période
              {donnees.anonymes.nb > 0
                ? `, plus ${donnees.anonymes.nb} don${donnees.anonymes.nb > 1 ? "s" : ""} anonyme${donnees.anonymes.nb > 1 ? "s" : ""}`
                : ""}
              . « Dieu aime celui qui donne avec joie » (2 Corinthiens 9:7) —
              que chaque nom ci-dessus soit béni et porté devant le Seigneur.
            </p>
          </div>

          <p className="text-[10px] text-[#FAF6EF]/50 italic flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Totaux convertis en francs CFA (taux de référence) · usage interne
            de la trésorerie — prière et action de grâce.
          </p>
        </>
      )}
    </div>
  );
}
