"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Sparkles } from "lucide-react";
import { IsololeText } from "@/lib/isolole";

interface PageHeroProps {
  kicker: string;
  title: string;
  /** ⭐ V3.45 — Partie dorée du titre (2e ligne ou mot accentué). */
  titleAccent?: string;
  /** ⭐ V3.45 — Texte APRÈS la partie dorée (ex. « d'Isolélé (Israël) »). */
  titleSuffix?: string;
  subtitle: string;
  imageSrc: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** ⭐ V3.10 — CTA secondaire personnalisé (bouton client, ex. export
   * PDF avec modal) — remplace le lien secondaire quand fourni. */
  secondaryCtaNode?: React.ReactNode;
}

/**
 * ⭐ V3.45 — Image d'arrière-plan du hero, compatible TROIS sources :
 *   - chemin local (ex. /pam-kongo-hero.webp) → next/image (optimisée) ;
 *   - URL http(s) (ex. Unsplash) → next/image ;
 *   - data URL (photo uploadée depuis le back-office) → <img> natif
 *     (next/image ne traite pas les data: URLs — on évite tout risque).
 */
export function HeroBackgroundImage({
  src,
  alt,
  className,
  priority = true,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  if (!src) return null;
  if (src.startsWith("data:")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={`absolute inset-0 w-full h-full ${className ?? ""}`} />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="100vw"
      className={className}
    />
  );
}

export function PageHero({
  kicker,
  title,
  titleAccent,
  titleSuffix,
  subtitle,
  imageSrc,
  primaryCta,
  secondaryCta,
  secondaryCtaNode,
}: PageHeroProps) {
  return (
    <section className="page-hero-min-h relative flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#000000] text-white">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <HeroBackgroundImage src={imageSrc} alt={title} className="object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#000000]/80 via-[#000000]/90 to-[#000000]" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="w-4 h-4 text-[#C9A227]" />
          <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#C9A227]">
            <IsololeText>{kicker}</IsololeText>
          </span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6">
          {/* ⭐ V3.45 — Titre paramétrable : partie principale + partie
              dorée (retour à la ligne si présente) + suffixe. */}
          <IsololeText>{title}</IsololeText>
          {titleAccent ? (
            <>
              <br />
              <span className="text-[#C9A227]">
                <IsololeText>{titleAccent}</IsololeText>
              </span>
            </>
          ) : null}
          {titleSuffix ? (
            <span>{titleSuffix.startsWith(" ") ? "" : " "}<IsololeText>{titleSuffix}</IsololeText></span>
          ) : null}
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="text-base md:text-lg text-[#F0E9DE]/70 leading-relaxed max-w-2xl mx-auto mb-10">
          <IsololeText>{subtitle}</IsololeText>
        </motion.p>

        {(primaryCta || secondaryCta || secondaryCtaNode) && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="flex flex-col sm:flex-row gap-4 justify-center">
            {primaryCta && (
              <Link href={primaryCta.href} className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#FF7A1A] text-[#000000] font-sans font-bold text-base shadow-lg transition-all duration-300">
                {primaryCta.label} <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
            {secondaryCtaNode ?? (secondaryCta && (
              <Link href={secondaryCta.href} className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#FF7A1A]/10 transition-all duration-300">
                {secondaryCta.label} <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
