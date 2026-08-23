"use client";

import { CTAButton } from "@/components/section-primitives/section-heading";
import { Heart, FileText, CreditCard, Send, Bitcoin } from "lucide-react";

export default function ContribuerPage() {
  return (
    <div className="fade-cross">
      {/* Hero */}
      <section className="hero-imperial py-16 md:py-24 relative">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-4">
            Soutenir le ministère
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ivory leading-tight mb-4">
            Contribuer
          </h1>
          <p className="text-lg text-ivory/80 leading-relaxed max-w-2xl">
            Vos dons soutiennent le fonctionnement de cette plateforme et la
            diffusion des enseignements. Leur usage est publié chaque année.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold opacity-60" />
      </section>

      {/* Contenu */}
      <section className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="card-gold-top p-8 md:p-10">
            <h2 className="font-serif text-2xl font-semibold text-ink mb-3">
              Faire un don
            </h2>
            <p className="text-sm text-ink/80 leading-relaxed mb-6">
              Choisissez le montant de votre offrande. Aucune pression, aucun
              montant minimum. Ce que votre cœur décide, librement.
            </p>

            {/* Montants suggérés */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[10, 25, 50, 100].map((amount) => (
                <button
                  key={amount}
                  className="px-4 py-3 rounded border border-stone/30 text-center hover:border-gold hover:bg-gold/5 transition-colors group"
                >
                  <div className="font-serif text-xl font-semibold text-imperial group-hover:text-gold transition-colors">
                    {amount} €
                  </div>
                </button>
              ))}
            </div>

            {/* Montant libre */}
            <div className="mb-6">
              <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                Ou un montant libre
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="0"
                  className="flex-1 px-4 py-3 rounded border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
                <span className="text-stone font-semibold">€</span>
              </div>
            </div>

            {/* Méthodes de paiement */}
            <div className="mb-6">
              <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                Méthode de paiement
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button className="px-3 py-3 rounded border-2 border-gold bg-gold/5 text-center">
                  <CreditCard className="w-4 h-4 mx-auto mb-1 text-gold" />
                  <span className="text-xs font-semibold text-ink">Carte</span>
                </button>
                <button className="px-3 py-3 rounded border border-stone/30 text-center hover:border-gold/50 transition-colors">
                  <Send className="w-4 h-4 mx-auto mb-1 text-stone" />
                  <span className="text-xs font-semibold text-ink">Virement</span>
                </button>
                <button className="px-3 py-3 rounded border border-stone/30 text-center hover:border-gold/50 transition-colors">
                  <span className="block w-4 h-4 mx-auto mb-1 text-stone font-bold text-sm">M</span>
                  <span className="text-xs font-semibold text-ink">Mobile Money</span>
                </button>
                <button className="px-3 py-3 rounded border border-stone/30 text-center hover:border-gold/50 transition-colors">
                  <Bitcoin className="w-4 h-4 mx-auto mb-1 text-stone" />
                  <span className="text-xs font-semibold text-ink">Crypto</span>
                </button>
              </div>
            </div>

            {/* CTA */}
            <button className="w-full px-6 py-4 rounded bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2">
              <Heart className="w-4 h-4" />
              Faire un don
            </button>

            <p className="text-xs text-stone mt-4 text-center italic">
              Aucun montant minimum. Paiement par carte, virement ou mobile
              money.
            </p>
          </div>

          {/* Transparence */}
          <div className="mt-8 p-6 bg-imperial/5 border border-gold/20 rounded-card text-center">
            <FileText className="w-6 h-6 text-gold mx-auto mb-3" />
            <p className="text-sm text-ink/80 mb-3">
              L'usage des dons est publié chaque année, avec transparence
              totale sur les montants reçus et leur affectation.
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
    </div>
  );
}
