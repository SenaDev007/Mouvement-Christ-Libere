"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

interface PageHeroProps {
  kicker: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export function PageHero({ kicker, title, subtitle, imageSrc, primaryCta, secondaryCta }: PageHeroProps) {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-white">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={imageSrc} alt={title} className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/80 via-[#2A0E3D]/90 to-[#1A0826]" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="w-4 h-4 text-[#C9A227]" />
          <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#C9A227]">{kicker}</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6">
          {title}
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-10">
          {subtitle}
        </motion.p>

        {(primaryCta || secondaryCta) && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="flex flex-col sm:flex-row gap-4 justify-center">
            {primaryCta && (
              <Link href={primaryCta.href} className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300">
                {primaryCta.label} <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
            {secondaryCta && (
              <Link href={secondaryCta.href} className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300">
                {secondaryCta.label} <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
