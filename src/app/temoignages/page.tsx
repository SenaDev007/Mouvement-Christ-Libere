"use client";

import { useState } from "react";
import { useServant } from "@/components/site/servant-context";
import { TESTIMONIES } from "@/lib/data/content";
import { SectionHeading, CTAButton } from "@/components/section-primitives/section-heading";
import Link from "next/link";
import { ChevronRight, Share2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  "Tous",
  "Vision",
  "Enlèvement",
  "Paradis",
  "Chofar",
  "Rassemblement",
  "Paix",
  "Prière",
  "Discernement",
];

export default function TemoignagesPage() {
  const { servants } = useServant();
  const [theme, setTheme] = useState("Tous");
  const [servantFilter, setServantFilter] = useState<"all" | "pam" | "kongo">(
    "all"
  );

  const filtered = TESTIMONIES.filter((t) => {
    const matchTheme =
      theme === "Tous" || t.themes.some((th) => th.trim() === theme);
    const matchServant =
      servantFilter === "all" || t.servant === servantFilter;
    return matchTheme && matchServant;
  });

  return (
    <div className="fade-cross">
      {/* Hero */}
      <section className="hero-imperial py-16 md:py-24 relative">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-4">
            Récits rapportés
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ivory leading-tight mb-4">
            Témoignages
          </h1>
          <p className="text-lg text-ivory/80 leading-relaxed max-w-2xl">
            Des récits d'expériences spirituelles, rapportés tels qu'ils ont été
            vécus et confiés à la communauté.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold opacity-60" />
      </section>

      {/* Filtres */}
      <section className="bg-ivory border-b border-stone/15 py-6 sticky top-[120px] z-30 backdrop-blur-sm bg-ivory/95">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold flex items-center gap-1.5">
                <Filter className="w-3 h-3" />
                Serviteur :
              </span>
              {(["all", "pam", "kongo"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setServantFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                    servantFilter === s
                      ? "bg-imperial text-ivory"
                      : "border border-imperial/30 text-imperial hover:bg-imperial/5"
                  )}
                >
                  {s === "all" ? "Tous" : servants[s].shortName}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
                Thème :
              </span>
              {THEMES.slice(0, 5).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                    theme === t
                      ? "bg-gold text-ink"
                      : "border border-stone/30 text-stone hover:border-gold/50"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Liste témoignages */}
      <section className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-stone italic">
                Aucun témoignage ne correspond à cette recherche pour l'instant.
                Essayez un autre filtre, ou parcourez tous les témoignages.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((t) => (
                <article
                  key={t.id}
                  className="card-gold-top p-6 flex flex-col"
                >
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
                  {t.bookRef && (
                    <p className="text-xs text-stone mb-3">
                      <span className="verse-ref">{t.bookRef}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-stone/15">
                    <span className="text-xs text-stone">
                      {servants[t.servant].shortName} · {t.readingTime}
                    </span>
                    <Link
                      href={`/temoignages/${t.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-imperial hover:text-gold transition-colors group"
                    >
                      Lire le témoignage
                      <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Bandeau de bas de liste */}
          <div className="mt-12 p-6 bg-imperial/5 border border-gold/20 rounded-card text-center">
            <p className="text-sm text-ink mb-3">
              Un témoignage vous a marqué ? Partagez-le à une personne de
              confiance.
            </p>
            <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-dark transition-colors">
              <Share2 className="w-3.5 h-3.5" />
              Partager discrètement
            </button>
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
