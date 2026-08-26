"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { Marquee } from "@/components/magic/marquee";
import { TextShimmer, GradientText } from "@/components/magic/text-shimmer";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock } from "@/components/premium/section-divider";
import Image from "next/image";

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
<<<<<<< HEAD
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
      <div className="bg-[#2A0E3D] border-y border-[#C9A227]/20 py-4 overflow-hidden -mx-8 md:-mx-16">
=======
    <div>
      {/* HERO avec image de fond */}
      <section className="relative min-h-[100vh] overflow-hidden">
        {/* Image de fond — cosmos/galaxie */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1920&auto=format&fit=crop"
            alt="Ciel étoilé"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/60 via-[#2A0E3D]/70 to-[#1A0826]" />
        </div>

        {/* Particules dorées */}
        <ParticleField count={50} color="#C9A227" size={1.5} speed="slow" />

        {/* Contenu */}
        <div className="relative z-10 min-h-[100vh] flex items-center">
          <div className="container mx-auto max-w-7xl px-4">
            <div className="max-w-5xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center gap-3 mb-6"
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
                className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.02] text-[#FAF6EF] mb-6"
              >
                Afrika Alkebulane
                <br />
                <GradientText from="#C9A227" to="#DDBE55">Pamela Dali</GradientText>
                <br />
                <span className="text-[#FAF6EF]/90">& Pasteur Kongo</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-lg md:text-xl text-[#FAF6EF]/70 leading-relaxed max-w-3xl mb-10"
              >
                Témoignages, enseignements et vie de communauté, au service du
                rassemblement des fils d&apos;Israël dispersés — en préparation au
                retour du Maître Yeshoua, au son du chofar.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link
                  href="/pam"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap"
                >
                  Découvrir Pam
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/pasteur-kongo"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md border border-[#C9A227]/40 text-[#C9A227] font-semibold text-sm hover:bg-[#C9A227]/10 transition-colors whitespace-nowrap"
                >
                  Découvrir le Pasteur Kongo
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE de versets */}
      <div className="bg-[#2A0E3D] border-y border-[#C9A227]/20 py-4 overflow-hidden">
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
        <Marquee speed="slow" pauseOnHover>
          {VERSES.map((verse, i) => (
            <span key={i} className="mx-8 inline-flex items-center gap-3">
              <Sparkles className="w-3 h-3 text-[#C9A227]/60" />
<<<<<<< HEAD
              <span className={i % 2 === 0 ? "font-serif italic text-[#FAF6EF]/80 text-lg" : "text-xs uppercase tracking-[0.2em] text-[#DDBE55]/60 font-semibold"}>
=======
              <span className={i % 2 === 0 ? "font-serif italic text-[#FAF6EF]/80 text-lg" : "text-xs uppercase tracking-[0.2em] text-[#C9A227]/60 font-semibold"}>
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
                {verse}
              </span>
            </span>
          ))}
        </Marquee>
      </div>

<<<<<<< HEAD
      {/* Stats */}
      <section className="bg-[#FAF6EF] py-24 md:py-32 relative overflow-hidden -mx-8 md:-mx-16">
=======
      {/* STATS */}
      <section className="bg-[#FAF6EF] py-24 md:py-32 relative overflow-hidden">
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[#C9A227]/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative container mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[#8A8378] font-semibold mb-3">
              Ce que cette plateforme rassemble
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-[#1E0F2B]">
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
                <div className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold text-[#2A0E3D] mb-2 tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-[#8A8378] leading-snug max-w-[120px] mx-auto">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

<<<<<<< HEAD
      {/* Serviteurs */}
      <section className="bg-[#FAF6EF] py-24 md:py-32 -mx-8 md:-mx-16">
=======
      {/* DEUX SERVITEURS — cartes séparées */}
      <section className="bg-[#FAF6EF] py-24 md:py-32">
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
        <div className="container mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-semibold mb-3">
              Deux ministères, une même vision
            </p>
            <h2 className="font-serif text-3xl md:text-5xl font-semibold text-[#1E0F2B] leading-tight">
              Deux voix, une même <TextShimmer>vision</TextShimmer>
            </h2>
            <p className="mt-5 text-base md:text-lg text-[#8A8378] leading-relaxed max-w-2xl mx-auto">
<<<<<<< HEAD
              PAM et le Pasteur Kongo exercent chacun un ministère distinct, uni par le mariage
              et par une même conviction : préparer les cœurs, transmettre ce qui a été reçu,
              et rassembler ceux qui se reconnaissent dans cette parole.
=======
              Pam et le Pasteur Kongo exercent chacun un ministère distinct.
              Découvrez leurs parcours séparés.
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 mt-12">
<<<<<<< HEAD
            {/* PAM Card */}
            <div className="bg-[#FAF6EF] border border-[#8A8378]/20 rounded-2xl p-8 relative overflow-hidden group hover:border-[#C9A227]/40 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#C9A227] via-[#C9A227]-light to-[#C9A227] opacity-60 group-hover:opacity-100" />
=======
            {/* Pam */}
            <Link href="/pam" className="group block bg-[#FAF6EF] border border-[#8A8378]/20 rounded-card p-8 relative overflow-hidden hover:border-[#C9A227]/40 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#C9A227] via-[#DDBE55] to-[#C9A227] opacity-60 group-hover:opacity-100" />
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-shrink-0">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-[#C9A227] bg-[#C9A227]/10">
                    <span className="font-serif text-lg font-semibold text-[#C9A227]">AP</span>
                  </div>
                  <div className="absolute inset-0 rounded-full border border-[#C9A227]/30 animate-ping opacity-50" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8A8378] font-semibold">Servante de l&apos;Éternel</div>
<<<<<<< HEAD
                  <div className="font-serif text-xl font-semibold text-[#1E0F2B] mt-0.5">PAM</div>
=======
                  <div className="font-serif text-xl font-semibold text-[#1E0F2B] mt-0.5">Pam</div>
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
                  <div className="text-xs text-[#8A8378] mt-0.5">Afrika Alkebulane Pamela Dali</div>
                </div>
              </div>
              <p className="text-sm text-[#1E0F2B]/75 leading-relaxed mb-6">
                Témoignages d&apos;enlèvements au ciel, instructions reçues du Seigneur Yeshoua.
                Figure contemporaine du patriarche Hénoch.
              </p>
<<<<<<< HEAD
              <Link href="/biographie" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors whitespace-nowrap">
                Lire la biographie de PAM
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              </Link>
            </div>

            {/* Kongo Card */}
            <div className="bg-[#FAF6EF] border border-[#8A8378]/20 rounded-2xl p-8 relative overflow-hidden group hover:border-[#C9A227]/40 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#C9A227] via-[#C9A227]-light to-[#C9A227] opacity-60 group-hover:opacity-100" />
=======
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors whitespace-nowrap">
                Voir le ministère de Pam
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Pasteur Kongo */}
            <Link href="/pasteur-kongo" className="group block bg-[#FAF6EF] border border-[#8A8378]/20 rounded-card p-8 relative overflow-hidden hover:border-[#C9A227]/40 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#C9A227] via-[#DDBE55] to-[#C9A227] opacity-60 group-hover:opacity-100" />
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-shrink-0">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-[#C9A227] bg-[#C9A227]/10">
                    <span className="font-serif text-lg font-semibold text-[#C9A227]">PK</span>
                  </div>
                  <div className="absolute inset-0 rounded-full border border-[#C9A227]/30 animate-ping opacity-50" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8A8378] font-semibold">Époux, ministre pastoral</div>
                  <div className="font-serif text-xl font-semibold text-[#1E0F2B] mt-0.5">Pasteur Kongo</div>
                </div>
              </div>
              <p className="text-sm text-[#1E0F2B]/75 leading-relaxed mb-6">
                Ministère pastoral complémentaire, enseignements et partages spirituels.
              </p>
<<<<<<< HEAD
              <Link href="/biographie" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors whitespace-nowrap">
                Lire la biographie du Pasteur Kongo
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              </Link>
            </div>
=======
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors whitespace-nowrap">
                Voir le ministère du Pasteur Kongo
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
          </div>
        </div>
      </section>

      {/* DERNIER ENSEIGNEMENT */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-2">
              Le dernier enseignement
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-[#1E0F2B]">
              Pour approfondir la Parole
            </h2>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 border-t-[3px] border-t-[#C9A227] p-8 max-w-2xl mx-auto">
            <p className="text-xs font-semibold text-[#8C5FA8] uppercase tracking-wider mb-2">Pam — Doctrine</p>
            <h3 className="font-serif text-xl font-semibold text-[#1E0F2B] mb-3">
              La Véritable Nature du Saint-Esprit et la Trinité
            </h3>
            <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-4">
              Au ciel, il n'y a pas trois trônes pour le Père, le Fils et le Saint-Esprit. Il n'y a qu'un seul Trône, et c'est la même personne qui s'y manifeste sous différentes formes...
            </p>
            <Link
              href="/enseignements"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
            >
              Voir tous les enseignements
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
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
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-semibold mb-3">
              Communauté
            </p>
            <h2 className="font-serif text-3xl md:text-5xl lg:text-6xl font-semibold text-[#FAF6EF] leading-tight mb-6">
              Rejoignez les fils d&apos;Israël <TextShimmer>dispersés</TextShimmer>
            </h2>
            <p className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-10">
              Des espaces d&apos;échange organisés par thème, modérés avec attention,
              pour grandir ensemble dans la foi.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/communaute"
<<<<<<< HEAD
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap"
=======
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap"
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
              >
                Rejoindre un canal
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contribuer"
<<<<<<< HEAD
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[#C9A227]/40 text-[#C9A227] font-semibold text-sm hover:bg-[#C9A227]/10 transition-colors whitespace-nowrap"
=======
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md border border-[#C9A227]/40 text-[#C9A227] font-semibold text-sm hover:bg-[#C9A227]/10 transition-colors whitespace-nowrap"
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b
              >
                Contribuer
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </AuroraBackground>
    </div>
  );
}
