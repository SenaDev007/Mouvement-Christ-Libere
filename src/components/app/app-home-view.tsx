"use client";

/**
 * ⭐ V4.09 — PAGE PRINCIPALE DE L'APPLICATION MOBILE « CHRIST LIBÈRE ».
 *
 * Même philosophie que la landing page du site public (V3.97) :
 *  - HERO PARAMÉTRABLE depuis le back-office (/admin/heroes → « landing ») :
 *    kicker, titre, sous-titre, image de fond et CTA pilotés par le pasteur ;
 *  - les PHOTOS DES SERVITEURS viennent de /admin/servants (photosServiteurs) ;
 *  - la BARRE DU PROCHAIN LIVE (UpcomingLiveFloat) est incluse dans le hero.
 *
 * Sous le hero : la grille de BOUTONS vers toutes les sections de
 * l'application (demande explicite du pasteur — « comme on a fait la
 * landing page pour le site public avec les boutons »), le canal de
 * communication Yeshua Connect mis en avant, puis les deux serviteurs.
 */

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { HeroBackgroundImage } from "@/components/site/page-hero";
import { UpcomingLiveFloat } from "@/components/live/upcoming-live-float";
import { IsololeText } from "@/lib/isolole";
import type { HeroConfig } from "@/lib/hero-defaults";
import {
  FileText,
  BookOpen,
  PlayCircle,
  Music,
  Heart,
  Globe2,
  MessageSquare,
  HandCoins,
  Megaphone,
  CalendarCheck,
} from "lucide-react";

/* ============================================================
   LES SECTIONS DE L'APPLICATION — boutons de la page principale
   ============================================================ */

interface SectionButton {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isolole?: boolean;
}

const SECTIONS: SectionButton[] = [
  {
    href: "/app/temoignages",
    label: "Témoignages",
    description: "Récits et victoires",
    icon: FileText,
  },
  {
    href: "/app/enseignements",
    label: "Enseignements",
    description: "La Parole expliquée",
    icon: BookOpen,
  },
  {
    href: "/app/videos",
    label: "Vidéos & Lives",
    description: "Regarder et écouter",
    icon: PlayCircle,
  },
  {
    href: "/app/adoration-louanges",
    label: "Adoration & Louanges",
    description: "Chants et louanges",
    icon: Music,
  },
  {
    href: "/app/intercession",
    label: "Intercession",
    description: "Demandes de prière",
    icon: Heart,
  },
  {
    href: "/app/disperses",
    label: "Dispersés d'Israël",
    description: "La carte mondiale",
    icon: Globe2,
    isolole: true,
  },
  {
    href: "/app/contribuer",
    label: "Contribuer",
    description: "Don & dîme",
    icon: HandCoins,
  },
  {
    href: "/app/annonces",
    label: "Annonces",
    description: "Vie du ministère",
    icon: Megaphone,
  },
];

export function AppHomeView({ hero }: { hero: HeroConfig }) {
  const d = hero.data as Record<string, string>;

  /* Défilement doux vers la grille de sections (ancre), avec l'offset
     de l'en-tête fixe de l'application (4rem mobile / 5rem md). */
  const scrollToSections = () => {
    const target = document.getElementById("app-sections");
    if (!target) return;
    const offset = window.innerWidth >= 768 ? 88 : 72;
    const y =
      target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const heroCta = () => {
    if (hero.ctaHref) {
      window.location.href = hero.ctaHref;
    } else {
      scrollToSections();
    }
  };

  return (
    <div className="w-full">
      {/* ════════════════════════════════════════════════════════════
          HERO — paramétrable depuis le back-office (/admin/heroes)
          ════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[58vh] flex items-center overflow-hidden bg-primary-deep text-white">
        <UpcomingLiveFloat />

        {/* Fond : image paramétrable + dégradés + halos */}
        <div className="absolute inset-0 z-0">
          <HeroBackgroundImage
            src={hero.backgroundImage}
            alt="Mouvement Christ Libère — Afrika et Pasteur Kongo"
            className="object-cover object-center scale-102 opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-deep/95 via-primary-deep/85 to-[#1A0826]/95 mix-blend-multiply" />
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-primary-green/20 rounded-full blur-[100px] animate-float" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-yellow/5 rounded-full blur-[120px]" />
        </div>

        {/* Contenu */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-5 sm:px-8 py-14 sm:py-20 text-center flex flex-col items-center">
          {/* Badge kicker */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-green/30 border border-primary-green/50 text-accent-yellow font-sans font-bold text-[11px] uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent-yellow shrink-0" />
            <IsololeText>{hero.kicker}</IsololeText>
          </div>

          {/* Titre */}
          <h1 className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.15] mb-4">
            <span className="block">
              <IsololeText>{hero.title}</IsololeText>
            </span>
            <span className="block mt-2 text-accent-yellow font-black">
              <IsololeText>{hero.titleAccent}</IsololeText>
            </span>
            {hero.titleSuffix ? (
              <span className="block mt-2 text-2xl sm:text-3xl font-serif">
                <IsololeText>{hero.titleSuffix}</IsololeText>
              </span>
            ) : null}
          </h1>

          {/* Sous-titre */}
          <p className="text-sm sm:text-base md:text-lg text-gray-200 font-sans leading-relaxed max-w-xl mb-8">
            <IsololeText>{hero.subtitle}</IsololeText>
          </p>

          {/* CTA principal + lien rendez-vous */}
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <button
              type="button"
              onClick={heroCta}
              className="w-full px-8 py-3.5 rounded-full bg-primary-green hover:bg-primary-green/90 text-[#1E0F2B] font-sans font-bold text-base shadow-xl border border-primary-green flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary-green/50 active:scale-[0.98] transition-transform"
            >
              {hero.ctaLabel || "Découvrir le Mouvement"}
              <ArrowRight className="w-5 h-5 shrink-0" />
            </button>
            <Link
              href="/app/rendez-vous"
              className="text-sm text-gray-300 font-sans font-medium hover:text-accent-yellow underline transition-colors"
            >
              Demander un rendez-vous
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 pb-14">
        {/* ════════════════════════════════════════════════════════
            YESHUA CONNECT — le canal de communication (mis en avant)
            ════════════════════════════════════════════════════════ */}
        <section className="relative -mt-8 z-20 mb-8">
          <Link
            href="/app/yeshua-connect"
            className="group flex items-center gap-4 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#C9A227] to-[#A3821C] text-[#1E0F2B] shadow-2xl shadow-[#C9A227]/25 hover:shadow-[#C9A227]/40 active:scale-[0.99] transition-all"
          >
            <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#1E0F2B] text-[#DDBE55] shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-6 h-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-serif font-bold text-lg leading-tight">
                Yeshua Connect
              </span>
              <span className="block text-xs sm:text-sm text-[#1E0F2B]/75 font-medium">
                Le canal de communication du Mouvement — messages, canaux,
                appels audio &amp; vidéo
              </span>
            </span>
            <ArrowRight className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>

        {/* ════════════════════════════════════════════════════════
            LES DEUX SERVITEURS — photos pilotées par le back-office
            ════════════════════════════════════════════════════════ */}
        <section className="mb-8">
          <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1E0F2B] mb-4">
            Les serviteurs
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <ServantCard
              href="/app/afrika"
              name={d.pamName || "Afrika"}
              role={d.pamRole || "Servante de l'Éternel"}
              photo={d.pamPhoto}
            />
            <ServantCard
              href="/app/pasteur-kongo"
              name={d.kongoName || "Pasteur Kongo"}
              role={d.kongoRole || "Pasteur du Mouvement"}
              photo={d.kongoPhoto}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            LA GRILLE DE BOUTONS — toutes les sections de l'application
            ════════════════════════════════════════════════════════ */}
        <section id="app-sections" className="scroll-mt-24">
          <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1E0F2B] mb-4">
            Explorer le Mouvement
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {SECTIONS.map((s) => (
              <SectionCard key={s.href} section={s} />
            ))}
          </div>

          {/* Rendez-vous — CTA permanent en fin de grille */}
          <Link
            href="/app/rendez-vous"
            className="group mt-3 sm:mt-4 flex items-center gap-4 p-4 rounded-2xl bg-primary-deep text-white shadow-xl hover:shadow-2xl active:scale-[0.99] transition-all border border-[#C9A227]/30"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#C9A227] text-[#1E0F2B] shrink-0 group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-serif font-bold text-base leading-tight">
                Demander un rendez-vous
              </span>
              <span className="block text-xs text-white/60 font-medium">
                Rencontrer un serviteur de Dieu
              </span>
            </span>
            <ArrowRight className="w-5 h-5 text-[#C9A227] shrink-0 group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>

        {/* Pied de l'application */}
        <p className="mt-10 text-center text-xs text-[#8A8378]">
          Mouvement Christ Libère —{" "}
          <Link href="/" className="underline hover:text-[#A3821C] transition-colors">
            voir le site complet
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   CARTE SERVITEUR — photo (back-office) + nom + rôle
   ============================================================ */
function ServantCard({
  href,
  name,
  role,
  photo,
}: {
  href: string;
  name: string;
  role: string;
  photo?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative rounded-3xl overflow-hidden bg-primary-deep shadow-lg hover:shadow-2xl active:scale-[0.98] transition-all aspect-[3/4]"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2A0E3D] to-[#1A0826]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1A0826]/95 via-[#1A0826]/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <p className="font-serif font-bold text-white text-sm sm:text-base leading-tight">
          {name}
        </p>
        <p className="text-[10px] sm:text-xs text-[#DDBE55] font-medium mt-0.5">
          {role}
        </p>
      </div>
    </Link>
  );
}

/* ============================================================
   CARTE DE SECTION — gros bouton tactile (grille de la page
   principale) ; libellés « Israël » rendus via IsololeText
   ============================================================ */
function SectionCard({ section }: { section: SectionButton }) {
  const Icon = section.icon;
  return (
    <Link
      href={section.href}
      className="group flex flex-col items-center text-center gap-2.5 p-4 sm:p-5 rounded-2xl bg-white border border-[#8A8378]/15 shadow-sm hover:shadow-lg hover:border-[#C9A227]/40 active:scale-[0.97] transition-all"
    >
      <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#2A0E3D] to-[#3D1A54] text-[#DDBE55] shrink-0 group-hover:scale-105 group-hover:from-[#C9A227] group-hover:to-[#A3821C] group-hover:text-[#1E0F2B] transition-all">
        <Icon className="w-6 h-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm sm:text-[15px] font-bold text-[#1E0F2B] leading-tight">
          {section.isolole ? (
            <IsololeText>{section.label}</IsololeText>
          ) : (
            section.label
          )}
        </span>
        <span className="block text-[11px] text-[#8A8378] font-medium mt-0.5">
          {section.description}
        </span>
      </span>
    </Link>
  );
}
