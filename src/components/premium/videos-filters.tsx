"use client";

import { cn } from "@/lib/utils";

interface VideosFiltersProps {
  servants: Array<{ code: string; name: string }>;
  currentServant: string;
}

export function VideosFilters({ servants, currentServant }: VideosFiltersProps) {
  const buildHref = (servant: string) => {
    if (servant === "all") return "/videos";
    return `/videos?servant=${servant}`;
  };

  return (
    <section className="bg-imperial border-b border-gold/15 py-6">
      <div className="container mx-auto max-w-7xl px-4 flex items-center justify-center gap-4">
        <span className="text-xs uppercase tracking-[0.18em] text-gold-light/70 font-semibold">
          Serviteur :
        </span>
        <div className="flex items-center gap-2">
          <a
            href={buildHref("all")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-semibold transition-all",
              currentServant === "all"
                ? "bg-gold text-ink"
                : "border border-gold/30 text-ivory hover:bg-gold/10"
            )}
          >
            Tous
          </a>
          {servants.map((s) => (
            <a
              key={s.code}
              href={buildHref(s.code)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-semibold transition-all",
                currentServant === s.code
                  ? "bg-gold text-ink"
                  : "border border-gold/30 text-ivory hover:bg-gold/10"
              )}
            >
              {s.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
