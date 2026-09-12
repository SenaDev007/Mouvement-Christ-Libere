"use client";

/**
 * ⭐ V3.67 — Suivi public d'une demande de rencontre (par code MCL-XXXXXX).
 *
 * Étapes affichées : Reçue → Transmise → Traitée (stepper) avec dates.
 * Confidentialité : le code ne révèle NI le message, NI le contact, NI le
 * nom du demandeur — uniquement l'avancement.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Inbox,
  Send,
  CheckCircle2,
  Archive,
  Clock,
  CalendarHeart,
} from "lucide-react";

interface ReponseSuivi {
  statut: string;
  statutLibelle: string;
  serviteur: string | null;
  deposeeLe: string;
  transmiseLe: string | null;
  traiteeLe: string | null;
}

export function SuiviDemandeView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F0E9DE] flex items-center justify-center text-[#8A857C]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <SuiviContenu />
    </Suspense>
  );
}

function SuiviContenu() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(
    (searchParams.get("code") || "").toUpperCase()
  );
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState<ReponseSuivi | null>(null);

  const consulter = useCallback(
    async (codeBrut: string) => {
      const codeNettoye = codeBrut.trim().toUpperCase();
      if (!codeNettoye) return;
      setChargement(true);
      setErreur("");
      setResultat(null);
      try {
        const res = await fetch(
          `/api/rendez-vous/suivi?code=${encodeURIComponent(codeNettoye)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de consultation");
        setResultat(data);
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setChargement(false);
      }
    },
    []
  );

  // Code fourni dans l'URL (depuis l'écran de confirmation) → consultation
  // automatique.
  useEffect(() => {
    const codeInitial = (searchParams.get("code") || "").toUpperCase();
    if (codeInitial) consulter(codeInitial);
  }, [searchParams, consulter]);

  const etape = (r: ReponseSuivi): number => {
    if (r.statut === "TRAITEE") return 3;
    if (r.statut === "TRANSMISE") return 2;
    if (r.statut === "ARCHIVEE") return 0;
    return 1;
  };

  return (
    <div className="min-h-screen bg-[#F0E9DE]">
      {/* En-tête public (même famille que /rendez-vous) */}
      <header className="bg-[#000000] text-[#F0E9DE]">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-christ-libere-v2.png"
              alt="Christ Libère"
              width={36}
              height={36}
              className="w-9 h-9 object-contain"
              priority
            />
            <span className="text-sm font-bold">
              <span className="text-[#C9A227]">Christ</span>
              <span className="text-[#F0E9DE]">&nbsp;Libère</span>
            </span>
          </Link>
          <Link
            href="/rendez-vous"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DDBE55] hover:text-[#FF7A1A] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Nouvelle demande
          </Link>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-transparent via-[#C9A227] to-transparent" />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#000000] flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-[#C9A227]" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-[#000000] mb-3">
            Suivre ma demande
          </h1>
          <p className="text-sm md:text-base text-[#8A857C] leading-relaxed max-w-xl mx-auto">
            Entrez le code de suivi remis lors du dépôt de votre demande de
            rencontre — vous verrez son avancement, sans jamais en exposer le
            contenu.
          </p>
        </div>

        {/* Formulaire de consultation */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            consulter(code);
          }}
          className="bg-white rounded-2xl border border-[#8A857C]/15 p-6 md:p-8 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="MCL-XXXXXX"
            maxLength={10}
            className="flex-1 px-4 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] font-mono text-lg text-center sm:text-left text-[#000000] tracking-widest focus:outline-none focus:border-[#C9A227]"
            aria-label="Code de suivi"
          />
          <button
            type="submit"
            disabled={chargement}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#000000] text-[#F0E9DE] text-sm font-bold hover:bg-[#161513] transition-colors disabled:opacity-50"
          >
            {chargement ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Consulter
          </button>
        </form>

        {erreur && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#B3452E] text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {erreur}
          </div>
        )}

        {/* Résultat : stepper d'avancement */}
        {resultat && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-white rounded-2xl border border-[#C9A227]/25 p-6 md:p-8 space-y-6"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-mono text-sm font-bold text-[#A3821C]">
                {code}
              </p>
              {resultat.serviteur && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#000000]/5 text-[#000000] text-xs font-semibold">
                  <CalendarHeart className="w-3.5 h-3.5 text-[#C9A227]" />
                  Serviteur demandé : {resultat.serviteur}
                </span>
              )}
            </div>

            {resultat.statut === "ARCHIVEE" ? (
              <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-[#8A857C]/10 border border-[#8A857C]/25">
                <Archive className="w-5 h-5 text-[#8A857C] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-[#000000]">
                    Demande archivée
                  </p>
                  <p className="text-xs text-[#8A857C] mt-1">
                    Cette demande a été sortie du registre actif. Pour toute
                    nouvelle démarche, déposez une nouvelle demande ou
                    contactez le secrétariat.
                  </p>
                </div>
              </div>
            ) : (
              /* Stepper Reçue → Transmise → Traitée */
              <ol className="space-y-0">
                {[
                  {
                    icone: Inbox,
                    libelle: "Reçue par le secrétariat",
                    date: resultat.deposeeLe,
                    atteinte: etape(resultat) >= 1,
                  },
                  {
                    icone: Send,
                    libelle: "Transmise au serviteur de Dieu",
                    date: resultat.transmiseLe,
                    atteinte: etape(resultat) >= 2,
                  },
                  {
                    icone: CheckCircle2,
                    libelle: "Traitée — réponse / rendez-vous",
                    date: resultat.traiteeLe,
                    atteinte: etape(resultat) >= 3,
                  },
                ].map((etapeItem, i, tous) => {
                  const Icone = etapeItem.icone;
                  return (
                    <li key={etapeItem.libelle} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                            etapeItem.atteinte
                              ? "bg-[#5B7052] text-white"
                              : "bg-[#8A857C]/10 text-[#8A857C]/60"
                          }`}
                        >
                          <Icone className="w-5 h-5" />
                        </div>
                        {i < tous.length - 1 && (
                          <div
                            className={`w-0.5 flex-1 min-h-8 ${
                              tous[i + 1].atteinte ? "bg-[#5B7052]" : "bg-[#8A857C]/20"
                            }`}
                          />
                        )}
                      </div>
                      <div className="pb-8 min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            etapeItem.atteinte
                              ? "text-[#000000]"
                              : "text-[#8A857C]/70"
                          }`}
                        >
                          {etapeItem.libelle}
                        </p>
                        {etapeItem.date && etapeItem.atteinte && (
                          <p className="text-[11px] text-[#8A857C] mt-0.5 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(etapeItem.date).toLocaleString("fr-FR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                        {!etapeItem.atteinte && (
                          <p className="text-[11px] text-[#8A857C]/60 mt-0.5">
                            En attente
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <p className="text-[11px] text-[#8A857C] leading-relaxed border-t border-[#8A857C]/10 pt-4">
              Ce suivi n&apos;affiche volontairement que l&apos;avancement —
              le contenu de votre demande reste confidentiel, entre vos mains
              et celles du secrétariat.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
