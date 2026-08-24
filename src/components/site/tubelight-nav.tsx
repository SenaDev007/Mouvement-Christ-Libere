"use client";

import { NavBar } from "@/components/ui/tubelight-navbar";
import { Home, User, FileText, BookOpen, Calendar, Users } from "lucide-react";

const navItems = [
  { name: "Accueil", url: "/", icon: Home },
  { name: "Biographie", url: "/biographie", icon: User },
  { name: "Témoignages", url: "/temoignages", icon: FileText },
  { name: "Bible", url: "/bible", icon: BookOpen },
  { name: "Calendrier", url: "/calendrier-biblique", icon: Calendar },
  { name: "Communauté", url: "/communaute", icon: Users },
];

export function TubelightNav() {
  return <NavBar items={navItems} />;
}
