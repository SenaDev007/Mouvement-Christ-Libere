"use client";

import { useState } from "react";
import { PageHero } from "@/components/site/page-hero";
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
        imageSrc="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1920&auto=format&fit=crop"
        kicker="Soutenir le ministère"
        title="Contribuer"
        subtitle="Vos dons soutiennent le fonctionnement de cette plateforme et la diffusion des enseignements. Leur usage est publié chaque année, avec transparence totale."
        primaryCta={{ label: "Faire un don", href: "#don" }}
      />

      {/* Formulaire */}
      <section id="don" className="bg-[#FAF6EF] py-20 md:py-24">
        <div className="container mx-auto max-w-3xl px-4">
          {success ? (
            <div className="card-gold-top p-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-state-success/15 border-2 border-state-success/40 mb-6">
                <CheckCircle2 className="w-8 h-8 text-state-success" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-[#1E0F2B] mb-3">
                Merci pour votre offrande
              </h2>
              <p className="text-sm text-[#8A8378] leading-relaxed mb-6">
                Votre don de <span className="font-semibold text-[#A3821C]">{finalAmount} €</span> a bien été enregistré.
                Que le Seigneur vous bénisse.
              </p>
              <button
                onClick={() => {
                  setSuccess(false);
                  setSelectedAmount(25);
                  setCustomAmount("");
                }}
                className="text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
              >
                Faire un autre don
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card-gold-top p-8 md:p-10">
              <h2 className="font-serif text-2xl font-semibold text-[#1E0F2B] mb-3">
                Faire un don
              </h2>
              <p className="text-sm text-[#1E0F2B]/80 leading-relaxed mb-8">
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
                      "px-4 py-4 rounded-2xl border text-center transition-all group",
                      selectedAmount === amount && !customAmount
                        ? "border-[#C9A227] bg-[#C9A227]/10 shadow-[0_0_20px_rgba(201,162,39,0.2)]"
                        : "border-[#8A8378]/30 hover:border-[#C9A227]/50 hover:bg-[#C9A227]/5"
                    )}
                  >
                    <div className={cn(
                      "font-serif text-2xl font-semibold transition-colors",
                      selectedAmount === amount && !customAmount ? "text-[#A3821C]" : "text-[#2A0E3D] group-hover:text-[#C9A227]"
                    )}>
                      {amount} €
                    </div>
                  </button>
                ))}
              </div>

              {/* Montant libre */}
              <div className="mb-8">
                <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">
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
                    className="flex-1 px-4 py-3.5 rounded-2xl border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                  />
                  <span className="text-[#8A8378] font-semibold text-lg">€</span>
                </div>
              </div>

              {/* Méthodes de paiement */}
              <div className="mb-8">
                <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">
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
                          "px-3 py-3 rounded-2xl border text-center transition-all",
                          method === m.id
                            ? "border-[#C9A227] bg-[#C9A227]/10"
                            : "border-[#8A8378]/30 hover:border-[#C9A227]/50"
                        )}
                      >
                        <Icon className={cn(
                          "w-4 h-4 mx-auto mb-1.5",
                          method === m.id ? "text-[#C9A227]" : "text-[#8A8378]"
                        )} />
                        <span className={cn(
                          "text-xs font-semibold",
                          method === m.id ? "text-[#1E0F2B]" : "text-[#8A8378]"
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
                className="w-full px-6 py-4 rounded-2xl bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

              <p className="text-xs text-[#8A8378] mt-4 text-center italic">
                Aucun montant minimum. Paiement sécurisé.
              </p>
            </form>
          )}

          {/* Transparence */}
          <div className="mt-8 p-6 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-2xl text-center">
            <FileText className="w-6 h-6 text-[#C9A227] mx-auto mb-3" />
            <p className="text-sm text-[#1E0F2B]/80 mb-3">
              L'usage des dons est publié chaque année, avec transparence totale sur
              les montants reçus et leur affectation.
            </p>
            <a
              href="#"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
            >
              Consulter le rapport d'utilisation des fonds
            </a>
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
