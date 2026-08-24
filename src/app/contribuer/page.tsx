"use client";

import { useState } from "react";
import { PageHero } from "@/components/magic/page-hero";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { Heart, FileText, CreditCard, Send, Bitcoin, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const AMOUNTS = [10, 25, 50, 100];

const METHODS = [
  { id: "card", label: "Carte", icon: CreditCard },
  { id: "transfer", label: "Virement", icon: Send },
  { id: "mobile", label: "Mobile Money", icon: Send },
  { id: "crypto", label: "Crypto", icon: Bitcoin },
];

export default function ContribuerPage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(25);
  const [customAmount, setCustomAmount] = useState("");
  const [method, setMethod] = useState("card");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const finalAmount = customAmount ? parseInt(customAmount) : selectedAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalAmount || finalAmount < 1) return;
    setSubmitting(true);
    // Simulation soumission (l'intégration Stripe sera en V2)
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setSubmitting(false);
    setSuccess(true);
  };

  return (
    <div>
      <PageHero
        kicker="Soutenir le ministère"
        title="Contribuer"
        subtitle="Vos dons soutiennent le fonctionnement de cette plateforme et la diffusion des enseignements. Leur usage est publié chaque année, avec transparence totale."
        primaryCta={{ label: "Faire un don", href: "#don" }}
      />

      {/* Formulaire */}
      <section id="don" className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-3xl px-4">
          {success ? (
            <div className="card-gold-top p-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-state-success/15 border-2 border-state-success/40 mb-6">
                <CheckCircle2 className="w-8 h-8 text-state-success" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-ink mb-3">
                Merci pour votre offrande
              </h2>
              <p className="text-sm text-stone leading-relaxed mb-6">
                Votre don de <span className="font-semibold text-gold-dark">{finalAmount} €</span> a bien été enregistré.
                Que le Seigneur vous bénisse.
              </p>
              <button
                onClick={() => {
                  setSuccess(false);
                  setSelectedAmount(25);
                  setCustomAmount("");
                }}
                className="text-sm font-semibold text-imperial hover:text-gold transition-colors"
              >
                Faire un autre don
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card-gold-top p-8 md:p-10">
              <h2 className="font-serif text-2xl font-semibold text-ink mb-3">
                Faire un don
              </h2>
              <p className="text-sm text-ink/80 leading-relaxed mb-8">
                Choisissez le montant de votre offrande. Aucune pression, aucun montant minimum.
                Ce que votre cœur décide, librement.
              </p>

              {/* Montants suggérés */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amount);
                      setCustomAmount("");
                    }}
                    className={cn(
                      "px-4 py-4 rounded-card border text-center transition-all group",
                      selectedAmount === amount && !customAmount
                        ? "border-gold bg-gold/10 shadow-[0_0_20px_rgba(201,162,39,0.2)]"
                        : "border-stone/30 hover:border-gold/50 hover:bg-gold/5"
                    )}
                  >
                    <div className={cn(
                      "font-serif text-2xl font-semibold transition-colors",
                      selectedAmount === amount && !customAmount ? "text-gold-dark" : "text-imperial group-hover:text-gold"
                    )}>
                      {amount} €
                    </div>
                  </button>
                ))}
              </div>

              {/* Montant libre */}
              <div className="mb-8">
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Ou un montant libre
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmount(null);
                    }}
                    placeholder="0"
                    className="flex-1 px-4 py-3.5 rounded-card border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                  />
                  <span className="text-stone font-semibold text-lg">€</span>
                </div>
              </div>

              {/* Méthodes de paiement */}
              <div className="mb-8">
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Méthode de paiement
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={cn(
                          "px-3 py-3 rounded-card border text-center transition-all",
                          method === m.id
                            ? "border-gold bg-gold/10"
                            : "border-stone/30 hover:border-gold/50"
                        )}
                      >
                        <Icon className={cn(
                          "w-4 h-4 mx-auto mb-1.5",
                          method === m.id ? "text-gold" : "text-stone"
                        )} />
                        <span className={cn(
                          "text-xs font-semibold",
                          method === m.id ? "text-ink" : "text-stone"
                        )}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={submitting || !finalAmount || finalAmount < 1}
                className="w-full px-6 py-4 rounded-card bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4" />
                    Faire un don{finalAmount ? ` de ${finalAmount} €` : ""}
                  </>
                )}
              </button>

              <p className="text-xs text-stone mt-4 text-center italic">
                Aucun montant minimum. Paiement sécurisé.
              </p>
            </form>
          )}

          {/* Transparence */}
          <div className="mt-8 p-6 bg-imperial/5 border border-gold/20 rounded-card text-center">
            <FileText className="w-6 h-6 text-gold mx-auto mb-3" />
            <p className="text-sm text-ink/80 mb-3">
              L'usage des dons est publié chaque année, avec transparence totale sur
              les montants reçus et leur affectation.
            </p>
            <a
              href="#"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors"
            >
              Consulter le rapport d'utilisation des fonds
            </a>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="bg-imperial py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/5 blur-[100px] rounded-full pointer-events-none" />
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
