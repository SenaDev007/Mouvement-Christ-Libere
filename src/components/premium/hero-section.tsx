"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  kicker: string;
  title: React.ReactNode;
  subtitle: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  isLive?: boolean;
  liveLabel?: string;
}

export function HeroSection({
  kicker,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  isLive,
  liveLabel = "EN DIRECT MAINTENANT",
}: HeroSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <section ref={ref} className="relative min-h-[92vh] overflow-hidden hero-imperial">
      {/* Couches parallax décoratives */}
      <motion.div
        style={{ y, scale }}
        className="absolute inset-0 pointer-events-none"
      >
        {/* Halo or supérieur droit */}
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-gold/10 blur-[120px]" />
        {/* Halo lavande inférieur gauche */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-lavender/20 blur-[100px]" />
      </motion.div>

      {/* Motif géométrique filigrane — étoile de David discrète */}
      <motion.div
        style={{ opacity }}
        className="absolute top-12 right-12 opacity-[0.08] pointer-events-none hidden md:block"
      >
        <StarOfDavid className="w-48 h-48 text-gold" />
      </motion.div>

      {/* Filet or supérieur */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />

      {/* Contenu */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 container mx-auto max-w-7xl px-4 min-h-[92vh] flex items-center"
      >
        <div className="max-w-4xl">
          {/* Badge live si actif */}
          {isLive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6"
            >
              <Link
                href="/videos"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-state-danger/20 border border-state-danger/40 backdrop-blur-sm hover:bg-state-danger/30 transition-colors group"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-state-danger opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-state-danger" />
                </span>
                <span className="text-xs uppercase tracking-[0.18em] font-bold text-state-danger">
                  {liveLabel}
                </span>
                <ChevronRight className="w-3 h-3 text-state-danger transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          )}

          {/* Kicker */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex items-center gap-2 mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs uppercase tracking-[0.25em] font-semibold text-gold">
              {kicker}
            </span>
          </motion.div>

          {/* Titre */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.02] text-ivory mb-6 tracking-tight"
          >
            {title}
          </motion.h1>

          {/* Sous-titre */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-lg md:text-xl text-ivory/75 leading-relaxed max-w-2xl mb-10 font-light"
          >
            {subtitle}
          </motion.p>

          {/* CTAs */}
          {(primaryCta || secondaryCta) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              {primaryCta && (
                <Link
                  href={primaryCta.href}
                  className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-all hover:shadow-[0_0_30px_rgba(201,162,39,0.4)]"
                >
                  {primaryCta.label}
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              {secondaryCta && (
                <Link
                  href={secondaryCta.href}
                  className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-md border border-gold/40 text-gold font-semibold text-sm hover:bg-gold/10 transition-all backdrop-blur-sm"
                >
                  {secondaryCta.label}
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Indicateur scroll */}
      <motion.div
        style={{ opacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-ivory/40 font-medium">
            Défiler
          </span>
          <div className="w-px h-8 bg-gradient-to-b from-gold/60 to-transparent" />
        </motion.div>
      </motion.div>

      {/* Filet or inférieur */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />
    </section>
  );
}

function StarOfDavid({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.5"
      className={className}
      aria-hidden="true"
    >
      <polygon points="50,5 90,75 10,75" />
      <polygon points="50,95 90,25 10,25" />
      <circle cx="50" cy="50" r="48" strokeWidth="0.3" />
    </svg>
  );
}
