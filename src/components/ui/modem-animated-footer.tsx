"use client";

/**
 * ⭐ V3.97 — FOOTER AU DESIGN WIN AGRO (palette Christ Libère).
 *
 * Portage du footer Win Agro : fond violet nuit + texture grain, bordure
 * or 4px, 4 colonnes (marque / Parole / Médias / Communauté & contact),
 * titres serif soulignés or, liens hover or, logo seul (⭐ V3.99 : plus
 * de halo rotatif — retour pasteur), pastilles sociales rondes, CTA doré.
 * Palette de couleurs Christ Libère conservée (violet/or/ivoire).
 */

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  Youtube,
  Facebook,
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";
// ⭐ V3.80 — PWA : bouton « Installer l'application » — rend l'installation
// du site public (« Site public Christ Libère », icône = logo) découvrable
// sur smartphone comme sur desktop.
import { InstallAppButton } from "@/components/pwa/install-app-button";

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

/** Colonnes de navigation façon Win Agro (contenu Christ Libère). */
const COLONNES: { titre: string; liens: FooterLink[] }[] = [
  {
    titre: "La Parole",
    liens: [
      { label: "Témoignages", href: "/temoignages" },
      // ⭐ V3.100 — Témoignages des CROYANTS (page distincte)
      { label: "Vies transformées", href: "/vie-transformee" },
      { label: "Enseignements", href: "/enseignements" },
      { label: "Bible du Royaume", href: "/bible" },
      { label: "Calendrier biblique", href: "/calendrier-biblique" },
    ],
  },
  {
    titre: "Médias",
    liens: [
      { label: "Vidéos & Lives", href: "/videos" },
      { label: "Adoration & Louanges", href: "/adoration-louanges" },
      { label: "Annonces du ministère", href: "/annonces" },
    ],
  },
  {
    titre: "Communauté",
    liens: [
      { label: "Yeshua Connect", href: "/yeshua-connect" },
      { label: "Intercession", href: "/intercession" },
      { label: "Dispersés d'Israël", href: "/disperses" },
      { label: "Contribuer (Don/Dîme)", href: "/contribuer" },
    ],
  },
];

interface FooterProps {
  brandName?: string;
  brandDescription?: string;
  socialLinks?: SocialLink[];
  navLinks?: FooterLink[];
  creatorName?: string;
  creatorUrl?: string;
  brandIcon?: React.ReactNode;
  className?: string;
}

export const Footer = ({
  brandName = "Christ Libère",
  brandDescription = "Témoignages, enseignements et vie de communauté — au service du rassemblement des dispersés, au son du chofar.",
  socialLinks = [],
  className,
}: FooterProps) => {
  const currentYear = new Date().getFullYear();

  return (
    <section className={cn("relative w-full mt-0 overflow-hidden", className)}>
      <footer className="bg-noir-vert text-gray-300 border-t-4 border-primary-green relative overflow-hidden">
        {/* Texture grain façon Win Agro */}
        <div className="absolute inset-0 bg-grain opacity-5 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">

            {/* ═══ Colonne marque — logo (sans halo, V3.99) + description + CTA ═══ */}
            <div className="space-y-6">
              <Link
                href="/"
                className="inline-flex items-center gap-3 focus:outline-none"
                aria-label="Mouvement Christ Libère — Retour à l'accueil"
              >
                <div className="relative w-16 h-16 overflow-hidden rounded-full border border-primary-green/30 bg-noir-vert flex items-center justify-center p-1 shadow-md">
                  <Image
                    src="/logo-christ-libere-v3.png"
                    alt="Mouvement Christ Libère"
                    width={60}
                    height={60}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-serif text-lg font-bold leading-tight text-white tracking-wide">
                    Christ Libère
                  </span>
                  <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-accent-yellow">
                    Mouvement · Au son du chofar
                  </span>
                </div>
              </Link>
              <p className="text-sm text-gray-400 font-sans leading-relaxed">
                {brandDescription}
              </p>
              <div className="pt-2">
                <Link
                  href="/rendez-vous"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary-green hover:bg-primary-green/90 text-[#1E0F2B] font-sans font-bold text-sm shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 btn-shimmer"
                >
                  Demander un rendez-vous →
                </Link>
              </div>

              {/* ⭐ V3.80 — Installation PWA : la plateforme s'installe comme
                  une application (icône sur l'écran d'accueil / le bureau,
                  ouverture directe sans passer par le lien). Toujours visible :
                  le clic déclenche l'installation native (Chrome/Edge/Android)
                  ou ouvre les instructions (iOS, Firefox). */}
              <InstallAppButton contexte="public" variante="or" toujoursVisible />
            </div>

            {/* ═══ Colonnes Parole / Médias / Communauté (façon Win Agro) ═══ */}
            {COLONNES.map((col) => (
              <div key={col.titre}>
                <h3 className="text-white font-serif text-base font-bold tracking-wider mb-6 border-b border-primary-green/20 pb-2">
                  {col.titre}
                </h3>
                <ul className="space-y-4 font-sans text-sm">
                  {col.liens.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="hover:text-accent-yellow transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* ═══ Colonne contact direct ═══ */}
            <div>
              <h3 className="text-white font-serif text-base font-bold tracking-wider mb-6 border-b border-primary-green/20 pb-2">
                Serviteurs
              </h3>
              <ul className="space-y-4 font-sans text-sm">
                <li>
                  <Link
                    href="/afrika"
                    className="hover:text-accent-yellow transition-colors duration-200"
                  >
                    Afrika Alkebulane Pamela Dali
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pasteur-kongo"
                    className="hover:text-accent-yellow transition-colors duration-200"
                  >
                    Pasteur Kongo
                  </Link>
                </li>
                <li className="pt-4 border-t border-primary-green/10">
                  <p className="text-xs text-gray-400 font-sans uppercase font-bold tracking-wider mb-3">
                    Suivez le Mouvement
                  </p>
                  {socialLinks.length > 0 && (
                    <div className="flex items-center gap-3">
                      {socialLinks.map((link, index) => (
                        <Link
                          key={index}
                          href={link.href}
                          className="w-10 h-10 rounded-full bg-primary-green/20 hover:bg-primary-green text-white hover:text-white flex items-center justify-center transition-all duration-300 hover:scale-110"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={link.label}
                        >
                          {link.icon}
                          <span className="sr-only">{link.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              </ul>
            </div>
          </div>

          {/* Diviseur + copyright */}
          <div className="border-t border-primary-green/10 mt-16 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <p className="font-sans">
              © {currentYear} {brandName}. Tous les contenus appartiennent à leurs auteurs. Usage personnel et non commercial.
            </p>
            <div className="flex gap-4 font-sans">
              <Link href="/confidentialite" className="hover:text-accent-yellow transition-colors cursor-pointer">
                Politique de confidentialité
              </Link>
              <span>·</span>
              <Link href="/conditions" className="hover:text-accent-yellow transition-colors cursor-pointer">
                Conditions d&apos;utilisation
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
};
