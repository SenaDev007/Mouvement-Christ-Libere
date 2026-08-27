"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight, Sparkles, BookOpen, FileText, Video, Users,
  Calendar, MessageSquare, Heart, ArrowRight,
} from "lucide-react";

const VERSES = [
  "Et Hénoch marcha avec Dieu", "Genèse 5:24",
  "Le chofar va retentir", "1 Thessaloniciens 4:16",
  "Rassemblez mes dispersés", "Ésaïe 11:12",
  "Voici, je viens bientôt", "Apocalypse 3:11",
  "Préparez le chemin du Seigneur", "Ésaïe 40:3",
  "Au son du chofar", "Christ Libère",
];

const STATS = [
  { value: 31, suffix: "", label: "témoignages authentiques" },
  { value: 544, suffix: "", label: "vidéos publiées" },
  { value: 7, suffix: "", label: "jalons biographiques" },
  { value: 24, suffix: "h", label: "délai de réponse" },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Témoignages",
    description: "Récits d'expériences spirituelles authentiques — visites au ciel, paroles reçues, combats spirituels.",
    href: "/temoignages",
  },
  {
    icon: BookOpen,
    title: "Enseignements",
    description: "Études bibliques classées par thème, par livre et par niveau, pour approfondir à votre rythme.",
    href: "/enseignements",
  },
  {
    icon: Video,
    title: "Vidéos & Lives",
    description: "Enseignements vidéo et directs dans leur version originale et complète, conservés intégralement.",
    href: "/videos",
  },
  {
    icon: Users,
    title: "Communauté",
    description: "Canaux d'échange organisés par thème, modérés avec attention, pour grandir ensemble dans la foi.",
    href: "/communaute",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ═════ HERO ═════ */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-white">
        {/* Background image — Pam et Pasteur Kongo */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/pam-kongo-hero.webp"
            alt="Pam et Pasteur Kongo"
            fill
            priority
            sizes="100vw"
            className="opacity-60"
            style={{ objectFit: "cover", objectPosition: "center 30%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/50 via-[#2A0E3D]/60 to-[#1A0826]" />
        </div>

        {/* Particules célestes blanches (du haut vers le bas) + icônes chofar */}
        <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => {
            const isShofar = i % 6 === 0;
            const left = (i * 37) % 100; // Distribution régulière
            const size = 3 + (i % 4) * 2;
            const delay = (i * 0.3) % 4;
            const duration = 6 + (i % 5) * 2;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -30 }}
                animate={{
                  opacity: [0, 0.7, 0],
                  y: [-30, 800],
                }}
                transition={{
                  duration,
                  delay,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: 0,
                }}
              >
                {isShofar ? (
                  <span style={{ fontSize: `${size + 6}px`, filter: "drop-shadow(0 0 4px rgba(255,255,255,0.4))", opacity: 0.4 }}>📯</span>
                ) : (
                  <span style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.6)",
                    display: "block",
                    filter: "blur(0.5px)",
                    boxShadow: "0 0 4px rgba(255,255,255,0.3)",
                  }} />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <Sparkles className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#C9A227]">
              Un même appel, deux serviteurs
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6"
          >
            Afrika Alkebulane Pamela Dali
            <br />
            <span className="text-[#C9A227]">& Pasteur Kongo</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-10"
          >
            Témoignages, enseignements et vie de communauté, au service du
            rassemblement des fils d'Israël dispersés — en préparation au
            retour du Maître Yeshua, au son du chofar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/pam"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300"
            >
              Découvrir le témoignage de PAM
              <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="/pasteur-kongo"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300"
            >
              Découvrir le Pasteur Kongo
              <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Séparateur oblique ascendant (gauche→droite) entre hero et stats */}
      <div className="relative bg-[#1A0826]" style={{ height: "60px" }}>
        <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 1200 60" preserveAspectRatio="none">
          <polygon points="0,60 1200,0 1200,60" fill="#FAF6EF" />
        </svg>
      </div>

      {/* ═════ STATS ═════ */}
      <section className="py-20 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-serif font-extrabold text-4xl md:text-5xl text-[#C9A227] mb-2">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-[#8A8378] font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════ VERS DEUX SERVITEURS ═════ */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
              Deux serviteurs, un même appel
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#1E0F2B]">
              Découvrez leur parcours
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {/* Pam */}
            <Link
              href="/pam"
              className="group bg-[#FAF6EF] rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 hover:shadow-xl transition-all duration-500"
            >
              <div className="flex items-center justify-center w-20 h-20 rounded-full overflow-hidden bg-[#2A0E3D] mb-6 ring-2 ring-[#C9A227]/30 group-hover:ring-[#C9A227] transition-all">
                <Image
                  src="/pam.jpeg"
                  alt="Pam — Afrika Alkebulane Pamela Dali"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#1E0F2B] mb-3">
                Afrika Alkebulane Pamela Dali
              </h3>
              <p className="text-xs uppercase tracking-wide text-[#C9A227] font-semibold mb-3">
                Servante de l'Éternel
              </p>
              <p className="text-sm text-[#8A8378] leading-relaxed mb-6">
                Témoignages de visites au ciel, révélations prophétiques, enseignements
                sur la sanctification et le retour de Yeshua HaMashiach.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#C9A227] group-hover:gap-2 transition-all">
                Lire la biographie
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            {/* Center: Marriage */}
            <div className="flex flex-col items-center justify-center p-8">
              <div className="w-px h-16 bg-[#C9A227]/30 mb-6 hidden lg:block" />
              <div className="text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#C9A227]/10 mb-4">
                  <Heart className="w-8 h-8 text-[#C9A227]" />
                </div>
                <p className="font-serif text-lg italic text-[#8A8378] text-center max-w-xs">
                  « Deux appels qui se rejoignent, deux ministères distincts qui s'articulent
                  sans se confondre. »
                </p>
              </div>
              <div className="w-px h-16 bg-[#C9A227]/30 mt-6 hidden lg:block" />
            </div>

            {/* Pasteur Kongo */}
            <Link
              href="/pasteur-kongo"
              className="group bg-[#FAF6EF] rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 hover:shadow-xl transition-all duration-500"
            >
              <div className="flex items-center justify-center w-20 h-20 rounded-full overflow-hidden bg-[#2A0E3D] mb-6 ring-2 ring-[#C9A227]/30 group-hover:ring-[#C9A227] transition-all">
                <Image
                  src="/pasteur-kongo.jpeg"
                  alt="Pasteur Kongo"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#1E0F2B] mb-3">
                Pasteur Kongo
              </h3>
              <p className="text-xs uppercase tracking-wide text-[#C9A227] font-semibold mb-3">
                Ministère pastoral
              </p>
              <p className="text-sm text-[#8A8378] leading-relaxed mb-6">
                Enseignements pastoraux, soins des brebis, discernement spirituel
                et accompagnement de la communauté dans la foi.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#C9A227] group-hover:gap-2 transition-all">
                Lire la biographie
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═════ FEATURES (Ce que nous offrons) ═════ */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">
              Ce que cette plateforme rassemble
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E0F2B] leading-tight">
              Deux voix, une même vision
            </h2>
            <p className="text-base text-[#8A8378] mt-4 max-w-2xl mx-auto">
              PAM et le Pasteur Kongo exercent chacun un ministère distinct, uni par le mariage
              et par une même conviction : préparer les cœurs, transmettre ce qui a été reçu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                >
                  <Link
                    href={feature.href}
                    className="group block bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 h-full hover:shadow-xl transition-all duration-500"
                  >
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A227]/10 mb-6 group-hover:bg-[#C9A227]/20 transition-colors">
                      <Icon className="w-7 h-7 text-[#C9A227]" />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-[#1E0F2B] mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[#8A8378] leading-relaxed mb-4">
                      {feature.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#C9A227] group-hover:gap-2 transition-all">
                      Découvrir
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════ DERNIER ENSEIGNEMENT ═════ */}
      <section className="py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">
              Le dernier enseignement
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E0F2B] leading-tight">
              Pour approfondir la Parole
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 md:p-12 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#8C5FA8]/10 text-[#8C5FA8] border border-[#8C5FA8]/20">
                Doctrine
              </span>
              <span className="text-xs text-[#8A8378]">PAM</span>
            </div>
            <h3 className="font-serif text-2xl font-bold text-[#1E0F2B] mb-4">
              La Véritable Nature du Saint-Esprit et la Trinité
            </h3>
            <p className="text-sm md:text-base text-[#1E0F2B]/70 leading-relaxed mb-6">
              Au ciel, il n'y a pas trois trônes pour le Père, le Fils et le Saint-Esprit.
              Il n'y a qu'un seul Trône, et c'est la même personne qui s'y manifeste
              sous différentes formes. Le Saint-Esprit est une personne réelle, douce et sensible...
            </p>
            <Link
              href="/enseignements"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-[#C9A227] hover:bg-[#A3821C] text-[#1E0F2B] font-sans font-bold text-sm transition-all duration-300"
            >
              Voir tous les enseignements
              <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═════ VERS DEUX SERVITEURS (déplacé après STATS) ═════ */}
      {/* Section déplacée plus haut — voir après STATS */}

      {/* ═════ MARQUEE DE VERSETS ═════ */}
      <section className="bg-[#2A0E3D] border-y border-[#C9A227]/20 py-6 overflow-hidden">
        <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
          {VERSES.map((verse, i) => (
            <span key={i} className="inline-flex items-center gap-3">
              <Sparkles className="w-3 h-3 text-[#C9A227]/60 flex-shrink-0" />
              <span className={i % 2 === 0
                ? "font-serif italic text-[#FAF6EF]/80 text-lg"
                : "text-xs uppercase tracking-[0.2em] text-[#C9A227]/60 font-semibold"
              }>
                {verse}
              </span>
            </span>
          ))}
          {/* Duplicate for seamless loop */}
          {VERSES.map((verse, i) => (
            <span key={`dup-${i}`} className="inline-flex items-center gap-3">
              <Sparkles className="w-3 h-3 text-[#C9A227]/60 flex-shrink-0" />
              <span className={i % 2 === 0
                ? "font-serif italic text-[#FAF6EF]/80 text-lg"
                : "text-xs uppercase tracking-[0.2em] text-[#C9A227]/60 font-semibold"
              }>
                {verse}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ═════ CTA COMMUNAUTÉ ═════ */}
      <section className="py-12 bg-[#2A0E3D] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-semibold mb-4">
              Communauté
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#FAF6EF] leading-tight mb-6">
              Rejoignez les canaux d'échange
            </h2>
            <p className="text-base md:text-lg text-[#FAF6EF]/60 leading-relaxed max-w-2xl mx-auto mb-10">
              Des espaces d'échange organisés par thème, modérés avec attention,
              pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints chiffrés,
              intercession — à chacun son rythme.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/communaute"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300"
              >
                Rejoindre la communauté
                <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
              <Link
                href="/yeshua-connect"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Yeshua Connect
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═════ NAVIGATION RAPIDE ═════ */}
      {/* Section supprimée — redondante avec la navbar et le footer */}
    </div>
  );
}

// ============================================================
// COMPTEUR ANIMÉ (0 → target au scroll)
// ============================================================
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 1500;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, hasAnimated]);

  return <span ref={ref}>{count}{suffix}</span>;
}
