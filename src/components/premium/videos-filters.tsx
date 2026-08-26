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
    <section className="bg-[#2A0E3D] border-b border-[#C9A227]/15 py-6">
      <div className="container mx-auto max-w-7xl px-4 flex items-center justify-center gap-4">
        <span className="text-xs uppercase tracking-[0.18em] text-[#DDBE55]/70 font-semibold">
          Serviteur :
        </span>
        <div className="flex items-center gap-2">
          <a
            href={buildHref("all")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-semibold transition-all",
              currentServant === "all"
                ? "bg-[#C9A227] text-[#1E0F2B]"
                : "border border-[#C9A227]/30 text-[#FAF6EF] hover:bg-[#C9A227]/10"
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
                  ? "bg-[#C9A227] text-[#1E0F2B]"
                  : "border border-[#C9A227]/30 text-[#FAF6EF] hover:bg-[#C9A227]/10"
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
