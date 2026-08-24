"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useServant, type ServantId } from "./servant-context";
import { cn } from "@/lib/utils";
import { Menu, X, ChevronRight } from "lucide-react";

const NAV_ITEMS = [
  { label: "Biographie", href: "/biographie" },
  { label: "Témoignages", href: "/temoignages" },
  { label: "Enseignements", href: "/enseignements" },
  { label: "Vidéos & Lives", href: "/videos" },
  { label: "Calendrier", href: "/calendrier" },
  { label: "Communauté", href: "/communaute" },
  { label: "Appels", href: "/appels" },
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
          ? "bg-imperial border-gold/20 shadow-lg shadow-imperial-dark/50"
          : "bg-ivory border-stone/20"
      )}
    >
      {/* Bandeau supérieur — switcher d'identité */}
      <div
        className={cn(
          "border-b transition-colors",
          scrolled ? "border-gold/15 bg-imperial-dark/40" : "border-stone/15"
        )}
      >
        <div className="container mx-auto max-w-7xl px-4 py-2 flex items-center justify-center gap-6">
          <span
            className={cn(
              "text-[11px] uppercase tracking-[0.2em] font-medium hidden sm:block",
              scrolled ? "text-gold-light/70" : "text-stone"
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
                scrolled ? "text-gold/40" : "text-stone/50"
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
                scrolled ? "text-ivory" : "text-ink"
              )}
            >
              Mouvement Christ Libère
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-7">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors relative py-2",
                  scrolled
                    ? "text-ivory/80 hover:text-gold"
                    : "text-ink/80 hover:text-imperial"
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
                "hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-all",
                "bg-gold text-ink hover:bg-gold-light"
              )}
            >
              Rejoindre la communauté
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <button
              className={cn(
                "lg:hidden p-2 rounded",
                scrolled ? "text-ivory" : "text-ink"
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
        <div className="lg:hidden bg-imperial border-t border-gold/15">
          <nav className="container mx-auto max-w-7xl px-4 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ivory/90 hover:text-gold py-2.5 text-sm font-medium border-b border-imperial-light/30"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/communaute"
              className="mt-3 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-gold text-ink text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              Rejoindre la communauté
              <ChevronRight className="w-3.5 h-3.5" />
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
            ? "border-gold bg-gold/10"
            : scrolled
              ? "border-ivory/30 hover:border-gold/50"
              : "border-stone/30 hover:border-gold/50"
        )}
      >
        <span
          className={cn(
            "font-serif text-xs font-semibold",
            active ? "text-gold" : scrolled ? "text-ivory/70" : "text-ink/70"
          )}
        >
          {s.portrait}
        </span>
      </span>
      <span
        className={cn(
          "text-xs font-medium transition-all hidden sm:block",
          active
            ? "text-gold border-b border-gold pb-0.5"
            : scrolled
              ? "text-ivory/70"
              : "text-ink/70"
        )}
      >
        {s.shortName}
      </span>
    </button>
  );
}
