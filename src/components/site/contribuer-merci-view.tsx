"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  Loader2,
  RefreshCw,
  Heart,
  Home,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ⭐ V3.82 — Confirmation de don (/contribuer/merci?ref=don_xxx).
 *
 * RÈGLE DE SÉCURITÉ (spécification) : cette page ne se fie JAMAIS au
 * retour navigateur (ni à un paramètre status=… dans l'URL) — elle
 * interroge /api/dons/statut/[reference], qui lit le statut RÉEL en
 * base, mis à jour uniquement par le webhook signé du prestataire.
 * Tant que le webhook n'est pas arrivé, le don reste « pending » et la
 * page continue de vérifier d'elle-même (toutes les 4 s, 2 min max).
 */

type StatutAffiche = "chargement" | "pending" | "approved" | "failed" | "introuvable" | "erreur";

interface InfosDon {
  reference: string;
  statut: "pending" | "approved" | "failed";
  montant: number;
  devise: string;
  type_don: string | null;
  provider: string | null;
}

const INTERVALLE_MS = 4_000;
const DUREE_MAX_MS = 120_000;

function formaterFcfa(montant: number): string {
  return Math.round(Math.abs(montant))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
}

function libelleType(typeDon: string | null): string {
  return typeDon === "offrande"
    ? "offrande"
    : typeDon === "dime"
      ? "dîme"
      : "don";
}

function MerciViewInterne() {
  const parametres = useSearchParams();
  const reference = (parametres.get("ref") || "").trim();

  const [statut, setStatut] = useState<StatutAffiche>("chargement");
  const [don, setDon] = useState<InfosDon | null>(null);
  const [secondes, setSecondes] = useState(0);
  const [verification, setVerification] = useState(false);
  const [depuisDebut] = useState(() => Date.now());
  const enCours = useRef(false);

  const verifier = useCallback(async () => {
    if (!reference || enCours.current) return;
    enCours.current = true;
    setVerification(true);
    try {
      const reponse = await fetch(`/api/dons/statut/${encodeURIComponent(reference)}`, {
        cache: "no-store",
      });
      if (reponse.status === 404) {
        setStatut("introuvable");
        return;
      }
      if (!reponse.ok) {
        setStatut("erreur");
        return;
      }
      const corps = (await reponse.json()) as InfosDon;
      setDon(corps);
      setStatut(
        corps.statut === "approved"
          ? "approved"
          : corps.statut === "failed"
            ? "failed"
            : "pending"
      );
    } catch {
      setStatut((precedent) =>
        precedent === "approved" || precedent === "failed" || precedent === "introuvable"
          ? precedent
          : "pending"
      );
    } finally {
      enCours.current = false;
      setVerification(false);
    }
  }, [reference]);

  useEffect(() => {
    if (!reference) {
      setStatut("erreur");
      return;
    }
    void verifier();
  }, [reference, verifier]);

  // Polling tant que le statut n'est pas final.
  useEffect(() => {
    if (statut !== "pending") return;
    if (Date.now() - depuisDebut > DUREE_MAX_MS) return;
    const minuteur = setInterval(() => {
      setSecondes((s) => s + 1);
      void verifier();
    }, INTERVALLE_MS);
    return () => clearInterval(minuteur);
  }, [statut, verifier, depuisDebut]);

  // ── Rendus ──

  const carte = (contenu: React.ReactNode, className?: string) => (
    <div
      className={cn(
        "card-gold-top p-8 md:p-10 text-center max-w-xl mx-auto",
        className
      )}
    >
      {contenu}
    </div>
  );

  const iconeRonde = (
    Icon: typeof CheckCircle2,
    couleur: "or" | "vert" | "rouge" | "ambre"
  ) => {
    const palettes = {
      or: "bg-[#C9A227]/15 border-[#C9A227]/40 text-[#A3821C]",
      vert: "bg-state-success/15 border-state-success/40 text-state-success",
      rouge: "bg-red-100 border-red-300 text-red-600",
      ambre: "bg-amber-100 border-amber-300 text-amber-600",
    };
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center w-16 h-16 rounded-full border-2 mb-6",
          palettes[couleur]
        )}
      >
        <Icon className="w-8 h-8" />
      </div>
    );
  };

  if (!reference) {
    return carte(
      <>
        {iconeRonde(AlertCircle, "ambre")}
        <h1 className="font-serif text-2xl font-semibold text-[#1E0F2B] mb-3">
          Page de confirmation
        </h1>
        <p className="text-sm text-[#8A8378] leading-relaxed mb-6">
          Cette page confirme un paiement en cours — elle a besoin d&apos;une
          référence de don valide.
        </p>
        <LienRetour label="Retourner à la page Contribuer" href="/contribuer" />
      </>
    );
  }

  if (statut === "chargement") {
    return carte(
      <div className="py-8">
        <Loader2 className="w-10 h-10 animate-spin text-[#C9A227] mx-auto" />
        <p className="text-sm text-[#8A8378] mt-4">
          Consultation de votre paiement…
        </p>
      </div>
    );
  }

  if (statut === "pending") {
    return carte(
      <>
        {iconeRonde(Clock3, "ambre")}
        <h1 className="font-serif text-2xl font-semibold text-[#1E0F2B] mb-3">
          Vérification de votre paiement…
        </h1>
        <p className="text-sm text-[#1E0F2B]/80 leading-relaxed mb-2">
          Votre paiement est en cours de confirmation auprès du prestataire.
          Cette page se met à jour d&apos;elle-même — inutile de la quitter.
        </p>
        <p className="text-xs text-[#8A8378] font-mono mb-6">
          Référence : {reference}
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-[#8A8378]">
          {verification ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Vérification en cours…
            </>
          ) : (
            <>
              Prochaine vérification automatique dans quelques secondes
              {secondes > 0 && ` (${secondes}${secondes === 1 ? "re" : "res"} vérification${secondes === 1 ? "" : "s"})`}
            </>
          )}
        </div>
        <button
          onClick={() => void verifier()}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Vérifier maintenant
        </button>
      </>
    );
  }

  if (statut === "approved") {
    return carte(
      <>
        {iconeRonde(CheckCircle2, "vert")}
        <h1 className="font-serif text-2xl font-semibold text-[#1E0F2B] mb-3">
          Merci pour votre {libelleType(don?.type_don ?? null)}&nbsp;!
        </h1>
        {don && (
          <p className="font-serif text-3xl font-semibold text-[#A3821C] mb-4">
            {formaterFcfa(don.montant)}&nbsp;FCFA
          </p>
        )}
        <p className="text-sm text-[#1E0F2B]/80 leading-relaxed mb-6">
          Votre paiement a bien été confirmé. Votre reçu vient d&apos;être
          envoyé par email — conservez-le pour vos archives.
        </p>
        <p className="text-xs text-[#8A8378] font-mono mb-8">
          Référence : {reference}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <LienRetour
            label="Retour à l'accueil"
            href="/"
            icone={Home}
            style="principal"
          />
          <LienRetour label="Faire un autre don" href="/contribuer" icone={Heart} />
        </div>
      </>
    );
  }

  if (statut === "failed") {
    return carte(
      <>
        {iconeRonde(XCircle, "rouge")}
        <h1 className="font-serif text-2xl font-semibold text-[#1E0F2B] mb-3">
          Le paiement n&apos;a pas abouti
        </h1>
        <p className="text-sm text-[#1E0F2B]/80 leading-relaxed mb-6">
          Aucun montant n&apos;a été prélevé. Vous pouvez réessayer à tout
          moment — si le problème persiste, vérifiez votre moyen de paiement
          ou contactez le ministère.
        </p>
        <p className="text-xs text-[#8A8378] font-mono mb-8">
          Référence : {reference}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <LienRetour
            label="Réessayer"
            href="/contribuer"
            icone={RotateCcw}
            style="principal"
          />
          <LienRetour label="Retour à l'accueil" href="/" icone={Home} />
        </div>
      </>
    );
  }

  // introuvable / erreur
  return carte(
    <>
      {iconeRonde(AlertCircle, "ambre")}
      <h1 className="font-serif text-2xl font-semibold text-[#1E0F2B] mb-3">
        Référence introuvable
      </h1>
      <p className="text-sm text-[#8A8378] leading-relaxed mb-6">
        {statut === "erreur"
          ? "La vérification du paiement est momentanément indisponible — réessayez dans un instant."
          : "Cette référence de don n'existe pas (ou plus) dans nos registres."}
      </p>
      <LienRetour label="Retourner à la page Contribuer" href="/contribuer" />
    </>
  );
}

function LienRetour({
  label,
  href,
  icone: Icon,
  style,
}: {
  label: string;
  href: string;
  icone?: typeof Home;
  style?: "principal";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-colors",
        style === "principal"
          ? "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]"
          : "text-[#2A0E3D] hover:text-[#C9A227]"
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
    </Link>
  );
}

export function ContribuerMerciView() {
  return (
    <section className="bg-[#FAF6EF] py-20 md:py-28 min-h-[70vh]">
      <div className="container mx-auto max-w-3xl px-4">
        <Suspense
          fallback={
            <div className="card-gold-top p-10 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-[#C9A227] mx-auto" />
              <p className="text-sm text-[#8A8378] mt-4">Chargement…</p>
            </div>
          }
        >
          <MerciViewInterne />
        </Suspense>
      </div>
    </section>
  );
}
