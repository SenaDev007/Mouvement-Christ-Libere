"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero simple */}
      <section className="bg-imperial text-ivory py-24 md:py-32 relative overflow-hidden">
        <div className="container mx-auto max-w-7xl px-4">
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-6">
            Un même appel, deux serviteurs
          </p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight mb-6">
            Afrika Alkebulane Pamela Dali
            <span className="block text-gold mt-2">& Pasteur Kongo</span>
          </h1>
          <p className="text-lg md:text-xl text-ivory/80 leading-relaxed max-w-2xl mb-10">
            Témoignages, enseignements et vie de communauté, au service du rassemblement
            des fils d&apos;Israël dispersés — en préparation au retour du Maître Yeshoua,
            au son du chofar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/temoignages" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors">
              Découvrir le témoignage de PAM
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/biographie" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md border border-gold/40 text-gold font-semibold text-sm hover:bg-gold/10 transition-colors">
              Le ministère du Pasteur Kongo
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <p className="text-center text-xs uppercase tracking-[0.25em] text-stone font-semibold mb-12">
            Ce que cette plateforme rassemble aujourd&apos;hui
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <div className="text-center">
              <div className="font-serif text-4xl md:text-5xl font-semibold text-imperial mb-2">16</div>
              <div className="text-xs md:text-sm text-stone">jalons biographiques</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-4xl md:text-5xl font-semibold text-imperial mb-2">6</div>
              <div className="text-xs md:text-sm text-stone">témoignages authentiques</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-4xl md:text-5xl font-semibold text-imperial mb-2">6</div>
              <div className="text-xs md:text-sm text-stone">enseignements publiés</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-4xl md:text-5xl font-semibold text-imperial mb-2">24h</div>
              <div className="text-xs md:text-sm text-stone">délai de réponse</div>
            </div>
          </div>
        </div>
      </section>

      {/* Serviteurs */}
      <section className="bg-ivory py-20 md:py-24 border-t border-stone/15">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-gold font-semibold mb-3">
              Deux ministères, une même vision
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-ink">
              Deux voix, une même vision
            </h2>
            <p className="mt-5 text-base text-stone leading-relaxed max-w-2xl mx-auto">
              PAM et le Pasteur Kongo exercent chacun un ministère distinct, uni par le mariage
              et par une même conviction : préparer les cœurs, transmettre ce qui a été reçu,
              et rassembler ceux qui se reconnaissent dans cette parole.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <div className="bg-ivory border border-stone/20 rounded-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gold" />
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-gold bg-gold/10">
                  <span className="font-serif text-lg font-semibold text-gold">AP</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone font-semibold">Servante de l&apos;Éternel</div>
                  <div className="font-serif text-xl font-semibold text-ink mt-0.5">PAM</div>
                  <div className="text-xs text-stone mt-0.5">Afrika Alkebulane Pamela Dali</div>
                </div>
              </div>
              <p className="text-sm text-ink/75 leading-relaxed mb-6">
                Témoignages d&apos;enlèvements au ciel, instructions reçues du Seigneur Yeshoua.
                Figure contemporaine du patriarche Hénoch.
              </p>
              <Link href="/biographie" className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors">
                Lire la biographie de PAM
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-ivory border border-stone/20 rounded-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gold" />
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-gold bg-gold/10">
                  <span className="font-serif text-lg font-semibold text-gold">PK</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone font-semibold">Époux, ministre pastoral</div>
                  <div className="font-serif text-xl font-semibold text-ink mt-0.5">Pasteur Kongo</div>
                </div>
              </div>
              <p className="text-sm text-ink/75 leading-relaxed mb-6">
                Ministère pastoral complémentaire, enseignements et partages spirituels.
              </p>
              <Link href="/biographie" className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors">
                Lire la biographie du Pasteur Kongo
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Citation */}
      <section className="bg-imperial py-24 md:py-32 text-center">
        <div className="container mx-auto max-w-4xl px-4">
          <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl font-medium text-ivory leading-relaxed italic mb-6">
            « Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit. »
          </blockquote>
          <p className="text-xs uppercase tracking-[0.25em] text-gold-light/70 font-semibold">
            Genèse 5:24
          </p>
        </div>
      </section>

      {/* Appel communauté */}
      <section className="bg-imperial py-24 md:py-32 border-t border-gold/20">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold font-semibold mb-3">Communauté</p>
          <h2 className="font-serif text-3xl md:text-5xl font-semibold text-ivory leading-tight mb-6">
            Rejoignez les fils d&apos;Israël dispersés
          </h2>
          <p className="text-base md:text-lg text-ivory/70 leading-relaxed max-w-2xl mx-auto mb-10">
            Des espaces d&apos;échange organisés par thème, modérés avec attention,
            pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints chiffrés,
            intercession — à chacun son rythme.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/communaute" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors">
              Rejoindre un canal
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/contribuer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md border border-gold/40 text-gold font-semibold text-sm hover:bg-gold/10 transition-colors">
              Contribuer
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
