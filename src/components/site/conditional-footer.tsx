"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/ui/modem-animated-footer";
import { Mail, Youtube, Facebook, Instagram } from "lucide-react";

const socialLinks = [
  {
    icon: <Youtube className="w-5 h-5" />,
    href: "https://youtube.com",
    label: "YouTube",
  },
  {
    icon: <Facebook className="w-5 h-5" />,
    href: "https://facebook.com",
    label: "Facebook",
  },
  {
    icon: <Instagram className="w-5 h-5" />,
    href: "https://instagram.com",
    label: "Instagram",
  },
  {
    icon: <Mail className="w-5 h-5" />,
    href: "mailto:contact@christ-libere.com",
    label: "Email",
  },
];

const navLinks = [
  { label: "Pam", href: "/pam" },
  { label: "Pasteur Kongo", href: "/pasteur-kongo" },
  { label: "Témoignages", href: "/temoignages" },
  { label: "Enseignements", href: "/enseignements" },
  { label: "Vidéos & Lives", href: "/videos" },
  { label: "Communauté", href: "/communaute" },
  { label: "Contribuer", href: "/contribuer" },
  { label: "Contact", href: "/contact" },
];

export function ConditionalFooter() {
  const pathname = usePathname();

  // Masquer le footer sur :
  // - /yeshua-connect (chat plein écran)
  // - /admin/* (le back-office a sa propre sidebar, pas besoin de footer public)
  if (
    pathname?.startsWith("/yeshua-connect") ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <Footer
      brandName="Christ Libère"
      brandDescription="Témoignages, enseignements et vie de communauté — au service du rassemblement, au son du chofar."
      socialLinks={socialLinks}
      navLinks={navLinks}
    />
  );
}
