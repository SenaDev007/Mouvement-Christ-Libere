"use client";

import Link from "next/link";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestimoniesFiltersProps {
  themes: string[];
  servants: Array<{ code: string; name: string }>;
  currentTheme: string;
  currentServant: string;
}

export function TestimoniesFilters({
  themes,
  servants,
  currentTheme,
  currentServant,
}: TestimoniesFiltersProps) {
  const buildHref = (theme: string, servant: string) => {
    const params = new URLSearchParams();
    if (theme && theme !== "Tous") params.set("theme", theme);
    if (servant && servant !== "all") params.set("servant", servant);
    const query = params.toString();
    return query ? `/temoignages?${query}` : "/temoignages";
  };

  return (
    <section className="bg-ivory border-b border-stone/15 py-6 sticky top-[120px] z-30 backdrop-blur-md bg-ivory/95">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold flex items-center gap-1.5">
              <Filter className="w-3 h-3" />
              Serviteur :
            </span>
            <Link
              href={buildHref(currentTheme, "all")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                currentServant === "all"
                  ? "bg-imperial text-ivory"
                  : "border border-imperial/30 text-imperial hover:bg-imperial/5"
              )}
            >
              Tous
            </Link>
            {servants.map((s) => (
              <Link
                key={s.code}
                href={buildHref(currentTheme, s.code)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  currentServant === s.code
                    ? "bg-imperial text-ivory"
                    : "border border-imperial/30 text-imperial hover:bg-imperial/5"
                )}
              >
                {s.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold">
              Thème :
            </span>
            <Link
              href={buildHref("Tous", currentServant)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                currentTheme === "Tous"
                  ? "bg-gold text-ink"
                  : "border border-stone/30 text-stone hover:border-gold/50"
              )}
            >
              Tous
            </Link>
            {themes.slice(0, 6).map((t) => (
              <Link
                key={t}
                href={buildHref(t, currentServant)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  currentTheme === t
                    ? "bg-gold text-ink"
                    : "border border-stone/30 text-stone hover:border-gold/50"
                )}
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
