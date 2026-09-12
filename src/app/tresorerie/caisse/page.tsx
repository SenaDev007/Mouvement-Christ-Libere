"use client";

/**
 * ⭐ V3.66 — Situation de caisse (Trésorerie).
 *
 * Vue consolidée calculée en direct depuis le journal :
 *  · par DEVISE : recettes, dépenses, solde, nombre de mouvements ;
 *  · par MÉTHODE (espèces, mobile money, virement…) : la « caisse
 *    espèces » physique et les comptes de mouvement.
 *
 * Données : GET /tresorerie/api/caisse (rôles TREASURER / SUPER_ADMIN).
 */

import { useEffect, useState } from "react";
import { Wallet, Loader2, Coins, Banknote, Smartphone, ArrowRight, Landmark, CreditCard, HelpCircle } from "lucide-react";
import {
  formaterMontant,
  libelleMethode,
  DEVISES,
} from "@/lib/staff-space/constants";

interface CaisseData {
  devises: {
    devise: string;
    recettes: number;
    depenses: number;
    solde: number;
    nbMouvements: number;
  }[];
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

export default function TresorerieCaissePage() {
  const [data, setData] = useState<CaisseData | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/tresorerie/api/caisse", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erreur de chargement");
        setData(json);
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8A8378]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="max-w-xl mx-auto mt-12 px-4 py-6 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#B3452E] text-sm">
        {erreur}
      </div>
    );
  }

  const aucuneDonnee =
    (data?.devises.length ?? 0) === 0 && (data?.methodes.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]">
          Situation de caisse
        </h1>
        <p className="text-sm text-[#8A8378] mt-1">
          Soldes consolidés — recalculés en direct depuis le journal à chaque
          consultation : la caisse affichée est TOUJOURS la caisse réelle.
        </p>
      </div>

      {aucuneDonnee && (
        <div className="bg-white rounded-xl border border-[#8A8378]/15 px-6 py-14 text-center">
          <Wallet className="w-8 h-8 text-[#8A8378]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378]">
            Aucun mouvement au journal — la situation de caisse s&apos;établit
            dès la première écriture.
          </p>
        </div>
      )}

      {/* Par devise */}
      {data && data.devises.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-3 px-1">
            Soldes par devise
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {data.devises.map((d) => {
              const deviseInfo = (DEVISES as Record<string, { libelle: string }>)[d.devise];
              const positif = d.solde >= 0;
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
                      {d.nbMouvements} mouvement{d.nbMouvements > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p
                    className={`text-2xl font-bold ${positif ? "text-[#DDBE55]" : "text-[#E88A76]"}`}
                  >
                    {formaterMontant(d.solde, d.devise)}
                  </p>
                  <div className="flex gap-4 mt-2 text-[11px]">
                    <span className="text-[#8FC99B]">
                      + {formaterMontant(d.recettes, d.devise)}
                    </span>
                    <span className="text-[#E88A76]">
                      − {formaterMontant(d.depenses, d.devise)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Par méthode */}
      {data && data.methodes.length > 0 && (
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
                        {libelleMethode(m.methode === "non_precise" ? null : m.methode) === "Non précisé" ? "Méthode non précisée" : libelleMethode(m.methode)}
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
        <Coins className="w-4 h-4 text-[#C9A227] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#8A8378] leading-relaxed">
          Traçabilité : chaque écriture du journal porte sa date comptable, sa
          référence de pièce justificative, son auteure ou auteur et — pour les
          corrections et suppressions — une trace complète dans le journal
          d&apos;audit du ministère. Les soldes ne sont jamais stockés : ils
          sont toujours la somme exacte des écritures.
        </p>
      </div>
    </div>
  );
}
