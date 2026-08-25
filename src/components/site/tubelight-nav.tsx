"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { NavBar } from "@/components/ui/tubelight-navbar";
import {
  Home, User, FileText, BookOpen, Video, Calendar,
  Globe, Users, ChevronRight, Sparkles, Menu, X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Accueil", url: "/", icon: Home },
  { name: "Pam", url: "/pam", icon: Sparkles },
  { name: "Pasteur Kongo", url: "/pasteur-kongo", icon: User },
  { name: "Témoignages", url: "/temoignages", icon: FileText },
  { name: "Enseignements", url: "/enseignements", icon: BookOpen },
  { name: "Bible", url: "/bible", icon: BookOpen },
  { name: "Yeshua Connect", url: "/yeshua-connect", icon: Sparkles },
  { name: "Communauté", url: "/communaute", icon: Users },
];

export function TubelightNav() {
  const pathname = usePathname();
  const [navVisible, setNavVisible] = useState(true);

  // Sur /yeshua-connect, la navbar est cachée par défaut (le chat remplit l'écran).
  // L'utilisateur peut la réafficher via le bouton toggle.
  const isFullScreenPage = pathname?.startsWith("/yeshua-connect");

  // Auto-hide quand on arrive sur /yeshua-connect
  useEffect(() => {
    if (isFullScreenPage) {
      setNavVisible(false);
    } else {
      setNavVisible(true);
    }
  }, [isFullScreenPage]);

  return (
    <>
      {/* Bouton toggle — visible uniquement sur /yeshua-connect */}
      {isFullScreenPage && (
        <button
          onClick={() => setNavVisible(!navVisible)}
          className="fixed top-4 left-4 z-[60] p-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] shadow-lg border border-[#C9A227]/30 hover:bg-[#3D1A54] transition-colors"
          title={navVisible ? "Masquer la navigation" : "Afficher la navigation"}
          aria-label="Toggle navigation"
        >
          {navVisible ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}

      {/* Navbar — conditionnellement masquée sur /yeshua-connect */}
      {(!isFullScreenPage || navVisible) && (
        <div
          className={cn(
            "fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-50 mb-6 sm:pt-6 transition-all duration-300",
            isFullScreenPage && navVisible && "sm:pt-4"
          )}
        >
          <NavBar items={navItems} />
        </div>
      )}

      {/* CTA — desktop, bas-droite (masqué sur /yeshua-connect pour ne pas gêner le chat) */}
      {!isFullScreenPage && (
        <div className="hidden lg:block fixed bottom-6 right-6 z-50">
          <Link
            href="/communaute"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap shadow-lg shadow-[#C9A227]/20"
          >
            Rejoindre
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          </Link>
        </div>
      )}

      {/* Padding bottom sur mobile (sauf sur /yeshua-connect où le chat gère sa propre hauteur) */}
      {!isFullScreenPage && <div className="h-20 md:hidden" />}
    </>
  );
}
