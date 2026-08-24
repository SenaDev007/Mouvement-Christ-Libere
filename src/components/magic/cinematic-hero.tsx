"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ChevronRight, Sparkles, Radio } from "lucide-react";
import Link from "next/link";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { AnimatedGrid } from "@/components/magic/animated-grid";
import { TextShimmer, GradientText } from "@/components/magic/text-shimmer";
import { MagneticButton } from "@/components/magic/magnetic-button";

interface CinematicHeroProps {
  kicker: string;
  title: React.ReactNode;
  subtitle: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  isLive?: boolean;
  liveLabel?: string;
}

export function CinematicHero({
  kicker,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  isLive,
  liveLabel = "EN DIRECT MAINTENANT",
}: CinematicHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  return (
    <section ref={ref} className="relative min-h-[100vh] overflow-hidden">
      <AuroraBackground variant="dawn" intensity="strong" className="absolute inset-0">
        {/* Particules dorées flottantes */}
        <ParticleField count={50} color="#C9A227" size={1.5} speed="slow" />

        {/* Grille animée en fond */}
        <AnimatedGrid cellSize={80} color="rgba(201, 162, 39, 0.06)" />

        {/* Étoile de David filigrane géante */}
        <motion.div
          style={{ opacity, scale }}
          className="absolute top-1/2 right-[-10%] -translate-y-1/2 opacity-[0.05] pointer-events-none"
        >
          <svg
            viewBox="0 0 200 200"
            fill="none"
            stroke="#C9A227"
            strokeWidth="0.3"
            className="w-[600px] h-[600px]"
            aria-hidden="true"
          >
            <polygon points="100,10 175,140 25,140" />
            <polygon points="100,190 175,60 25,60" />
            <circle cx="100" cy="100" r="95" strokeWidth="0.2" />
            <circle cx="100" cy="100" r="70" strokeWidth="0.15" />
            <circle cx="100" cy="100" r="40" strokeWidth="0.1" />
          </svg>
        </motion.div>

        {/* Filets or supérieur et inférieur */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-80" />
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-80" />

        {/* Contenu */}
        <motion.div
          style={{ opacity, y }}
          className="relative z-20 min-h-[100vh] flex items-center"
        >
          <div className="container mx-auto max-w-7xl px-4">
            <div className="max-w-5xl">
              {/* Badge live si actif */}
              {isLive && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="mb-8"
                >
                  <Link
                    href="/videos"
                    className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-state-danger/15 border border-state-danger/40 backdrop-blur-md hover:bg-state-danger/25 transition-all"
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-state-danger opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-state-danger" />
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] font-bold text-state-danger">
                      {liveLabel}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-state-danger transition-transform group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              )}

              {/* Kicker avec Sparkles */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="flex items-center gap-3 mb-8"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="w-4 h-4 text-gold" />
                </motion.div>
                <span className="text-xs uppercase tracking-[0.3em] font-semibold text-gold">
                  {kicker}
                </span>
                <div className="h-px w-12 bg-gradient-to-r from-gold to-transparent" />
              </motion.div>

              {/* Titre principal */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.2 }}
                className="font-serif text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold leading-[0.95] tracking-tight mb-8"
              >
                <span className="block text-ivory">{title}</span>
              </motion.h1>

              {/* Sous-titre */}
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.4 }}
                className="text-lg md:text-xl lg:text-2xl text-ivory/70 leading-relaxed max-w-3xl mb-12 font-light"
              >
                {subtitle}
              </motion.p>

              {/* CTAs */}
              {(primaryCta || secondaryCta) && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.6 }}
                  className="flex flex-col sm:flex-row gap-4 items-start"
                >
                  {primaryCta && (
                    <MagneticButton href={primaryCta.href} variant="primary">
                      {primaryCta.label}
                      <ChevronRight className="w-4 h-4" />
                    </MagneticButton>
                  )}
                  {secondaryCta && (
                    <MagneticButton href={secondaryCta.href} variant="secondary">
                      {secondaryCta.label}
                      <ChevronRight className="w-4 h-4" />
                    </MagneticButton>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Indicateur scroll en bas */}
        <motion.div
          style={{ opacity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-[0.4em] text-ivory/40 font-medium">
              Défiler
            </span>
            <div className="w-px h-12 bg-gradient-to-b from-gold/60 to-transparent" />
          </motion.div>
        </motion.div>
      </AuroraBackground>
    </section>
  );
}
