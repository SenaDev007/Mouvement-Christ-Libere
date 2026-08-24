"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { Marquee } from "@/components/magic/marquee";
import { TextShimmer, GradientText } from "@/components/magic/text-shimmer";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock } from "@/components/premium/section-divider";
import ScrollExpandMedia from "@/components/blocks/scroll-expansion-hero";

const VERSES = [
  "Et Hénoch marcha avec Dieu", "Genèse 5:24",
  "Le chofar va retentir", "1 Thessaloniciens 4:16",
  "Rassemblez mes dispersés", "Ésaïe 11:12",
  "Voici, je viens bientôt", "Apocalypse 3:11",
  "Préparez le chemin du Seigneur", "Ésaïe 40:3",
  "Au son du chofar", "Mouvement Christ Libère",
];

const STATS = [
  { value: "16", label: "jalons biographiques" },
  { value: "6", label: "témoignages authentiques" },
  { value: "6", label: "enseignements publiés" },
  { value: "24h", label: "délai de réponse" },
];

export default function Home() {
  return (
    <ScrollExpandMedia
      mediaType="image"
      mediaSrc="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1280&auto=format&fit=crop"
      bgImageSrc="https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1920&auto=format&fit=crop"
      title="Mouvement Christ Libère"
      date="PAM & Pasteur Kongo"
      scrollToExpand="Défiler pour découvrir"
      textBlend
    >
      {/* Marquee de versets */}
      <div className="bg-imperial border-y border-gold/20 py-4 overflow-hidden -mx-8 md:-mx-16">
        <Marquee speed="slow" pauseOnHover>
          {VERSES.map((verse, i) => (
            <span key={i} className="mx-8 inline-flex items-center gap-3">
              <Sparkles className="w-3 h-3 text-gold/60" />
              <span className={i % 2 === 0 ? "font-serif italic text-ivory/80 text-lg" : "text-xs uppercase tracking-[0.2em] text-gold-light/60 font-semibold"}>
                {verse}
              </span>
            </span>
          ))}
        </Marquee>
      </div>

      {/* Stats */}
      <section className="bg-ivory py-24 md:py-32 relative overflow-hidden -mx-8 md:-mx-16">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gold/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative container mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-stone font-semibold mb-3">
              Ce que cette plateforme rassemble
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-ink">
              Une communauté en <TextShimmer>activité</TextShimmer>
            </h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold text-imperial mb-2 tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-stone leading-snug max-w-[120px] mx-auto">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Serviteurs */}
      <section className="bg-ivory py-24 md:py-32 -mx-8 md:-mx-16">
        <div className="container mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-gold font-semibold mb-3">
              Deux ministères, une même vision
            </p>
            <h2 className="font-serif text-3xl md:text-5xl font-semibold text-ink leading-tight">
              Deux voix, une même <TextShimmer>vision</TextShimmer>
            </h2>
            <p className="mt-5 text-base md:text-lg text-stone leading-relaxed max-w-2xl mx-auto">
              PAM et le Pasteur Kongo exercent chacun un ministère distinct, uni par le mariage
              et par une même conviction : préparer les cœurs, transmettre ce qui a été reçu,
              et rassembler ceux qui se reconnaissent dans cette parole.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {/* PAM Card */}
            <div className="bg-ivory border border-stone/20 rounded-card p-8 relative overflow-hidden group hover:border-gold/40 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold via-gold-light to-gold opacity-60 group-hover:opacity-100" />
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-shrink-0">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-gold bg-gold/10">
                    <span className="font-serif text-lg font-semibold text-gold">AP</span>
                  </div>
                  <div className="absolute inset-0 rounded-full border border-gold/30 animate-ping opacity-50" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone font-semibold">Servante de l&apos;Éternel</div>
                  <div className="font-serif text-xl font-semibold text-ink mt-0.5">PAM</div>
                  <div className="text-xs text-stone mt-0.5">Afrika Alkebulane Pamela Dali</div>
                </div>
              </div>
              <p className="text-sm text-ink/75 leading-relaxed mb-6">
                Témoignages d&apos;enlèvements au ciel, instructions reçues du Seigneur Yeshoua.
                Figure contemporaine du patriarche Hénoch.
              </p>
              <Link href="/biographie" className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors whitespace-nowrap">
                Lire la biographie de PAM
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              </Link>
            </div>

            {/* Kongo Card */}
            <div className="bg-ivory border border-stone/20 rounded-card p-8 relative overflow-hidden group hover:border-gold/40 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold via-gold-light to-gold opacity-60 group-hover:opacity-100" />
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-shrink-0">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-gold bg-gold/10">
                    <span className="font-serif text-lg font-semibold text-gold">PK</span>
                  </div>
                  <div className="absolute inset-0 rounded-full border border-gold/30 animate-ping opacity-50" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone font-semibold">Époux, ministre pastoral</div>
                  <div className="font-serif text-xl font-semibold text-ink mt-0.5">Pasteur Kongo</div>
                </div>
              </div>
              <p className="text-sm text-ink/75 leading-relaxed mb-6">
                Ministère pastoral complémentaire, enseignements et partages spirituels.
              </p>
              <Link href="/biographie" className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors whitespace-nowrap">
                Lire la biographie du Pasteur Kongo
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Citation */}
      <AuroraBackground variant="imperial" intensity="strong" className="py-32 md:py-40 -mx-8 md:-mx-16">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit."
            reference="Genèse 5:24"
            variant="dark"
          />
        </div>
      </AuroraBackground>

      {/* Appel communauté */}
      <AuroraBackground variant="dawn" intensity="strong" className="py-32 md:py-40 -mx-8 md:-mx-16">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="medium" />
        <div className="relative container mx-auto max-w-4xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-gold font-semibold mb-3">
              Communauté
            </p>
            <h2 className="font-serif text-3xl md:text-5xl lg:text-6xl font-semibold text-ivory leading-tight mb-6">
              Rejoignez les fils d&apos;Israël <TextShimmer>dispersés</TextShimmer>
            </h2>
            <p className="text-base md:text-lg text-ivory/70 leading-relaxed max-w-2xl mx-auto mb-10">
              Des espaces d&apos;échange organisés par thème, modérés avec attention,
              pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints chiffrés,
              intercession — à chacun son rythme.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/communaute"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors whitespace-nowrap"
              >
                Rejoindre un canal
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
              </Link>
              <Link
                href="/contribuer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md border border-gold/40 text-gold font-semibold text-sm hover:bg-gold/10 transition-colors whitespace-nowrap"
              >
                Contribuer
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
              </Link>
            </div>
          </motion.div>
        </div>
      </AuroraBackground>
    </ScrollExpandMedia>
  );
}
