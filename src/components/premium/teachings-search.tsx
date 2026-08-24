"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeachingsSearchProps {
  servants: Array<{ code: string; name: string }>;
  currentQuery: string;
  currentLevel: string;
  currentServant: string;
}

const LEVELS = ["Tous", "Découverte", "Intermédiaire", "Avancé"];
const LEVEL_VALUES: Record<string, string> = {
  "Tous": "Tous",
  "Découverte": "DECOUVERTE",
  "Intermédiaire": "INTERMEDIAIRE",
  "Avancé": "AVANCE",
};

export function TeachingsSearch({
  servants,
  currentQuery,
  currentLevel,
  currentServant,
}: TeachingsSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery);

  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  const buildHref = (params: { q?: string; level?: string; servant?: string }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.level && params.level !== "Tous") sp.set("level", params.level);
    if (params.servant && params.servant !== "all") sp.set("servant", params.servant);
    const q = sp.toString();
    return q ? `/enseignements?${q}` : "/enseignements";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    const sp = new URLSearchParams(searchParams.toString());
    if (query) {
      sp.set("q", query);
    } else {
      sp.delete("q");
    }
    const q = sp.toString();
    router.push(q ? `/enseignements?${q}` : "/enseignements");
  };

  return (
    <section className="bg-ivory border-b border-stone/15 py-8">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Recherche */}
        <form onSubmit={handleSubmit} className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un enseignement, un thème, un verset..."
            className="w-full pl-11 pr-12 py-3.5 rounded-card border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                const sp = new URLSearchParams(searchParams.toString());
                sp.delete("q");
                const q = sp.toString();
                router.push(q ? `/enseignements?${q}` : "/enseignements");
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-stone hover:text-ink"
              aria-label="Effacer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Filtres */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
              Serviteur :
            </span>
            <a
              href={buildHref({ q: currentQuery, level: currentLevel, servant: "all" })}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                currentServant === "all"
                  ? "bg-imperial text-ivory"
                  : "border border-imperial/30 text-imperial hover:bg-imperial/5"
              )}
            >
              Tous
            </a>
            {servants.map((s) => (
              <a
                key={s.code}
                href={buildHref({ q: currentQuery, level: currentLevel, servant: s.code })}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  currentServant === s.code
                    ? "bg-imperial text-ivory"
                    : "border border-imperial/30 text-imperial hover:bg-imperial/5"
                )}
              >
                {s.name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
              Niveau :
            </span>
            {LEVELS.map((l) => {
              const value = LEVEL_VALUES[l];
              return (
                <a
                  key={l}
                  href={buildHref({ q: currentQuery, level: value, servant: currentServant })}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                    currentLevel === value
                      ? "bg-gold text-ink"
                      : "border border-stone/30 text-stone hover:border-gold/50"
                  )}
                >
                  {l}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
