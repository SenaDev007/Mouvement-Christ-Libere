"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, BookOpen, Sparkles, Hash } from "lucide-react";
import { CinematicHero } from "@/components/magic/cinematic-hero";
import { MagneticButton } from "@/components/magic/magnetic-button";
import { TiltCard } from "@/components/magic/tilt-card";
import { SpotlightCard } from "@/components/magic/spotlight-card";
import { Marquee } from "@/components/magic/marquee";
import { TextShimmer, GradientText } from "@/components/magic/text-shimmer";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";

const VERSES = [
  "Et Hénoch marcha avec Dieu", "Genèse 5:24",
  "Le chofar va retentir", "1 Thessaloniciens 4:16",
  "Rassemblez mes dispersés", "Ésaïe 11:12",
  "Voici, je viens bientôt", "Apocalypse 3:11",
  "Préparez le chemin du Seigneur", "Ésaïe 40:3",
  "Au son du chofar", "Mouvement Christ Libère",
];

interface ServantData {
  code: string; fullName: string; shortName: string; role: string; bio: string;
}

const SERVANTS_FALLBACK: ServantData[] = [
  { code: "pam", fullName: "Afrika Alkebulane Pamela Dali", shortName: "PAM", role: "Servante de l'Éternel", bio: "Témoignages d'enlèvements au ciel, instructions reçues du Seigneur Yeshoua, conformité à la Parole. Figure contemporaine du patriarche Hénoch." },
  { code: "kongo", fullName: "Pasteur Kongo", shortName: "Pasteur Kongo", role: "Époux, ministre pastoral", bio: "Ministère pastoral complémentaire, enseignements et partages spirituels." },
];

const STATS = [
  { value: "16", label: "jalons biographiques" },
  { value: "6", label: "témoignages authentiques" },
  { value: "6", label: "enseignements publiés" },
  { value: "24h", label: "délai de réponse" },
];

export default function Home() {
  const [servants] = useState<ServantData[]>(SERVANTS_FALLBACK);
  const [hasLive, setHasLive] = useState(false);

  useEffect(() => {
    fetch("/api/home")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.videos?.some((v: { isLive: boolean }) => v.isLive)) {
          setHasLive(true);
        }
      })
      .catch(() => {});
  }, []);

  const pam = servants.find((s) => s.code === "pam");
  const kongo = servants.find((s) => s.code === "kongo");

  return (
    <div>
      {/* HERO CINÉMATIQUE */}
      <CinematicHero
        kicker="Un même appel, deux serviteurs"
        title={
          <>
            Afrika Alkebulane
            <br />
            <GradientText from="#C9A227" to="#DDBE55">Pamela Dali</GradientText>
            <br />
            <span className="text-ivory/90">& Pasteur Kongo</span>
          </>
        }
        subtitle="Témoignages, enseignements et vie de communauté, au service du rassemblement des fils d'Israël dispersés — en préparation au retour du Maître Yeshoua, au son du chofar."
        primaryCta={{ label: "Découvrir le témoignage de PAM", href: "/temoignages" }}
        secondaryCta={{ label: "Le ministère du Pasteur Kongo", href: "/biographie" }}
        isLive={hasLive}
      />

      {/* MARQUEE de versets */}
      <div className="bg-imperial border-y border-gold/20 py-4 overflow-hidden">
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

      {/* STATS */}
      <section className="bg-ivory py-24 md:py-32 relative overflow-hidden">
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

      {/* SERVITEURS */}
      <section className="bg-ivory py-24 md:py-32 relative">
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
            {pam && (
              <TiltCard maxTilt={8} className="h-full">
                <SpotlightCard className="h-full p-8 bg-ivory">
                  <ServantCardContent
                    portrait="AP"
                    name={pam.shortName}
                    fullName={pam.fullName}
                    role={pam.role}
                    bio={pam.bio}
                    href="/biographie"
                    ctaLabel="Lire la biographie de PAM"
                  />
                </SpotlightCard>
              </TiltCard>
            )}
            {kongo && (
              <TiltCard maxTilt={8} className="h-full">
                <SpotlightCard className="h-full p-8 bg-ivory">
                  <ServantCardContent
                    portrait="PK"
                    name={kongo.shortName}
                    fullName={kongo.fullName}
                    role={kongo.role}
                    bio={kongo.bio}
                    href="/biographie"
                    ctaLabel="Lire la biographie du Pasteur Kongo"
                  />
                </SpotlightCard>
              </TiltCard>
            )}
          </div>
        </div>
      </section>

      {/* CITATION */}
      <AuroraBackground variant="imperial" intensity="strong" className="py-32 md:py-40">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit."
            reference="Genèse 5:24"
            variant="dark"
          />
        </div>
      </AuroraBackground>

      {/* APPEL COMMUNAUTÉ */}
      <AuroraBackground variant="dawn" intensity="strong" className="py-32 md:py-40">
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
              <MagneticButton href="/communaute" variant="primary">
                <Hash className="w-4 h-4" />
                Rejoindre un canal
              </MagneticButton>
              <MagneticButton href="/contribuer" variant="secondary">
                <BookOpen className="w-4 h-4" />
                Contribuer
              </MagneticButton>
            </div>
          </motion.div>
        </div>
      </AuroraBackground>
    </div>
  );
}

function ServantCardContent({
  portrait,
  name,
  fullName,
  role,
  bio,
  href,
  ctaLabel,
}: {
  portrait: string;
  name: string;
  fullName: string;
  role: string;
  bio: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-shrink-0">
          <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-gold bg-gold/10">
            <span className="font-serif text-lg font-semibold text-gold">{portrait}</span>
          </div>
          <div className="absolute inset-0 rounded-full border border-gold/30 animate-ping opacity-50" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone font-semibold">{role}</div>
          <div className="font-serif text-xl font-semibold text-ink mt-0.5">{name}</div>
          <div className="text-xs text-stone mt-0.5">{fullName}</div>
        </div>
      </div>
      <p className="text-sm text-ink/75 leading-relaxed mb-6 flex-1">{bio}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors group/cta mt-auto whitespace-nowrap"
      >
        {ctaLabel}
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/cta:translate-x-1 flex-shrink-0" />
      </Link>
    </div>
  );
}
