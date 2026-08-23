"use client";

import { useServant } from "@/components/site/servant-context";
import { BIOGRAPHIES } from "@/lib/data/content";
import { SectionHeading, CTAButton, GoldRule } from "@/components/section-primitives/section-heading";
import Link from "next/link";
import { ChevronRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BiographiePage() {
  const { servant, setServant, servants } = useServant();
  const servantId = servant.id === "commun" ? "pam" : servant.id;
  const milestones = BIOGRAPHIES[servantId as "pam" | "kongo"];

  return (
    <div className="fade-cross">
      {/* Hero */}
      <section className="hero-imperial py-16 md:py-24 relative">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-4">
            Les étapes d'un appel
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ivory leading-tight mb-4">
            Biographie de {servants[servantId as "pam" | "kongo"].shortName}
          </h1>
          <p className="text-lg text-ivory/80 leading-relaxed max-w-2xl">
            Un parcours retracé étape par étape, tel qu'il a été vécu et
            transmis.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold opacity-60" />
      </section>

      {/* Switcher serviteur */}
      <section className="bg-ivory border-b border-stone/15 py-6">
        <div className="container mx-auto max-w-7xl px-4 flex items-center justify-center gap-4">
          <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
            Choisir le serviteur :
          </span>
          {(["pam", "kongo"] as const).map((id) => (
            <button
              key={id}
              onClick={() => setServant(id)}
              className={cn(
                "px-4 py-2 rounded text-sm font-semibold transition-all",
                servantId === id
                  ? "bg-imperial text-ivory"
                  : "border border-imperial/30 text-imperial hover:bg-imperial/5"
              )}
            >
              {servants[id].shortName}
            </button>
          ))}
        </div>
      </section>

      {/* Frise chronologique */}
      <section className="bg-ivory py-16 md:py-24">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="relative">
            {/* Ligne verticale or */}
            <div className="absolute left-4 md:left-8 top-2 bottom-2 w-px bg-gold/40" />

            <div className="space-y-12">
              {milestones.map((m, i) => (
                <div
                  key={i}
                  className="relative pl-12 md:pl-20 fade-cross"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Point sur la frise */}
                  <div className="absolute left-0 md:left-4 top-1 flex items-center justify-center w-8 h-8 rounded-full bg-ivory border-2 border-gold">
                    <div className="w-2.5 h-2.5 rounded-full bg-gold" />
                  </div>

                  {/* Contenu */}
                  <div className="mb-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold">
                      {m.date}
                    </p>
                  </div>
                  <h2 className="font-serif text-2xl md:text-3xl font-semibold text-ink leading-snug mb-3">
                    {m.title}
                  </h2>
                  <p className="text-base text-ink/80 leading-relaxed mb-4">
                    {m.description}
                  </p>
                  {m.verseRef && m.verseText && (
                    <div className="mt-4 pl-4 border-l-2 border-gold/50">
                      <p className="font-serif italic text-base text-imperial/90 leading-relaxed mb-1">
                        « {m.verseText} »
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
                        <BookOpen className="w-3 h-3 inline mr-1.5" />
                        {m.verseRef}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTA fin de page */}
          <div className="mt-16 pt-8 border-t border-stone/15 text-center">
            <CTAButton href="/temoignages">
              Lire les témoignages de {servants[servantId as "pam" | "kongo"].shortName}
            </CTAButton>
          </div>
        </div>
      </section>
    </div>
  );
}
