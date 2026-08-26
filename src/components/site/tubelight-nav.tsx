"use client";

import { useState, useEffect } from "react";
import { NavBar } from "@/components/ui/tubelight-navbar";
import {
  Home,
  User,
  FileText,
  BookOpen,
  Video,
  Calendar,
  Globe,
  Users,
  ChevronRight,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

const navItems = [
  { name: "Accueil", url: "/", icon: Home },
  { name: "Biographie", url: "/biographie", icon: User },
  { name: "Témoignages", url: "/temoignages", icon: FileText },
  { name: "Enseignements", url: "/enseignements", icon: BookOpen },
  { name: "Vidéos & Lives", url: "/videos", icon: Video },
  { name: "Bible", url: "/bible", icon: BookOpen },
  { name: "Calendrier", url: "/calendrier-biblique", icon: Calendar },
  { name: "Yeshua Connect", url: "/yeshua-connect", icon: MessageSquare },
  { name: "Communauté", url: "/communaute", icon: Users },
];

export function TubelightNav() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Sur mobile, limiter à 6 items principaux
  const mobileItems = navItems.slice(0, 6);

  return (
    <>
      {/* Tubelight navbar — floating, centrée */}
      <NavBar items={isMobile ? mobileItems : navItems} />

      {/* CTA "Rejoindre" — desktop only, positionné en bas à droite */}
      <div className="hidden lg:block fixed bottom-6 right-6 z-50">
        <Link
          href="/communaute"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap shadow-lg shadow-[#C9A227]/20"
        >
          Rejoindre
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        </Link>
      </div>

      {/* Padding bottom sur mobile pour la navbar flottante */}
      <div className="h-20 md:hidden" />
    </>
  );
}
