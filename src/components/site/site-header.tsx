"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useServant, type ServantId } from "./servant-context";
import { cn } from "@/lib/utils";
import { Menu, X, ChevronRight } from "lucide-react";

const NAV_ITEMS = [
  { label: "Pam", href: "/pam" },
  { label: "Pasteur Kongo", href: "/pasteur-kongo" },
  { label: "Témoignages", href: "/temoignages" },
  { label: "Enseignements", href: "/enseignements" },
  { label: "Vidéos & Lives", href: "/videos" },
  { label: "Bible", href: "/bible" },
  { label: "Calendrier 364", href: "/calendrier-biblique" },
  { label: "Dispersés", href: "/disperses" },
  { label: "Communauté", href: "/communaute" },
];

export function SiteHeader() {
  const { current, setServant, servants } = useServant();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSwitch = (id: ServantId) => {
    setServant(id);
    setMobileOpen(false);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 border-b",
        scrolled
          ? "bg-[#2A0E3D] border-[#C9A227]/20 shadow-lg shadow-imperial-dark/50"
          : "bg-[#FAF6EF] border-[#8A8378]/20"
      )}
    >
      {/* Bandeau supérieur — switcher d'identité */}
      <div
        className={cn(
          "border-b transition-colors",
          scrolled ? "border-[#C9A227]/15 bg-[#1A0826]/40" : "border-[#8A8378]/15"
        )}
      >
        <div className="container mx-auto max-w-7xl px-4 py-2 flex items-center justify-center gap-6">
          <span
            className={cn(
              "text-[11px] uppercase tracking-[0.2em] font-medium hidden sm:block",
              scrolled ? "text-[#DDBE55]/70" : "text-[#8A8378]"
            )}
          >
            Un même appel, deux serviteurs
          </span>
          <div className="flex items-center gap-3">
            <ServantMedal
              id="pam"
              active={current === "pam" || current === "commun"}
              onClick={() => handleSwitch("pam")}
              scrolled={scrolled}
            />
            <span
              className={cn(
                "text-xs",
                scrolled ? "text-[#C9A227]/40" : "text-[#8A8378]/50"
              )}
            >
              ·
            </span>
            <ServantMedal
              id="kongo"
              active={current === "kongo" || current === "commun"}
              onClick={() => handleSwitch("kongo")}
              scrolled={scrolled}
            />
          </div>
        </div>
      </div>

      {/* Navigation principale */}
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
            onClick={() => handleSwitch("commun")}
          >
            <span
              className={cn(
                "font-serif text-xl font-semibold transition-colors",
                scrolled ? "text-[#FAF6EF]" : "text-[#1E0F2B]"
              )}
            >
              Mouvement Christ Libère
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors relative py-2 whitespace-nowrap",
                  scrolled
                    ? "text-[#FAF6EF]/80 hover:text-[#C9A227]"
                    : "text-[#1E0F2B]/80 hover:text-[#2A0E3D]"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* CTA + burger */}
          <div className="flex items-center gap-3">
            <Link
              href="/communaute"
              className={cn(
                "hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-all whitespace-nowrap",
                "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]"
              )}
            >
              Rejoindre la communauté
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            </Link>
            <button
              className={cn(
                "lg:hidden p-2 rounded",
                scrolled ? "text-[#FAF6EF]" : "text-[#1E0F2B]"
              )}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Nav mobile */}
      {mobileOpen && (
        <div className="lg:hidden bg-[#2A0E3D] border-t border-[#C9A227]/15">
          <nav className="container mx-auto max-w-7xl px-4 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[#FAF6EF]/90 hover:text-[#C9A227] py-2.5 text-sm font-medium border-b border-[#2A0E3D]-light/30 whitespace-nowrap"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/communaute"
              className="mt-3 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold whitespace-nowrap"
              onClick={() => setMobileOpen(false)}
            >
              Rejoindre la communauté
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function ServantMedal({
  id,
  active,
  onClick,
  scrolled,
}: {
  id: ServantId;
  active: boolean;
  onClick: () => void;
  scrolled: boolean;
}) {
  const { servants } = useServant();
  const s = servants[id];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 group"
      aria-label={`Voir ${s.shortName}`}
    >
      <span
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all",
          active
            ? "border-[#C9A227] bg-[#C9A227]/10"
            : scrolled
              ? "border-[#FAF6EF]/30 hover:border-[#C9A227]/50"
              : "border-[#8A8378]/30 hover:border-[#C9A227]/50"
        )}
      >
        <span
          className={cn(
            "font-serif text-xs font-semibold",
            active ? "text-[#C9A227]" : scrolled ? "text-[#FAF6EF]/70" : "text-[#1E0F2B]/70"
          )}
        >
          {s.portrait}
        </span>
      </span>
      <span
        className={cn(
          "text-xs font-medium transition-all hidden sm:block",
          active
            ? "text-[#C9A227] border-b border-[#C9A227] pb-0.5"
            : scrolled
              ? "text-[#FAF6EF]/70"
              : "text-[#1E0F2B]/70"
        )}
      >
        {s.shortName}
      </span>
    </button>
  );
}
