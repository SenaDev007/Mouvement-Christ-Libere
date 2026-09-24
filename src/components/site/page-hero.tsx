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
    <section className="page-hero-min-h relative flex items-center justify-center pt-24 pb-16 overflow-hidden bg-primary-deep text-white">
      {/* ⭐ V3.97 — Fond façon Win Agro : halos flottants + grain + mesh */}
      <div className="absolute inset-0 z-0">
        <HeroBackgroundImage src={imageSrc} alt={title} className="object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-deep/90 via-primary-deep/85 to-noir-vert/90 mix-blend-multiply" />
        <div className="absolute -top-40 -right-20 w-96 h-96 bg-primary-green/10 rounded-full blur-[100px] animate-float" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-accent-yellow/5 rounded-full blur-[120px] animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute inset-0 bg-grain opacity-[0.08] mix-blend-overlay" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        {/* Badge ping façon Win Agro */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-green/30 border border-primary-green/50 text-accent-yellow font-sans font-bold text-xs uppercase tracking-wider mb-8 animate-pulse-slow">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-yellow opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-yellow"></span>
          </span>
          <Sparkles className="w-4 h-4 text-accent-yellow shrink-0" />
          <IsololeText>{kicker}</IsololeText>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }} className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6">
          {/* ⭐ V3.45 — Titre paramétrable : partie principale + partie
              dorée (retour à la ligne si présente) + suffixe.
              ⭐ V3.97 — partie dorée soulignée par l'animation scaleX Win Agro. */}
          <IsololeText>{title}</IsololeText>
          {titleAccent ? (
            <>
              <br />
              <span className="relative inline-block text-[#C9A227]">
                <IsololeText>{titleAccent}</IsololeText>
                <motion.span
                  animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
                  transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                  className="absolute bottom-1 left-0 w-full h-[4px] bg-accent-yellow rounded-full"
                />
              </span>
            </>
          ) : null}
          {titleSuffix ? (
            <span>{titleSuffix.startsWith(" ") ? "" : " "}<IsololeText>{titleSuffix}</IsololeText></span>
          ) : null}
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }} className="text-base md:text-lg text-gray-200 font-sans leading-relaxed max-w-2xl mx-auto mb-10">
          <IsololeText>{subtitle}</IsololeText>
        </motion.p>

        {(primaryCta || secondaryCta || secondaryCtaNode) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }} className="flex flex-col sm:flex-row gap-4 justify-center">
            {primaryCta && (
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ scale: { repeat: Infinity, duration: 2.5, ease: "easeInOut" } }}
                className="inline-flex"
              >
                <Link href={primaryCta.href} className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-xl transition-all duration-300 btn-shimmer">
                  {primaryCta.label} <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </motion.div>
            )}
            {secondaryCtaNode ?? (secondaryCta && (
              <Link href={secondaryCta.href} className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300">
                {secondaryCta.label} <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            ))}
          </motion.div>
        )}
      </div>

      {/* Diviseur incliné façon Win Agro */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-cream" style={{ clipPath: "polygon(0 100%, 100% 100%, 100% 0)" }} />
    </section>
  );
}
