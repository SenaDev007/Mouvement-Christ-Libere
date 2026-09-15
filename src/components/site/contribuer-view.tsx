"use client";

import { useState } from "react";
import { PageHero } from "@/components/site/page-hero";
import { HeroConfig } from "@/lib/hero-defaults";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import {
  FileText,
  Send,
  ShieldCheck,
  Loader2,
  AlertCircle,
  HandCoins,
  Wheat,
  Gift,
  Smartphone,
  Globe,
  Mail,
  User,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ⭐ V3.82 — Page publique « Contribuer » : vraies passerelles de paiement.
 *
 * Refonte complète de l'ancien formulaire de simulation :
 *   ① intention claire — Offrande / Dîme / Don (les trois catégories
 *      retrouvées telles quelles au niveau de la trésorerie) ;
 *   ② montant en FCFA (suggestions + libre) ;
 *   ③ coordonnées — email obligatoire (envoi du reçu), nom optionnel ;
 *   ④ DEUX canaux réels, deux boutons distincts :
 *        · FedaPay — Côte d'Ivoire / Afrique de l'Ouest (Mobile Money
 *          MTN, Orange, Moov, Wave + cartes régionales) ;
 *        · Paystack — international (Visa / Mastercard, partout).
 *   ⑤ redirection immédiate vers la page de paiement du prestataire ;
 *      la confirmation n'appartient qu'au webhook signé (jamais au
 *      retour navigateur) — voir /contribuer/merci.
 */

type TypeDon = "offrande" | "dime" | "don";
type ProviderId = "fedapay" | "paystack";

const TYPES_DON: Array<{
  id: TypeDon;
  label: string;
  sousTitre: string;
  verset: string;
  reference: string;
  icon: typeof HandCoins;
}> = [
  {
    id: "offrande",
    label: "Offrande",
    sousTitre: "Un cœur reconnaissant",
    verset: "« Offrez à Dieu des sacrifices d'actions de grâces. »",
    reference: "Psaume 50:14",
    icon: HandCoins,
  },
  {
    id: "dime",
    label: "Dîme",
    sousTitre: "La part fidèle",
    verset: "« Apportez tout le dixième à la maison du trésor. »",
    reference: "Malachie 3:10",
    icon: Wheat,
  },
  {
    id: "don",
    label: "Don",
    sousTitre: "Un soutien libre",
    verset: "« Dieu aime celui qui donne avec joie. »",
    reference: "2 Corinthiens 9:7",
    icon: Gift,
  },
];

const MONTANTS_SUGGERES = [2000, 5000, 10000, 25000];

const CANAUX: Array<{
  id: ProviderId;
  titre: string;
  zone: string;
  detail: string;
  bouton: string;
  icon: typeof Smartphone;
}> = [
  {
    id: "fedapay",
    titre: "FedaPay",
    zone: "Côte d'Ivoire · Afrique de l'Ouest",
    detail:
      "Mobile Money (MTN, Orange, Moov, Wave) et cartes bancaires régionales.",
    bouton: "Payer depuis la Côte d'Ivoire / Afrique de l'Ouest",
    icon: Smartphone,
  },
  {
    id: "paystack",
    titre: "Paystack",
    zone: "International",
    detail:
      "Cartes Visa / Mastercard émises n'importe où dans le monde — règlement en FCFA.",
    bouton: "Faire un don depuis l'étranger",
    icon: Globe,
  },
];

/** Regroupement des milliers à espace fine insécable — « 10 000 ». */
function formaterFcfa(montant: number): string {
  return Math.round(Math.abs(montant))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
}

export function ContribuerView({ hero }: { hero: HeroConfig }) {
  const [typeDon, setTypeDon] = useState<TypeDon>("don");
  const [montantChoisi, setMontantChoisi] = useState<number | null>(5000);
  const [montantLibre, setMontantLibre] = useState("");
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [soumission, setSoumission] = useState<ProviderId | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const montantFinal = montantLibre ? parseInt(montantLibre, 10) : montantChoisi;
  const montantOk =
    montantFinal !== null &&
    Number.isInteger(montantFinal) &&
    montantFinal >= 100 &&
    montantFinal <= 5_000_000;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const demarrerPaiement = async (provider: ProviderId) => {
    setErreur(null);
    if (!montantOk) {
      setErreur(
        "Choisissez un montant valide (nombre entier, entre 100 et 5 000 000 FCFA)."
      );
      return;
    }
    if (!emailOk) {
      setErreur(
        "Une adresse email valide est requise : c'est là que votre reçu sera envoyé."
      );
      return;
    }
    setSoumission(provider);
    try {
      const reponse = await fetch("/api/dons/initier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          type_don: typeDon,
          montant: montantFinal,
          devise: "XOF",
          email: email.trim(),
          nom: nom.trim() || undefined,
        }),
      });
      const corps = (await reponse.json().catch(() => ({}))) as {
        paymentUrl?: string;
        error?: string;
      };
      if (!reponse.ok || !corps.paymentUrl) {
        setSoumission(null);
        setErreur(
          corps.error ||
            "Le paiement n'a pas pu être initié — réessayez dans un instant."
        );
        return;
      }
      // Redirection immédiate vers la page de paiement du prestataire.
      window.location.assign(corps.paymentUrl);
    } catch {
      setSoumission(null);
      setErreur(
        "Connexion impossible au serveur — vérifiez votre réseau puis réessayez."
      );
    }
  };

  return (
    <div>
      <PageHero
        imageSrc={hero.backgroundImage}
        kicker={hero.kicker}
        title={hero.title}
        subtitle={hero.subtitle}
        primaryCta={hero.ctaLabel ? { label: hero.ctaLabel, href: hero.ctaHref } : undefined}
        secondaryCta={hero.cta2Label ? { label: hero.cta2Label, href: hero.cta2Href } : undefined}
      />

      {/* ════════════════════════ FORMULAIRE DE DON ════════════════════════ */}
      <section id="don" className="bg-[#FAF6EF] py-20 md:py-24">
        <div className="container mx-auto max-w-3xl px-4">
          <PremiumSectionHeading
            center
            kicker="Offrande · Dîme · Don"
            title="Faire un don"
            subtitle="Précisez votre intention, choisissez votre montant, puis payez depuis l'Afrique de l'Ouest ou depuis l'étranger. Chaque don est catégorisé et retrouvé tel quel dans la comptabilité du ministère."
          />

          <form
            className="card-gold-top p-6 md:p-10"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* ── ① Intention : offrande / dîme / don ── */}
            <fieldset className="mb-8">
              <legend className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-3">
                <span className="text-[#A3821C] font-bold">①</span>&nbsp; Votre intention
              </legend>
              <div className="grid gap-3">
                {TYPES_DON.map((t) => {
                  const Icon = t.icon;
                  const actif = typeDon === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTypeDon(t.id)}
                      aria-pressed={actif}
                      className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl border transition-all group flex items-start gap-4",
                        actif
                          ? "border-[#C9A227] bg-[#C9A227]/10 shadow-[0_0_20px_rgba(201,162,39,0.2)]"
                          : "border-[#8A8378]/30 hover:border-[#C9A227]/50 hover:bg-[#C9A227]/5"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                          actif
                            ? "bg-[#C9A227] text-[#1E0F2B]"
                            : "bg-[#8A8378]/10 text-[#8A8378] group-hover:text-[#C9A227] group-hover:bg-[#C9A227]/15"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-baseline gap-2 flex-wrap">
                          <span
                            className={cn(
                              "font-serif text-lg font-semibold",
                              actif ? "text-[#A3821C]" : "text-[#2A0E3D]"
                            )}
                          >
                            {t.label}
                          </span>
                          <span className="text-xs text-[#8A8378] font-medium">
                            {t.sousTitre}
                          </span>
                        </span>
                        <span className="block mt-1 text-xs text-[#1E0F2B]/60 italic leading-relaxed">
                          {t.verset}&nbsp;
                          <span className="not-italic text-[#8A8378] font-semibold">
                            {t.reference}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* ── ② Montant ── */}
            <fieldset className="mb-8">
              <legend className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-3">
                <span className="text-[#A3821C] font-bold">②</span>&nbsp; Votre montant
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {MONTANTS_SUGGERES.map((montant) => {
                  const actif = montantChoisi === montant && !montantLibre;
                  return (
                    <button
                      key={montant}
                      type="button"
                      onClick={() => {
                        setMontantChoisi(montant);
                        setMontantLibre("");
                      }}
                      aria-pressed={actif}
                      className={cn(
                        "px-3 py-4 rounded-2xl border text-center transition-all group",
                        actif
                          ? "border-[#C9A227] bg-[#C9A227]/10 shadow-[0_0_20px_rgba(201,162,39,0.2)]"
                          : "border-[#8A8378]/30 hover:border-[#C9A227]/50 hover:bg-[#C9A227]/5"
                      )}
                    >
                      <div
                        className={cn(
                          "font-serif text-xl md:text-2xl font-semibold transition-colors",
                          actif ? "text-[#A3821C]" : "text-[#2A0E3D] group-hover:text-[#C9A227]"
                        )}
                      >
                        {formaterFcfa(montant)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">
                        FCFA
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={100}
                  max={5000000}
                  step={100}
                  inputMode="numeric"
                  value={montantLibre}
                  onChange={(e) => {
                    setMontantLibre(e.target.value);
                    setMontantChoisi(null);
                  }}
                  placeholder="Ou un montant libre"
                  aria-label="Montant libre en FCFA"
                  className="flex-1 min-w-0 px-4 py-3.5 rounded-2xl border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                />
                <span className="text-[#8A8378] font-semibold text-sm whitespace-nowrap">
                  FCFA
                </span>
              </div>
              <p className="text-xs text-[#8A8378] mt-2 italic">
                Aucun montant minimum imposé — ce que votre cœur décide, librement.
              </p>
            </fieldset>

            {/* ── ③ Coordonnées ── */}
            <fieldset className="mb-8">
              <legend className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-3">
                <span className="text-[#A3821C] font-bold">③</span>&nbsp; Vos coordonnées
              </legend>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="don-email"
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#2A0E3D] mb-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#C9A227]" />
                    Email <span className="text-[#C9A227]">*</span>
                  </label>
                  <input
                    id="don-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full px-4 py-3.5 rounded-2xl border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                  />
                </div>
                <div>
                  <label
                    htmlFor="don-nom"
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#2A0E3D] mb-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-[#C9A227]" />
                    Nom <span className="text-[#8A8378] font-normal">(optionnel)</span>
                  </label>
                  <input
                    id="don-nom"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full px-4 py-3.5 rounded-2xl border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                  />
                </div>
              </div>
              <p className="text-xs text-[#8A8378] mt-2 italic flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5 flex-shrink-0" />
                Votre reçu est envoyé par email dès que le paiement est confirmé.
              </p>
            </fieldset>

            {/* ── ④ Canal de paiement : deux boutons distincts ── */}
            <fieldset>
              <legend className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-3">
                <span className="text-[#A3821C] font-bold">④</span>&nbsp; Votre moyen de paiement
              </legend>
              <div className="grid md:grid-cols-2 gap-3">
                {CANAUX.map((canal) => {
                  const Icon = canal.icon;
                  const enCours = soumission === canal.id;
                  const pret = montantOk && emailOk && !soumission;
                  return (
                    <button
                      key={canal.id}
                      type="button"
                      disabled={!pret || Boolean(soumission)}
                      onClick={() => demarrerPaiement(canal.id)}
                      className={cn(
                        "w-full text-left p-5 rounded-2xl border-2 transition-all group",
                        "border-[#2A0E3D] bg-[#2A0E3D] text-[#FAF6EF] hover:border-[#C9A227] hover:bg-[#341549]",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#2A0E3D] disabled:hover:border-[#2A0E3D]"
                      )}
                    >
                      <span className="flex items-center justify-between mb-3">
                        <span className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-[#C9A227]" />
                          <span className="font-serif text-lg font-semibold">
                            {canal.titre}
                          </span>
                        </span>
                        {enCours && (
                          <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
                        )}
                      </span>
                      <span className="block text-[10px] uppercase tracking-[0.15em] font-bold text-[#C9A227] mb-1.5">
                        {canal.zone}
                      </span>
                      <span className="block text-xs text-[#FAF6EF]/75 leading-relaxed mb-4">
                        {canal.detail}
                      </span>
                      <span
                        className={cn(
                          "flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-semibold text-sm transition-colors",
                          "bg-[#C9A227] text-[#1E0F2B] group-hover:bg-[#DDBE55]"
                        )}
                      >
                        {enCours ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Redirection en cours…
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            {canal.bouton}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Erreur (message du serveur, en français, actionnable) */}
              {erreur && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-3 px-4 py-3.5 rounded-2xl border border-red-300 bg-red-50"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 leading-relaxed">{erreur}</p>
                </div>
              )}

              <p className="text-xs text-[#8A8378] mt-4 text-center italic flex items-center justify-center gap-1.5 flex-wrap">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                Paiement sécurisé — vous serez redirigé vers la plateforme de notre
                prestataire ; aucune donnée bancaire ne transite par nos serveurs.
              </p>
            </fieldset>
          </form>

          {/* Transparence */}
          <div className="mt-8 p-6 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-2xl text-center">
            <FileText className="w-6 h-6 text-[#C9A227] mx-auto mb-3" />
            <p className="text-sm text-[#1E0F2B]/80 mb-3 leading-relaxed">
              Offrandes, dîmes et dons sont enregistrés dans la comptabilité du
              ministère, catégorie par catégorie. L&apos;usage des fonds est publié
              chaque année, avec transparence totale.
            </p>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="bg-[#2A0E3D] py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Que chacun donne comme il l'a résolu en son cœur, sans tristesse ni contrainte ; car Dieu aime celui qui donne avec joie."
            reference="2 Corinthiens 9:7"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
