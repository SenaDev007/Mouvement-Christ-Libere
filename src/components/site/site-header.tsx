"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useServant, type ServantId } from "./servant-context";
import { cn } from "@/lib/utils";
import { Menu, X, ChevronRight, ChevronDown } from "lucide-react";

// Groupes de navigation avec sous-menus
const NAV_GROUPS = [
  {
    label: "Serviteurs",
    items: [
      { label: "Pam", href: "/pam" },
      { label: "Pasteur Kongo", href: "/pasteur-kongo" },
    ],
  },
  {
    label: "Parole",
    items: [
      { label: "Témoignages", href: "/temoignages" },
      { label: "Enseignements", href: "/enseignements" },
      { label: "Bible", href: "/bible" },
    ],
  },
  {
    label: "Média",
    items: [
      { label: "Vidéos & Lives", href: "/videos" },
      { label: "Calendrier 364", href: "/calendrier-biblique" },
      { label: "Dispersés", href: "/disperses" },
    ],
  },
  {
    label: "Communauté",
    items: [
      { label: "Canaux", href: "/communaute" },
      { label: "Yeshua Connect", href: "/yeshua-connect" },
      { label: "Intercession", href: "/intercession" },
    ],
  },
];

export function SiteHeader() {
  const { current, setServant, servants } = useServant();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSwitch = (id: ServantId) => {
    setServant(id);
    setMobileOpen(false);
  };

  const handleDropdownEnter = (label: string) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setOpenDropdown(label);
  };

  const handleDropdownLeave = () => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    dropdownTimeoutRef.current = setTimeout(() => setOpenDropdown(null), 200);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 border-b",
        scrolled
          ? "bg-[#2A0E3D] border-[#C9A227]/20 shadow-lg"
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
            <span className={cn("text-xs", scrolled ? "text-[#C9A227]/40" : "text-[#8A8378]/50")}>·</span>
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
          {/* Logo — espacement réduit */}
          <Link href="/" className="flex items-center gap-1.5 group" onClick={() => handleSwitch("commun")}>
            <Image
              src="/logo-christ-libere.png"
              alt="Christ Libère"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
              priority
            />
            <span
              className={cn(
                "font-serif text-lg font-semibold transition-colors whitespace-nowrap",
                scrolled ? "text-[#FAF6EF]" : "text-[#1E0F2B]"
              )}
            >
              <span style={{ color: "#C9A227" }}>Christ</span>
              <span className="ml-1">Libère</span>
            </span>
          </Link>

          {/* Nav desktop avec dropdowns */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              href="/"
              className={cn(
                "text-sm font-medium transition-colors px-3 py-2 rounded-lg whitespace-nowrap",
                scrolled ? "text-[#FAF6EF]/80 hover:text-[#C9A227] hover:bg-white/5" : "text-[#1E0F2B]/80 hover:text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
              )}
              onClick={() => handleSwitch("commun")}
            >
              Accueil
            </Link>
            {NAV_GROUPS.map((group) => (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => handleDropdownEnter(group.label)}
                onMouseLeave={handleDropdownLeave}
              >
                <button
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium transition-colors px-3 py-2 rounded-lg whitespace-nowrap",
                    scrolled ? "text-[#FAF6EF]/80 hover:text-[#C9A227] hover:bg-white/5" : "text-[#1E0F2B]/80 hover:text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
                  )}
                >
                  {group.label}
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", openDropdown === group.label && "rotate-180")} />
                </button>
                {openDropdown === group.label && (
                  <div
                    className={cn(
                      "absolute top-full left-0 mt-1 min-w-[180px] rounded-xl shadow-xl border py-2 z-50",
                      scrolled ? "bg-[#1A0826] border-[#C9A227]/20" : "bg-white border-[#8A8378]/15"
                    )}
                  >
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "block px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                          scrolled ? "text-[#FAF6EF]/80 hover:text-[#C9A227] hover:bg-white/5" : "text-[#1E0F2B]/80 hover:text-[#C9A227] hover:bg-[#FAF6EF]"
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* CTA + burger */}
          <div className="flex items-center gap-3">
            <Link
              href="/communaute"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-all whitespace-nowrap bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]"
            >
              Rejoindre
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            </Link>
            <button
              className={cn("lg:hidden p-2 rounded", scrolled ? "text-[#FAF6EF]" : "text-[#1E0F2B]")}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Nav mobile — flat list */}
      {mobileOpen && (
        <div className="lg:hidden bg-[#2A0E3D] border-t border-[#C9A227]/15">
          <nav className="container mx-auto max-w-7xl px-4 py-4 flex flex-col gap-1">
            <Link href="/" className="text-[#FAF6EF]/90 hover:text-[#C9A227] py-2.5 text-sm font-medium whitespace-nowrap" onClick={() => setMobileOpen(false)}>Accueil</Link>
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="border-t border-[#C9A227]/10 pt-2 mt-1">
                <p className="text-[10px] uppercase tracking-wider text-[#C9A227]/60 font-bold px-1 mb-1">{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block text-[#FAF6EF]/90 hover:text-[#C9A227] py-2 text-sm font-medium whitespace-nowrap"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
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

function ServantMedal({ id, active, onClick, scrolled }: { id: ServantId; active: boolean; onClick: () => void; scrolled: boolean; }) {
  const { servants } = useServant();
  const s = servants[id];
  return (
    <button onClick={onClick} className="flex items-center gap-2 group" aria-label={`Voir ${s.shortName}`}>
      <span className={cn("flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all", active ? "border-[#C9A227] bg-[#C9A227]/10" : scrolled ? "border-[#FAF6EF]/30 hover:border-[#C9A227]/50" : "border-[#8A8378]/30 hover:border-[#C9A227]/50")}>
        <span className={cn("font-serif text-xs font-semibold", active ? "text-[#C9A227]" : scrolled ? "text-[#FAF6EF]/70" : "text-[#1E0F2B]/70")}>{s.portrait}</span>
      </span>
      <span className={cn("text-xs font-medium transition-all hidden sm:block", active ? "text-[#C9A227] border-b border-[#C9A227] pb-0.5" : scrolled ? "text-[#FAF6EF]/70" : "text-[#1E0F2B]/70")}>{s.shortName}</span>
    </button>
  );
}
