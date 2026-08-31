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
} from "lucide-react";

const navItems = [
  { name: "Accueil", url: "/", icon: Home },
  { name: "Pam", url: "/pam", icon: User },
  { name: "Pasteur Kongo", url: "/pasteur-kongo", icon: User },
  { name: "Témoignages", url: "/temoignages", icon: FileText },
  { name: "Enseignements", url: "/enseignements", icon: BookOpen },
  { name: "Vidéos", url: "/videos", icon: Video },
  { name: "Bible", url: "/bible", icon: BookOpen },
  { name: "Calendrier", url: "/calendrier-biblique", icon: Calendar },
  { name: "Dispersés", url: "/disperses", icon: Globe },
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

      {/* Padding bottom sur mobile pour la navbar flottante */}
      <div className="h-20 md:hidden" />
    </>
  );
}
