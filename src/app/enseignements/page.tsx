"use client";

import { useState } from "react";
import { useServant } from "@/components/site/servant-context";
import { TEACHINGS } from "@/lib/data/content";
import { CTAButton } from "@/components/section-primitives/section-heading";
import Link from "next/link";
import { ChevronRight, Search, FileText, Rss, Mail, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVELS = ["Tous", "Découverte", "Intermédiaire", "Avancé"] as const;

export default function EnseignementsPage() {
  const { servants } = useServant();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Tous");
  const [servantFilter, setServantFilter] = useState<"all" | "pam" | "kongo">(
    "all"
  );

  const filtered = TEACHINGS.filter((t) => {
    const matchQuery =
      !query ||
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.excerpt.toLowerCase().includes(query.toLowerCase()) ||
      t.theme.toLowerCase().includes(query.toLowerCase()) ||
      t.book.toLowerCase().includes(query.toLowerCase());
    const matchLevel = level === "Tous" || t.level === level;
    const matchServant =
      servantFilter === "all" || t.servant === servantFilter;
    return matchQuery && matchLevel && matchServant;
  });

  return (
    <div className="fade-cross">
      {/* Hero */}
      <section className="hero-imperial py-16 md:py-24 relative">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-4">
            Études bibliques
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ivory leading-tight mb-4">
            Enseignements
          </h1>
          <p className="text-lg text-ivory/80 leading-relaxed max-w-2xl">
            Des études bibliques classées par thème, par livre et par niveau,
            pour approfondir à votre rythme.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold opacity-60" />
      </section>

      {/* Barre filtres */}
      <section className="bg-ivory border-b border-stone/15 py-6">
        <div className="container mx-auto max-w-7xl px-4">
          {/* Recherche */}
          <div className="relative mb-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un enseignement, un thème, un verset..."
              className="w-full pl-11 pr-4 py-3 rounded-card border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
            />
          </div>

          {/* Filtres serviteur + niveau */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
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
                Niveau :
              </span>
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                    level === l
                      ? "bg-gold text-ink"
                      : "border border-stone/30 text-stone hover:border-gold/50"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Liste */}
      <section className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16 max-w-md mx-auto">
              <FileText className="w-10 h-10 text-stone/40 mx-auto mb-4" />
              <p className="text-stone italic leading-relaxed">
                Aucun enseignement ne correspond à cette recherche pour
                l'instant. Essayez un autre mot-clé, ou parcourez les
                enseignements par thème.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((t) => (
                <article key={t.id} className="card-gold-top p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-gold-dark font-semibold">
                      {t.theme}
                    </span>
                    <LevelBadge level={t.level} />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-ink leading-snug mb-2">
                    {t.title}
                  </h3>
                  <p className="text-sm text-ink/70 leading-relaxed mb-4 flex-1">
                    {t.excerpt}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-stone mb-3">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {t.book}
                    </span>
                    <span>·</span>
                    <span>{t.readingTime}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-stone/15">
                    <span className="text-xs text-stone">
                      {servants[t.servant].shortName}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="Télécharger en PDF"
                        className="text-stone hover:text-gold transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        href={`/enseignements/${t.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-imperial hover:text-gold transition-colors group"
                      >
                        Lire
                        <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Bandeau RSS / Email */}
          <div className="mt-12 p-6 bg-imperial/5 border border-gold/20 rounded-card">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-ink">
                Pour ne rien manquer des nouveaux enseignements :
              </p>
              <div className="flex items-center gap-3">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-imperial/30 text-imperial hover:bg-imperial/5 transition-colors">
                  <Rss className="w-3 h-3" />
                  Flux RSS
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-imperial/30 text-imperial hover:bg-imperial/5 transition-colors">
                  <Mail className="w-3 h-3" />
                  Email à un proche
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const colors = {
    Découverte: "bg-state-success/15 text-state-success border-state-success/30",
    Intermédiaire: "bg-gold/15 text-gold-dark border-gold/30",
    Avancé: "bg-lavender/15 text-lavender border-lavender/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border",
        colors[level as keyof typeof colors] || colors.Découverte
      )}
    >
      {level}
    </span>
  );
}
