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
} from "lucide-react";
import Link from "next/link";

const navItems = [
  { name: "Accueil", url: "/", icon: Home },
  { name: "Pam", url: "/pam", icon: Sparkles },
  { name: "Pasteur Kongo", url: "/pasteur-kongo", icon: User },
  { name: "Témoignages", url: "/temoignages", icon: FileText },
  { name: "Enseignements", url: "/enseignements", icon: BookOpen },
  { name: "Vidéos", url: "/videos", icon: Video },
  { name: "Bible", url: "/bible", icon: BookOpen },
  { name: "Communauté", url: "/communaute", icon: Users },
];

export function TubelightNav() {
  return (
    <>
      <NavBar items={navItems} />

      {/* CTA — desktop, bas-droite */}
      <div className="hidden lg:block fixed bottom-6 right-6 z-50">
        <Link
          href="/communaute"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap shadow-lg shadow-[#C9A227]/20"
        >
          Rejoindre
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        </Link>
      </div>

      {/* Padding bottom sur mobile */}
      <div className="h-20 md:hidden" />
    </>
  );
}
