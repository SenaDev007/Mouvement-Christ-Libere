"use client";

import Link from "next/link";
import { useServant } from "@/components/site/servant-context";
import { SectionHeading, CTAButton, GoldRule } from "@/components/section-primitives/section-heading";
import { TESTIMONIES, TEACHINGS, VIDEOS, HOME_STATS } from "@/lib/data/content";
import { ChevronRight, Radio, BookOpen, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const { servant, servants } = useServant();

  const latestTeaching = TEACHINGS[0];
  const latestVideo = VIDEOS.find((v) => v.isLive) || VIDEOS[0];
  const featuredTestimonies = TESTIMONIES.slice(0, 3);

  return (
    <div className="fade-cross">
      {/* ============================================================
          HERO
          ============================================================ */}
      <section className="relative hero-imperial overflow-hidden">
        <div className="container mx-auto max-w-7xl px-4 py-20 md:py-28 lg:py-36">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.25em] font-semibold text-gold mb-6">
              Un même appel, deux serviteurs
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] text-ivory mb-6">
              Afrika Alkebulane Pamela Dali
              <span className="block text-gold mt-2">& Pasteur Kongo</span>
            </h1>
            <p className="text-lg md:text-xl text-ivory/80 leading-relaxed max-w-2xl mb-10">
              Témoignages, enseignements et vie de communauté, au service du
              rassemblement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/temoignages"
                className="inline-flex items-center gap-1.5 px-6 py-3 rounded bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-all group"
              >
                Découvrir le témoignage de PAM
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/biographie?servant=kongo"
                className="inline-flex items-center gap-1.5 px-6 py-3 rounded border border-gold/50 text-gold font-semibold text-sm hover:bg-gold/10 transition-all group"
              >
                Découvrir le ministère du Pasteur Kongo
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>

        {/* Décoration — filet or en bas du hero */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold opacity-60" />
      </section>

      {/* ============================================================
          STATS
          ============================================================ */}
      <section className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-stone font-semibold mb-10">
            Ce que cette plateforme rassemble aujourd'hui
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {HOME_STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-serif text-4xl md:text-5xl font-semibold text-imperial mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-stone leading-snug">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PRÉSENTATION DUALE — Deux voix, une même vision
          ============================================================ */}
      <section className="bg-ivory py-16 md:py-24 border-t border-stone/15">
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeading
            kicker="Deux ministères, une même vision"
            title="Deux voix, une même vision"
            subtitle="PAM et le Pasteur Kongo exercent chacun un ministère distinct, uni par le mariage et par une même conviction : préparer les cœurs, transmettre ce qui a été reçu, et rassembler ceux qui se reconnaissent dans cette parole."
            center
          />

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Card PAM */}
            <div className="card-gold-top p-7">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-gold bg-gold/10">
                  <span className="font-serif text-base font-semibold text-gold">
                    {servants.pam.portrait}
                  </span>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
                    Servante de l'Éternel
                  </div>
                  <div className="font-serif text-xl font-semibold text-ink mt-0.5">
                    PAM
                  </div>
                </div>
              </div>
              <p className="text-sm text-ink/80 leading-relaxed mb-6">
                Témoignages d'enlèvements au ciel, instructions reçues du
                Seigneur Yeshoua. Une figure contemporaine du patriarche
                Hénoch.
              </p>
              <Link
                href="/biographie?servant=pam"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors group"
              >
                Lire la biographie de PAM
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Card Kongo */}
            <div className="card-gold-top p-7">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-gold bg-gold/10">
                  <span className="font-serif text-base font-semibold text-gold">
                    {servants.kongo.portrait}
                  </span>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
                    Pasteur, époux
                  </div>
                  <div className="font-serif text-xl font-semibold text-ink mt-0.5">
                    Pasteur Kongo
                  </div>
                </div>
              </div>
              <p className="text-sm text-ink/80 leading-relaxed mb-6">
                Ministère pastoral complémentaire. Enseignements, accompagnement
                spirituel, partage de la Parole avec sobriété et fidélité.
              </p>
              <Link
                href="/biographie?servant=kongo"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors group"
              >
                Lire la biographie du Pasteur Kongo
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          DERNIER ENSEIGNEMENT + LIVE
          ============================================================ */}
      <section className="bg-imperial py-16 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeading
            kicker="Le dernier enseignement"
            title="Pour approfondir la Parole"
            light
            subtitle="Des études bibliques classées par thème, par livre et par niveau, pour approfondir à votre rythme."
          />

          <div className="grid md:grid-cols-3 gap-6">
            {/* Carte enseignement principal */}
            <div className="md:col-span-2 bg-imperial-light border border-gold/20 rounded-card p-7">
              <div className="flex items-start justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-gold font-semibold">
                  <BookOpen className="w-3.5 h-3.5" />
                  {latestTeaching.theme}
                </span>
                <span className="text-xs text-ivory/50">
                  {latestTeaching.readingTime}
                </span>
              </div>
              <h3 className="font-serif text-2xl font-semibold text-ivory mb-3 leading-snug">
                {latestTeaching.title}
              </h3>
              <p className="text-ivory/75 leading-relaxed mb-5">
                {latestTeaching.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ivory/60">
                  {latestTeaching.book} · {latestTeaching.level}
                </span>
                <CTAButton href="/enseignements" variant="secondary" light>
                  Lire l'enseignement
                </CTAButton>
              </div>
            </div>

            {/* Carte live */}
            <div className="bg-imperial-dark border border-gold/30 rounded-card p-7 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-[0.18em] font-bold",
                    latestVideo.isLive
                      ? "bg-state-danger text-ivory animate-pulse"
                      : "bg-imperial-light text-ivory/70"
                  )}
                >
                  <Radio className="w-2.5 h-2.5" />
                  {latestVideo.isLive ? "EN DIRECT" : "PROCHAIN DIRECT"}
                </span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-ivory mb-2 leading-snug">
                {latestVideo.title}
              </h3>
              <p className="text-sm text-ivory/70 leading-relaxed mb-5 flex-1">
                {latestVideo.description}
              </p>
              <Link
                href="/videos"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-light transition-colors group"
              >
                {latestVideo.isLive
                  ? "Rejoindre le direct"
                  : "Recevoir une notification"}
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Bandeau permanent */}
          <div className="mt-8 p-4 border border-gold/15 rounded bg-imperial-dark/40">
            <p className="text-xs text-ivory/60 text-center leading-relaxed">
              Ce direct est aussi diffusé sur YouTube, Facebook et TikTok.
              Cette page reste la version de référence, conservée dans son
              intégralité.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          TÉMOIGNAGES À LA UNE
          ============================================================ */}
      <section className="bg-ivory py-16 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeading
            kicker="Témoignages"
            title="Des récits rapportés, offerts à la communauté"
            subtitle="Des récits d'expériences spirituelles, rapportés tels qu'ils ont été vécus et confiés à la communauté."
          />

          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {featuredTestimonies.map((t) => (
              <article key={t.id} className="card-gold-top p-6 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-stone font-semibold">
                    {t.themes[0]}
                  </span>
                  <TestimonyBadge status={t.status} />
                </div>
                <h3 className="font-serif text-lg font-semibold text-ink leading-snug mb-2">
                  {t.title}
                </h3>
                <p className="text-sm text-ink/70 leading-relaxed mb-4 flex-1">
                  {t.short}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-stone/15">
                  <span className="text-xs text-stone">
                    {servants[t.servant].shortName} · {t.readingTime}
                  </span>
                  <Link
                    href={`/temoignages/${t.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-imperial hover:text-gold transition-colors group"
                  >
                    Lire
                    <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <CTAButton href="/temoignages" variant="secondary">
              Voir tous les témoignages
            </CTAButton>
          </div>
        </div>
      </section>

      {/* ============================================================
          CITATION / VERSET
          ============================================================ */}
      <section className="bg-imperial py-20 md:py-28">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <Quote className="w-10 h-10 text-gold mx-auto mb-6 opacity-60" />
          <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl font-medium text-ivory leading-relaxed italic mb-6">
            « Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le
            prit. »
          </blockquote>
          <GoldRule className="mx-auto mb-3" />
          <p className="text-sm uppercase tracking-[0.2em] text-gold-light/70 font-semibold">
            Genèse 5:24
          </p>
        </div>
      </section>

      {/* ============================================================
          APPEL COMMUNAUTÉ
          ============================================================ */}
      <section className="bg-ivory py-16 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="max-w-3xl mx-auto text-center">
            <SectionHeading
              kicker="Communauté"
              title="Des espaces d'échange organisés par thème"
              subtitle="Modérés avec attention, pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints, intercession — à chacun son rythme."
              center
            />
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <CTAButton href="/communaute">Rejoindre un canal</CTAButton>
              <CTAButton href="/contribuer" variant="secondary">
                Contribuer
              </CTAButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TestimonyBadge({ status }: { status: "confirmed" | "to_discern" }) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-state-success/15 text-state-success border border-state-success/30">
        Confirmé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gold/15 text-gold-dark border border-gold/30">
      À discerner
    </span>
  );
}
