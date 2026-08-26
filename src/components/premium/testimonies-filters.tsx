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
    <section className="bg-[#FAF6EF] border-b border-[#8A8378]/15 py-6 sticky top-[120px] z-30 backdrop-blur-md bg-[#FAF6EF]/95">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold flex items-center gap-1.5">
              <Filter className="w-3 h-3" />
              Serviteur :
            </span>
            <Link
              href={buildHref(currentTheme, "all")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                currentServant === "all"
                  ? "bg-[#2A0E3D] text-[#FAF6EF]"
                  : "border border-[#2A0E3D]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
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
                    ? "bg-[#2A0E3D] text-[#FAF6EF]"
                    : "border border-[#2A0E3D]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
                )}
              >
                {s.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold">
              Thème :
            </span>
            <Link
              href={buildHref("Tous", currentServant)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                currentTheme === "Tous"
                  ? "bg-[#C9A227] text-[#1E0F2B]"
                  : "border border-[#8A8378]/30 text-[#8A8378] hover:border-[#C9A227]/50"
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
                    ? "bg-[#C9A227] text-[#1E0F2B]"
                    : "border border-[#8A8378]/30 text-[#8A8378] hover:border-[#C9A227]/50"
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
