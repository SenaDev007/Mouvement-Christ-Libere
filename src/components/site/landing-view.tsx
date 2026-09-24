"use client";

/**
 * ⭐ V3.97 — LANDING PAGE AU DESIGN WIN AGRO (palette Christ Libère).
 *
 * Portage intégral du design de Win Agro (Hero premium, stats compteurs,
 * cartes services avec premium, 5 cartes différenciation, carrousel
 * témoignages marquee) — avec la PALETTE DE COULEURS CHRIST LIBÈRE
 * conservée (violet impérial #2A0E3D · or sacré #C9A227 · ivoire
 * #FAF6EF), via les tokens primary-deep / primary-green / accent-yellow
 * définis dans globals.css.
 *
 * Le hero reste PARAMÉTRABLE depuis /admin/heroes (kicker, title,
 * titleAccent, subtitle, backgroundImage, CTA) comme avant.
 */

import { apiFetch } from "@/lib/api-client";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { HeroBackgroundImage } from "@/components/site/page-hero";
import { IsololeText } from "@/lib/isolole";
import type { HeroConfig } from "@/lib/hero-defaults";
import { UpcomingLiveFloat } from "@/components/live/upcoming-live-float";
import { LandingIntro } from "@/components/site/landing-intro";
import { SoumissionTemoignage } from "@/components/site/soumission-temoignage";
import {
  Sparkles, BookOpen, FileText, Video, Users, ArrowRight,
  Music, Globe2, ScrollText, Heart, Infinity as InfinityIcon,
} from "lucide-react";

/* ============================================================
   STATS — 4 compteurs animés (design Stats de Win Agro)
   ============================================================ */

interface StatItemProps {
  value: number;
  suffix: string;
  label: string;
  subText: string;
}

function StatItem({ value, suffix, label, subText }: StatItemProps) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          if (value <= 0) return;
          let start = 0;
          const duration = 2000;
          const stepTime = Math.abs(Math.floor(duration / value));
          const timer = setInterval(() => {
            start += Math.ceil(value / 50);
            if (start >= value) {
              clearInterval(timer);
              setCount(value);
            } else {
              setCount(start);
            }
          }, Math.max(stepTime, 20));
        }
      },
      { threshold: 0.1 }
    );
    if (elementRef.current) observer.observe(elementRef.current);
    return () => {
      if (elementRef.current) observer.unobserve(elementRef.current);
    };
  }, [value, hasAnimated]);

  return (
    <motion.div
      ref={elementRef}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="relative p-8 rounded-3xl bg-white border border-primary-pale shadow-lg hover:shadow-xl hover:border-primary-green/30 transition-all duration-300 flex flex-col justify-between h-full group card-shimmer"
    >
      <div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="font-serif text-5xl sm:text-6xl font-black text-primary-deep tracking-tight group-hover:text-accent-dark transition-colors duration-300">
            {count}
          </span>
          <span className="font-sans text-3xl font-black text-accent-dark">
            {suffix}
          </span>
        </div>
        <div className="w-12 h-1 bg-accent-yellow rounded-full mb-4 group-hover:w-20 transition-all duration-300" />
        <h3 className="font-sans font-bold text-lg text-primary-deep tracking-wide mb-2">
          {label}
        </h3>
      </div>
      <p className="font-sans text-sm text-gray-text leading-relaxed">
        {subText}
      </p>
    </motion.div>
  );
}

/* ============================================================
   RESSOURCES — cartes façon Services de Win Agro
   ============================================================ */

const RESSOURCES = [
  {
    key: "temoignages",
    title: "Témoignages",
    hook: "Des récits qui édifient la foi et annoncent les temps.",
    problem:
      "Visites au ciel, sonneries du chofar, retours de Yeshoua, délivrances : des vies transformées, racontées avec sobriété et conformité à la Parole.",
    bullets: [
      "Récits classés par serviteur et par thème",
      "Témoignages visites au ciel et révélations reçues",
      "Chaque récit relié aux Écritures qui l'éclairent",
    ],
    availability: "Publiés après accompagnement pastoral — relus par le ministère",
    cta: "Lire les témoignages →",
    href: "/temoignages",
    icon: FileText,
    isPremium: false,
  },
  {
    key: "enseignements",
    title: "Enseignements & Prédications",
    hook: "La Parole enseignée sans compromis, pour marcher avec Yeshoua.",
    problem:
      "Doctrine, fêtes de l'Éternel, Shabbat, combat spirituel, marche avec le Saint-Esprit : un socle complet pour grandir, du premier pas au service.",
    bullets: [
      "Enseignements classés par thème, livre et niveau",
      "Prédications du Pasteur Kongo et partages d'Afrika",
      "Études sur les fêtes bibliques et le calendrier de l'Éternel",
      "Bible du Royaume avec concordance de Strong en appui",
    ],
    availability: "Textes, audios et vidéos — conservés intégralement",
    cta: "Approfondir la Parole →",
    href: "/enseignements",
    icon: BookOpen,
    isPremium: true,
  },
  {
    key: "videos",
    title: "Vidéos & Lives",
    hook: "La vie du Mouvement en image, dans sa version complète.",
    problem:
      "Lives, enseignements vidéo, adoration et louanges d'Afrika : chaque diffusion est conservée sans coupure, en replay libre d'accès.",
    bullets: [
      "Lives du Mouvement en direct et en replay",
      "Enseignements vidéo d'Afrika et du Pasteur Kongo",
      "Chants et adorations jouables sur la plateforme",
    ],
    availability: "Replays disponibles à toute heure, sur mobile comme sur ordinateur",
    cta: "Regarder maintenant →",
    href: "/videos",
    icon: Video,
    isPremium: false,
  },
];

/* ============================================================
   POURQUOI LE MOUVEMENT — 5 cartes façon WhyUs de Win Agro
   ============================================================ */

const DIFFERENTIATIONS = [
  {
    num: "01",
    tag: "LE RÉVEIL & LA TROMPETTE",
    title: "Au son du chofar",
    description:
      "Le chofar retentit pour réveiller les cœurs et annoncer le retour de Yeshoua. Tout le Mouvement vit tourné vers cette espérance.",
    icon: Music,
  },
  {
    num: "02",
    tag: "PROPHÉTIE & RASSEMBLEMENT",
    title: "Les dispersés d'Israël",
    description:
      "« Rassemblez mes dispersés » : une carte mondiale relie les fils et filles de la diaspora qui se joignent au Mouvement, où qu'ils soient.",
    icon: Globe2,
  },
  {
    num: "03",
    tag: "LA PAROLE SANS FILTRE",
    title: "Bible du Royaume",
    description:
      "6 versions, concordance de Strong, hébreu originel et Peshitta : étudier les Écritures en profondeur, sans intermédiaire.",
    icon: ScrollText,
  },
  {
    num: "04",
    tag: "COMMUNAUTÉ VIVANTE",
    title: "Un corps, un seul Esprit",
    description:
      "Yeshua Connect, chaîne d'intercession, rendez-vous pastoraux : une vraie vie d'église, en ligne et dans le monde réel.",
    icon: Users,
  },
  {
    num: "05",
    tag: "INTÉGRITÉ DES CONTENUS",
    title: "Intégralité conservée",
    description:
      "Enseignements, vies et lives publiés sans coupure ni dénaturation : ce qui est donné est gardé, intégralement.",
    icon: InfinityIcon,
  },
];

/* ============================================================
   TÉMOIGNAGES DES CROYANTS — carrousel marquee façon Win Agro
   ⭐ V3.100 — Distinction demandée par le pasteur : cette section
   « Vies transformées » n'affiche QUE les témoignages des CROYANTS
   (soumis puis validés par un super admin) — les témoignages des
   serviteurs (Afrika & Pasteur Kongo) restent sur /temoignages.
   ============================================================ */

interface CarteTemoignage {
  text: string;
  name: string;
  role: string;
  href?: string;
}

/** Libellés des catégories (mêmes clés que l'API). */
const LABEL_CATEGORIE: Record<string, string> = {
  vie_transformee: "Vie transformée",
  guerison: "Guérison",
  delivrance: "Délivrance",
  restauration: "Foyer restauré",
  providence: "Providence",
  appel: "Appel & consécration",
  action_graces: "Action de grâces",
};

/** Tronque proprement un récit pour les cartes du marquee. */
function tronquer(texte: string, max = 165): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(" ");
  return (dernierEspace > 100 ? coupe.slice(0, dernierEspace) : coupe) + " […]";
}

/* Fallback d'INVITATION (aucun témoignage validé pour l'instant) :
   des cartes génériques qui parlent de ce que Dieu fait — et qui
   renvoient vers /vie-transformee. AUCUN témoignage des serviteurs
   ici (distinction demandée par le pasteur). */
const CARTES_FALLBACK: CarteTemoignage[] = [
  {
    text: "Votre vie a été transformée par Yeshoua ? Partagez ce que Dieu a fait — votre récit peut relever la foi d'un frère ou d'une sœur.",
    name: "Partagez le vôtre",
    role: "Témoignage des croyants",
    href: "/vie-transformee",
  },
  {
    text: "Des vies délivrées, des corps guéris, des foyers restaurés — les œuvres de Dieu au milieu de son peuple, racontées par ceux qui les ont vécues.",
    name: "Guérisons & délivrances",
    role: "Œuvres de Dieu",
    href: "/vie-transformee",
  },
  {
    text: "La providence de Dieu pourvoit aux besoins de ses enfants au quotidien — venez lire comment il a pourvu, et rendez grâce avec nous.",
    name: "La providence",
    role: "Fidélité de Dieu",
    href: "/vie-transformee",
  },
  {
    text: "Le rassemblement des dispersés d'Israël : d'Afrique à la diaspora, des témoins se lèvent et racontent ce que le Seigneur fait dans leur vie.",
    name: "Les dispersés",
    role: "Rassemblement",
    href: "/vie-transformee",
  },
  {
    text: "Marcher avec le Saint-Esprit au quotidien — des récits simples et vrais de la fidélité de Dieu, du matin au soir.",
    name: "Marcher avec Dieu",
    role: "Vie quotidienne",
    href: "/vie-transformee",
  },
  {
    text: "Des appels entendus, des vies consacrées : chacun raconte sa rencontre avec Yeshoua et ce qui a changé depuis.",
    name: "Rencontres",
    role: "Appel & consécration",
    href: "/vie-transformee",
  },
];

function RangeeTemoignages({
  cartes,
  direction,
}: {
  cartes: CarteTemoignage[];
  direction: "left" | "right";
}) {
  const boucle = [...cartes, ...cartes, ...cartes];
  return (
    <div className="overflow-hidden w-full">
      <div
        className={`flex gap-6 w-max ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"} hover:[animation-play-state:paused]`}
      >
        {boucle.map((t, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(201, 162, 39, 0.4)" }}
            className="bg-white border border-primary-pale/60 shadow-md rounded-3xl p-6 flex flex-col justify-between flex-shrink-0 w-[340px] h-[220px] transition-colors duration-200 cursor-default card-shimmer relative"
          >
            <div className="flex-1 flex flex-col justify-start">
              <p className="text-[13.5px] leading-relaxed text-gray-text font-sans break-words whitespace-normal overflow-hidden italic">
                {t.text}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-primary-pale/40">
              <div className="h-11 w-11 rounded-full bg-primary-pale flex items-center justify-center border border-primary-green/20 text-primary-deep font-serif font-black text-sm select-none shadow-sm shrink-0">
                {t.name ? t.name.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="flex flex-col">
                <div className="font-serif font-bold text-primary-deep text-sm leading-tight">{t.name}</div>
                <div className="text-primary-green/80 font-sans font-semibold text-xs mt-0.5">{t.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   LANDING VIEW — assemblage design Win Agro
   ============================================================ */

export function LandingView({ hero }: { hero: HeroConfig }) {
  const [statsData, setStatsData] = useState<Record<string, number> | null>(null);
  const [temoignages, setTemoignages] = useState<CarteTemoignage[]>(CARTES_FALLBACK);
  const d = hero.data;

  useEffect(() => {
    apiFetch("/api/stats")
      .then(r => r.json())
      .then(data => setStatsData({ ...data, responseTime: 24 }))
      .catch(() => setStatsData({ testimonies: 0, videos: 0, biographies: 0, responseTime: 24 }));
  }, []);

  // ⭐ V3.100 — Les cartes de la section « Vies transformées » sont
  // alimentées UNIQUEMENT par les témoignages des CROYANTS validés
  // (statut « publie » — validés par un super admin depuis
  // /admin/vie-transformee). Plus aucun témoignage de serviteur ici.
  useEffect(() => {
    fetch("/api/temoignages-croyants?limit=12")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && Array.isArray(data.temoignages) && data.temoignages.length > 0) {
          setTemoignages(
            data.temoignages.map((t: {
              nom: string;
              categorie: string;
              contenu: string;
              ville?: string | null;
              pays?: string | null;
            }) => ({
              text: tronquer(t.contenu),
              name: t.nom,
              role: [
                LABEL_CATEGORIE[t.categorie] || "Vie transformée",
                t.ville || t.pays,
              ].filter(Boolean).join(" · "),
              href: "/vie-transformee",
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const stats: StatItemProps[] = [
    {
      value: statsData?.testimonies ?? 31,
      suffix: "",
      label: "Témoignages authentiques",
      subText: "Récits publiés après accompagnement pastoral, reliés aux Écritures.",
    },
    {
      value: statsData?.videos ?? 544,
      suffix: "",
      label: "Vidéos publiées",
      subText: "Enseignements, vies et adorations conservés intégralement.",
    },
    {
      value: statsData?.biographies ?? 2,
      suffix: "",
      label: "Serviteurs de Dieu",
      subText: "Deux ministères distincts, unis par un même appel de Dieu.",
    },
    {
      value: statsData?.responseTime ?? 24,
      suffix: "h",
      label: "Délai de réponse",
      subText: "Le secrétariat traite chaque demande de rendez-vous et de prière.",
    },
  ];

  const isLargeSet = temoignages.length >= 6;
  const firstRow = isLargeSet ? temoignages.filter((_, index) => index % 2 === 0) : temoignages;
  const secondRow = isLargeSet ? temoignages.filter((_, index) => index % 2 !== 0) : [];

  const scrollTo = (href: string) => {
    const targetElement = document.querySelector(href);
    if (targetElement) {
      const offset = 80;
      const elementPosition = targetElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* ⭐ Intro de chargement du Mouvement (5 s, son du shofar) — conservée */}
      <LandingIntro />

      {/* ══════════════════════════════════════════════════════════
          HERO — design Win Agro : badge ping, titre staggered,
          soulignement animé, CTA shimmer pulsant, mesh + halos
          ══════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-primary-deep text-white">
        <UpcomingLiveFloat />

        {/* 1. Fond : image paramétrable + mesh gradient + halos flottants */}
        <div className="absolute inset-0 z-0">
          <HeroBackgroundImage
            src={hero.backgroundImage}
            alt="Afrika et Pasteur Kongo, au son du chofar"
            className="object-cover object-center scale-102 opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-deep/90 via-primary-deep/80 to-noir-vert/90 mix-blend-multiply" />
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-green/20 rounded-full blur-[100px] animate-float" />
          <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-accent-yellow/5 rounded-full blur-[150px] animate-float" style={{ animationDelay: "2s" }} />

          {/* Grain SVG + trame de points */}
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none mix-blend-overlay">
            <filter id="noiseFilter">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noiseFilter)" />
          </svg>
          <div className="absolute inset-0 bg-grain opacity-[0.08] mix-blend-overlay" />
        </div>

        {/* 2. Contenu centré */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center">

            {/* Badge animé (kicker paramétrable + ping doré) */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-green/30 border border-primary-green/50 text-accent-yellow font-sans font-bold text-xs uppercase tracking-wider mb-8 animate-pulse-slow"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-yellow opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-yellow"></span>
              </span>
              <Sparkles className="w-4 h-4 text-accent-yellow shrink-0" />
              <IsololeText>{hero.kicker}</IsololeText>
            </motion.div>

            {/* Titre principal staggered (paramétrable) */}
            <h1 className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6">
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
                className="block"
              >
                <IsololeText>{hero.title}</IsololeText>
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
                className="block mt-2"
              >
                <span className="relative inline-block text-accent-yellow font-black">
                  <IsololeText>{hero.titleAccent}</IsololeText>
                  <motion.span
                    animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
                    transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                    className="absolute bottom-1 left-0 w-full h-[4px] bg-accent-yellow rounded-full"
                  />
                </span>
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.45, ease: "easeOut" }}
                className="block mt-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif"
              >
                au service du rassemblement des{" "}
                <span className="relative inline-block text-accent-yellow font-black">
                  dispersés
                  <motion.span
                    animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
                    transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                    className="absolute bottom-1 left-0 w-full h-[4px] bg-accent-yellow rounded-full"
                  />
                </span>{" "}
                d&apos;<IsololeText>Israël</IsololeText>
              </motion.span>
            </h1>

            {/* Sous-titre (paramétrable) */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              className="text-base sm:text-lg md:text-xl text-gray-200 font-sans leading-relaxed max-w-2xl mb-10"
            >
              <IsololeText>{hero.subtitle}</IsololeText>
            </motion.p>

            {/* CTA shimmer pulsant + liens secondaires */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.75, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto"
            >
              <motion.button
                onClick={() => (hero.ctaHref ? (window.location.href = hero.ctaHref) : scrollTo("#ressources"))}
                whileHover={{ scale: 1.05, boxShadow: "0px 10px 25px rgba(201, 162, 39, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ scale: { repeat: Infinity, duration: 2.5, ease: "easeInOut" } }}
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-primary-green hover:bg-primary-green/90 text-[#1E0F2B] font-sans font-bold text-base shadow-xl border border-primary-green flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary-green/50 btn-shimmer"
              >
                {hero.ctaLabel || "Découvrir le Mouvement"}
                <ArrowRight className="w-5 h-5 shrink-0" />
              </motion.button>

              <div className="flex items-center gap-2 text-sm text-gray-300 font-sans font-medium">
                <button
                  onClick={() => scrollTo("#ressources")}
                  className="hover:text-accent-yellow underline transition-colors cursor-pointer"
                >
                  Explorer les ressources
                </button>
                <span>·</span>
                <Link href="/rendez-vous" className="hover:text-accent-yellow underline transition-colors">
                  Demander un rendez-vous
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Diviseur de section incliné (ivoire) */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-cream" style={{ clipPath: "polygon(0 100%, 100% 100%, 100% 0)" }} />
      </section>

      {/* ══════════════════════════════════════════════════════════
          STATS — 4 compteurs animés (design Stats de Win Agro)
          ══════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-cream relative overflow-hidden">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-80 h-80 bg-primary-pale/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-96 h-96 bg-accent-pale/40 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <StatItem
                key={idx}
                value={stat.value}
                suffix={stat.suffix}
                label={stat.label}
                subText={stat.subText}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          DEUX SERVITEURS — ⭐ V3.99 : retour à la disposition d'origine
          demandée par le pasteur (les deux serviteurs CÔTE À CÔTE,
          séparés par le cœur doré central comme avant V3.97), le tout
          au style Win Agro : badge ping, titre serif, card-shimmer.
          Textes paramétrables dans /admin/heroes.
          ══════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-72 h-72 bg-primary-pale rounded-full blur-3xl opacity-40 -z-10" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent-pale/40 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* En-tête — badge ping + titre serif + soulignement animé */}
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-pale text-primary-deep text-xs font-sans font-bold uppercase tracking-wider mb-3"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-yellow opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-yellow" />
              </span>
              <IsololeText>{d.servantsKicker}</IsololeText>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-primary-deep leading-tight"
            >
              <IsololeText>{d.servantsTitle}</IsololeText>
            </motion.h2>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-24 bg-accent-yellow rounded-full mx-auto mt-4"
            />
          </div>

          {/* Grille d'origine : carte Afrika · cœur doré · carte Pasteur Kongo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 items-stretch">

            {/* 1. Carte Afrika — tuile Win Agro */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Link
                href="/afrika"
                className="group relative h-full flex flex-col bg-cream rounded-2xl shadow-md hover:shadow-xl border border-primary-green/20 border-t-4 border-t-accent-yellow p-8 transition-all duration-500 card-shimmer overflow-hidden"
              >
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full overflow-hidden bg-primary-deep mb-6 ring-2 ring-accent-yellow/30 group-hover:ring-accent-yellow transition-all">
                  <HeroBackgroundImage
                    src={d.pamPhoto}
                    alt={d.pamName}
                    priority={false}
                    className="object-cover w-full h-full"
                  />
                </div>
                <h3 className="font-serif text-2xl font-extrabold text-primary-deep mb-3">
                  <IsololeText>{d.pamName}</IsololeText>
                </h3>
                <p className="text-xs uppercase tracking-wider text-accent-dark font-bold mb-3">
                  <IsololeText>{d.pamRole}</IsololeText>
                </p>
                <p className="text-sm text-gray-text leading-relaxed mb-6 flex-1">
                  <IsololeText>{d.pamDesc}</IsololeText>
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-dark group-hover:gap-3 transition-all duration-300">
                  Lire la biographie
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </motion.div>

            {/* 2. Centre : le cœur doré qui unit les deux serviteurs */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col items-center justify-center self-center p-6"
            >
              <div className="w-px h-12 bg-accent-yellow/30 mb-4 hidden lg:block" />
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent-yellow/10 mb-4 animate-pulse-slow">
                <Heart className="w-8 h-8 text-accent-yellow" fill="currentColor" />
              </div>
              <p className="font-serif text-lg italic text-gray-text text-center max-w-xs leading-relaxed">
                « Deux appels qui se rejoignent, deux ministères distincts qui s&apos;articulent
                sans se confondre. »
              </p>
              <div className="w-px h-12 bg-accent-yellow/30 mt-4 hidden lg:block" />
            </motion.div>

            {/* 3. Carte Pasteur Kongo — tuile Win Agro */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Link
                href="/pasteur-kongo"
                className="group relative h-full flex flex-col bg-cream rounded-2xl shadow-md hover:shadow-xl border border-primary-green/20 border-t-4 border-t-accent-yellow p-8 transition-all duration-500 card-shimmer overflow-hidden"
              >
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full overflow-hidden bg-primary-deep mb-6 ring-2 ring-accent-yellow/30 group-hover:ring-accent-yellow transition-all">
                  <HeroBackgroundImage
                    src={d.kongoPhoto}
                    alt={d.kongoName}
                    priority={false}
                    className="object-cover w-full h-full"
                  />
                </div>
                <h3 className="font-serif text-2xl font-extrabold text-primary-deep mb-3">
                  <IsololeText>{d.kongoName}</IsololeText>
                </h3>
                <p className="text-xs uppercase tracking-wider text-accent-dark font-bold mb-3">
                  <IsololeText>{d.kongoRole}</IsololeText>
                </p>
                <p className="text-sm text-gray-text leading-relaxed mb-6 flex-1">
                  <IsololeText>{d.kongoDesc}</IsololeText>
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-dark group-hover:gap-3 transition-all duration-300">
                  Lire la biographie
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          RESSOURCES — design Services de Win Agro (1 carte premium)
          ══════════════════════════════════════════════════════════ */}
      <section id="ressources" className="py-24 bg-cream relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-pale/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-20 left-0 w-[300px] h-[300px] bg-accent-pale/30 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-block px-3 py-1 rounded-full bg-primary-pale text-primary-deep text-xs font-sans font-bold uppercase tracking-wider mb-3"
            >
              Les ressources du Mouvement
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-primary-deep leading-tight"
            >
              Pour grandir dans la foi
            </motion.h2>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 bg-accent-yellow mx-auto mt-6 rounded-full"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {RESSOURCES.map((r, index) => {
              const Icone = r.icon;
              if (r.isPremium) {
                return (
                  <motion.div
                    key={r.key}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                    whileHover={{
                      y: -10,
                      scale: 1.03,
                      borderColor: "rgba(201, 162, 39, 0.4)",
                      boxShadow: "0 20px 25px -5px rgba(201, 162, 39, 0.15), 0 8px 10px -6px rgba(201, 162, 39, 0.15)",
                    }}
                    className="relative rounded-3xl bg-primary-deep text-white border-2 border-accent-yellow shadow-2xl p-8 flex flex-col justify-between transition-all duration-300 card-shimmer"
                  >
                    {/* ⭐ V3.100 — Badge « Cœur du Mouvement » : AVANT en
                        absolute -top-4 il était ROGNÉ par l'overflow hidden
                        de card-shimmer (retour pasteur : « je ne vois pas
                        tout le texte, il y a mouvement sur ça »). Il vit
                        désormais DANS la carte, en haut du contenu —
                        entièrement lisible, statique. */}
                    <div className="inline-flex items-center gap-1.5 self-start px-4 py-1.5 rounded-full bg-accent-yellow text-primary-deep font-sans font-black text-xs uppercase tracking-wider shadow-md mb-5">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" /> Cœur du Mouvement
                    </div>
                    <div>
                      <div className="mb-6">
                        <h3 className="font-serif text-2xl font-black text-white">{r.title}</h3>
                        <p className="font-sans font-bold text-accent-yellow text-sm mt-3 leading-relaxed italic">«&nbsp;{r.hook}&nbsp;»</p>
                      </div>
                      <div className="w-full h-px bg-white/10 my-4" />
                      <p className="font-sans text-sm text-gray-200 leading-relaxed mb-6">{r.problem}</p>
                      <h4 className="font-sans font-bold text-sm text-accent-yellow uppercase tracking-wider mb-3">
                        Ce que vous trouvez :
                      </h4>
                      <ul className="space-y-3 mb-8">
                        {r.bullets.map((b, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-200 font-sans">
                            <span className="text-accent-yellow mt-0.5">✓</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-auto">
                      <p className="text-xs text-primary-pale font-sans font-medium mb-4 py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-center">
                        {r.availability}
                      </p>
                      <motion.button
                        onClick={() => (window.location.href = r.href)}
                        whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(201, 162, 39, 0.3)" }}
                        whileTap={{ scale: 0.98 }}
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ scale: { repeat: Infinity, duration: 2.0, ease: "easeInOut" } }}
                        className="w-full py-4 rounded-full bg-accent-yellow hover:bg-white text-primary-deep font-sans font-black text-base shadow-xl cursor-pointer btn-shimmer"
                      >
                        {r.cta}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              }
              return (
                <motion.div
                  key={r.key}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                  whileHover={{
                    y: -10,
                    scale: 1.03,
                    borderColor: "rgba(201, 162, 39, 0.4)",
                    boxShadow: "0 20px 25px -5px rgba(42, 14, 61, 0.1), 0 8px 10px -6px rgba(42, 14, 61, 0.1)",
                  }}
                  className="rounded-3xl bg-white border border-primary-pale shadow-lg p-8 flex flex-col justify-between transition-all duration-300 card-shimmer"
                >
                  <div>
                    <div className="mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-primary-pale flex items-center justify-center mb-4 border border-primary-green/20">
                        <Icone className="w-6 h-6 text-accent-dark" />
                      </div>
                      <h3 className="font-serif text-2xl font-bold text-primary-deep">{r.title}</h3>
                      <p className="font-sans font-semibold text-accent-dark text-sm mt-3 leading-relaxed italic">«&nbsp;{r.hook}&nbsp;»</p>
                    </div>
                    <div className="w-full h-px bg-primary-pale my-4" />
                    <p className="font-sans text-sm text-gray-text leading-relaxed mb-6">{r.problem}</p>
                    <h4 className="font-sans font-bold text-sm text-primary-deep uppercase tracking-wider mb-3">
                      Le programme comprend :
                    </h4>
                    <ul className="space-y-3 mb-8">
                      {r.bullets.map((b, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-text font-sans">
                          <span className="text-accent-dark mt-0.5">✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-auto">
                    <p className="text-xs text-accent-dark font-sans font-medium mb-4 py-2 px-3 rounded-lg bg-primary-pale border border-primary-pale/50 text-center">
                      {r.availability}
                    </p>
                    <motion.button
                      onClick={() => (window.location.href = r.href)}
                      whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(201, 162, 39, 0.3)" }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 rounded-full bg-primary-green hover:bg-accent-dark text-[#1E0F2B] font-sans font-bold text-base shadow-md cursor-pointer btn-shimmer"
                    >
                      {r.cta}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          POURQUOI LE MOUVEMENT — 5 cartes façon WhyUs de Win Agro
          ══════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute bottom-10 right-0 w-72 h-72 bg-primary-pale rounded-full blur-3xl opacity-50 -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-primary-pale text-primary-deep text-xs font-sans font-bold uppercase tracking-wider mb-4">
              Pourquoi le Mouvement Christ Libère
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary-deep leading-snug"
            >
              «&nbsp;Beaucoup prêchent un évangile de confort.{" "}
              <span className="relative inline-block text-accent-dark">
                Nous annonçons celui du réveil.
                <motion.span
                  animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
                  transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                  className="absolute bottom-0 left-0 w-full h-[4px] bg-accent-yellow rounded-full"
                />
              </span>{" "}
              Ce n&apos;est pas le même message.&nbsp;»
            </motion.h2>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 bg-accent-yellow mx-auto mt-6 rounded-full"
            />
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
            className="flex flex-wrap justify-center gap-8 w-full mt-6"
          >
            {DIFFERENTIATIONS.map((item) => {
              const Icone = item.icon;
              return (
                <motion.div
                  key={item.num}
                  variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } }}
                  whileHover={{
                    y: -6,
                    scale: 1.02,
                    borderColor: "rgba(201, 162, 39, 0.3)",
                    boxShadow: "0 20px 25px -5px rgba(42, 14, 61, 0.08), 0 8px 10px -6px rgba(42, 14, 61, 0.08)",
                  }}
                  className="max-w-72 w-full bg-cream/40 border border-primary-green/10 rounded-2xl p-4 shadow-sm transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden relative shadow-sm border border-primary-green/5 bg-gradient-to-br from-primary-deep via-primary-deep to-noir-vert flex items-center justify-center">
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-sans font-black text-accent-dark shadow-sm z-10">
                        {item.num}
                      </div>
                      <Icone className="w-14 h-14 text-accent-yellow drop-shadow-lg animate-float" />
                      <div className="absolute inset-0 bg-grain opacity-[0.08] mix-blend-overlay" />
                    </div>
                    <p className="text-[9px] font-sans font-black uppercase tracking-wider text-accent-dark mt-4">
                      {item.tag}
                    </p>
                    <h3 className="text-base font-serif font-bold text-primary-deep mt-2 leading-tight text-left">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-text font-sans mt-2.5 leading-relaxed text-left">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TÉMOIGNAGES — carrousel marquee double rangée (Win Agro)
          ══════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-cream relative overflow-hidden">
        <div className="absolute inset-0 bg-grain opacity-[0.03] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-primary-pale text-primary-deep text-xs font-sans font-bold uppercase tracking-wider mb-4 border border-primary-green/10">
              Vies transformées
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-primary-deep leading-tight"
            >
              Ils ont rencontré Yeshoua.
            </motion.h2>
            <p className="text-accent-dark font-serif text-lg sm:text-xl font-bold mt-2">
              Voilà ce que Dieu fait au milieu de son peuple.
            </p>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 bg-accent-yellow mx-auto mt-6 rounded-full"
            />
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {/* ⭐ V3.100 — Distinction : la section « Vies transformées »
                  renvoie vers la page des CROYANTS (plus /temoignages,
                  réservé aux récits d'Afrika & du Pasteur Kongo). */}
              <Link
                href="/vie-transformee"
                className="px-6 py-3 rounded-full bg-primary-green text-[#1E0F2B] font-bold text-xs hover:bg-primary-green/90 transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5 inline-flex items-center gap-2"
              >
                ⭐ Lire tous les témoignages
              </Link>
              <SoumissionTemoignage variante="or" libelle="Partager votre témoignage" />
            </div>
          </div>
        </div>

        <div className="space-y-6 w-full relative z-10 select-none">
          <RangeeTemoignages cartes={firstRow} direction="left" />
          {isLargeSet && (
            <RangeeTemoignages cartes={secondRow} direction="right" />
          )}
        </div>
      </section>
    </div>
  );
}
