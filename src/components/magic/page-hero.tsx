"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { TextShimmer } from "@/components/magic/text-shimmer";
import { MagneticButton } from "@/components/magic/magnetic-button";

interface PageHeroProps {
  kicker: string;
  title: React.ReactNode;
  subtitle: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export function PageHero({
  kicker,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
}: PageHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-[70vh] overflow-hidden">
      <AuroraBackground variant="imperial" intensity="medium" className="absolute inset-0">
        <ParticleField count={25} color="#C9A227" size={1} speed="slow" />

        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />

        <motion.div
          style={{ opacity, y }}
          className="relative z-20 min-h-[70vh] flex items-center"
        >
          <div className="container mx-auto max-w-7xl px-4">
            <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center gap-3 mb-6"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-gold" />
                </motion.div>
                <span className="text-xs uppercase tracking-[0.3em] font-semibold text-gold">
                  {kicker}
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight text-ivory mb-6"
              >
                {title}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.25 }}
                className="text-lg md:text-xl text-ivory/70 leading-relaxed max-w-2xl mb-10 font-light"
              >
                {subtitle}
              </motion.p>

              {(primaryCta || secondaryCta) && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-4"
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
      </AuroraBackground>
    </section>
  );
}
