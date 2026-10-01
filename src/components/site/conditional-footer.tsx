"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/ui/modem-animated-footer";
import { Mail, Youtube, Facebook } from "lucide-react";
import { TiktokNoteIcon } from "@/components/tiktok/tiktok-note-icon";

/**
 * ⭐ V4.00 — Instagram avec le DÉGRADÉ OFFICIEL au survol.
 *
 * Au repos : le contour du boîtier photo (mêmes tracés que l'icône lucide,
 * taille identique w-5) suit la couleur neutre du footer.
 * Au survol : la classe .social-instagram (globals.css) peint le trait
 * <g class="ig-stroke"> avec le dégradé de marque Instagram
 * jaune → orange → rose → magenta → violet via linearGradient
 * #ig-gradient-footer (gradientUnits="userSpaceOnUse" : le dégradé
 * traverse l'icône entière, comme le logo officiel).
 */
function InstagramGradientIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <defs>
        <linearGradient
          id="ig-gradient-footer"
          x1="2"
          y1="22"
          x2="22"
          y2="2"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="50%" stopColor="#D62976" />
          <stop offset="75%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <g className="ig-stroke">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </g>
    </svg>
  );
}

// ⭐ V4.00 — Réseaux sociaux officiels du Mouvement Christ Libère.
// Au repos les icônes restent neutres (blanc cassé 50 %, comme avant) ;
// au survol chaque plateforme prend sa VRAIE couleur officielle via
// .social-* (globals.css) : YouTube rouge #FF0000, Facebook bleu
// #1877F2, Instagram dégradé de marque, TikTok duo cyan/rose, Gmail
// rouge #EA4335. Les liens ouvrent les vraies pages du mouvement.
const socialLinks = [
  {
    icon: <Youtube className="w-5 h-5" />,
    href: "https://youtube.com/@mouvementchristlibere",
    label: "YouTube — Mouvement Christ Libère",
    hoverClassName: "social-youtube",
  },
  {
    icon: <InstagramGradientIcon size={20} />,
    href: "https://www.instagram.com/mouvementchristlibere",
    label: "Instagram — Mouvement Christ Libère",
    hoverClassName: "social-instagram",
  },
  {
    icon: <Facebook className="w-5 h-5" />,
    href: "https://www.facebook.com/share/v/1HUtdjUgxx/",
    label: "Facebook — Mouvement Christ Libère",
    hoverClassName: "social-facebook",
  },
  {
    icon: <TiktokNoteIcon size={20} duoClassName="tk-duo" />,
    href: "https://www.tiktok.com/@mouvementchristlibere",
    label: "TikTok — Mouvement Christ Libère",
    hoverClassName: "social-tiktok",
  },
  {
    icon: <Mail className="w-5 h-5" />,
    href: "mailto:mouvementchristlibere@gmail.com",
    label: "Email — mouvementchristlibere@gmail.com",
    hoverClassName: "social-mail",
  },
];

const navLinks = [
  { label: "Afrika", href: "/afrika" },
  { label: "Pasteur Kongo", href: "/pasteur-kongo" },
  { label: "Témoignages", href: "/temoignages" },
  { label: "Enseignements", href: "/enseignements" },
  { label: "Vidéos & Lives", href: "/videos" },
  // ⭐ V3.79 — Page dédiée Adoration & Louanges (Afrika, chantre de l'Éternel).
  { label: "Adoration & Louanges", href: "/adoration-louanges" },
  { label: "Communauté", href: "/communaute" },
  { label: "Contribuer", href: "/contribuer" },
  // ⭐ V3.74 — page /contact retirée (redirigée) : contact = rendez-vous.
  { label: "Contact", href: "/rendez-vous" },
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
