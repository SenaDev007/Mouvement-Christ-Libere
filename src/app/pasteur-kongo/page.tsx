"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { MarkdownText } from "@/components/site/markdown-text";
import { ChevronRight, FileText, BookOpen, Video, Sparkles, MapPin, Calendar, Quote, Users, Clock } from "lucide-react";

// Biographie du Pasteur Kongo — style ghostwriter (à compléter quand les données seront disponibles)
const BIOGRAPHIE_GHOSTWRITER = `Le Pasteur Kongo exerce un ministère pastoral complémentaire au sein de Christ Libère. Berger de la communauté, il marche aux côtés de Pam dans l'œuvre du Royaume, apportant un accompagnement pastoral et un discernement spirituel au peuple de Dieu.

## Un Ministère Pastoral

Le Pasteur Kongo est reconnu comme le berger de la communauté. Son ministère s'articule autour de l'enseignement biblique, du soin des brebis et de l'accompagnement spirituel des croyants. Il œuvre pour le rassemblement des dispersés d'Israël et la préparation de l'Épouse du Christ pour le retour imminent du Roi Yeshua HaMashiach.

## Un Berger aux Côtés de Pam

Marchant en communion avec Pam, le Pasteur Kongo apporte un ministère distinct mais complémentaire. Là où Pam porte le témoignage prophétique des visites célestes, le Pasteur Kongo exerce la fonction pastorale : enseignement, intercession, conseil et garde du troupeau.`;

export default function PasteurKongoPage() {
  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* ═══ HERO avec vraie photo du Pasteur Kongo ═══ */}
      <section className="relative min-h-[70vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-[#FAF6EF]">
        <div className="absolute inset-0 z-0">
          <Image
            src="/pasteur-kongo.jpeg"
            alt="Pasteur Kongo"
            fill
            priority
            className="object-cover object-center opacity-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/70 via-[#2A0E3D]/80 to-[#1A0826]" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <Sparkles className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
              Ministère pastoral
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-4 drop-shadow-lg"
          >
            <span className="text-[#C9A227]">Pasteur</span> Kongo
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base md:text-lg text-[#FAF6EF]/80 leading-relaxed max-w-2xl mx-auto mb-8 drop-shadow"
          >
            Berger de la communauté, marchant aux côtés de Pam dans l'œuvre du Royaume.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#FAF6EF]/70"
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#C9A227]" />
              Berger de la communauté
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
              Ministère pastoral
            </span>
          </motion.div>
        </div>
      </section>

      {/* ═══ BIOGRAPHIE — Style ghostwriter avec photo (comme Pam) ═══ */}
      <article className="py-16 md:py-24 bg-[#FAF6EF]">
        <div className="max-w-6xl mx-auto px-4">
          {/* En-tête biographie */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-center"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
              Biographie
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#1E0F2B] mb-4">
              Le Berger de la Communauté
            </h2>
            <div className="flex items-center justify-center gap-2">
              <div className="w-12 h-px bg-[#C9A227]/40" />
              <Quote className="w-4 h-4 text-[#C9A227]" />
              <div className="w-12 h-px bg-[#C9A227]/40" />
            </div>
          </motion.div>

          {/* Layout biographie : texte + photo côte à côte */}
          <div className="grid lg:grid-cols-[1fr_400px] gap-8 md:gap-12 items-start">
            {/* Colonne gauche : texte biographique (style ghostwriter) */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="order-2 lg:order-1"
            >
              <div className="bg-white rounded-2xl shadow-md border border-[#8A8378]/15 p-8 md:p-10 border-l-[4px] border-l-[#C9A227]">
                {/* Citation d'ouverture */}
                <div className="mb-6 pb-6 border-b border-[#8A8378]/15">
                  <p className="font-serif text-lg md:text-xl italic text-[#2A0E3D] leading-relaxed">
                    « Berger de la communauté, il marche aux côtés de Pam
                    dans l'œuvre du Royaume, apportant un accompagnement pastoral
                    et un discernement spirituel au peuple de Dieu. »
                  </p>
                </div>

                {/* Texte biographique */}
                <div className="prose-bio">
                  <MarkdownText>{BIOGRAPHIE_GHOSTWRITER}</MarkdownText>
                </div>

                {/* Note biographie en cours */}
                <div className="mt-8 pt-6 border-t border-[#8A8378]/15">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-[#C9A227]/5 border border-[#C9A227]/20">
                    <Clock className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-[#9C7E1E] uppercase tracking-wider mb-1">
                        Biographie en cours d'enrichissement
                      </p>
                      <p className="text-sm text-[#8A8378] leading-relaxed">
                        Cette biographie sera enrichie au fur et à mesure de la collecte
                        du témoignage authentique et du parcours du Pasteur Kongo.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Signature */}
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-px bg-[#C9A227]" />
                  <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8A8378]">
                    Biographie rédigée par la rédaction de Christ Libère
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Colonne droite : photo + nom animés (comme Pam) */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="order-1 lg:order-2 lg:sticky lg:top-24"
            >
              <div className="relative group">
                {/* Halo doré animé derrière la photo */}
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#C9A227]/30 via-[#C9A227]/10 to-transparent blur-2xl pointer-events-none"
                />

                {/* Cadre photo */}
                <div className="relative bg-[#2A0E3D] rounded-2xl overflow-hidden shadow-xl border-2 border-[#C9A227]/30">
                  {/* Photo du Pasteur Kongo */}
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <Image
                      src="/pasteur-kongo.jpeg"
                      alt="Pasteur Kongo"
                      fill
                      sizes="(max-width: 1024px) 100vw, 400px"
                      className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Gradient overlay en bas */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2A0E3D] via-[#2A0E3D]/20 to-transparent" />

                    {/* Badge "Ministère pastoral" */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                      className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2A0E3D]/80 backdrop-blur-sm border border-[#C9A227]/40"
                    >
                      <Sparkles className="w-3 h-3 text-[#C9A227]" />
                      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A227]">
                        Ministère pastoral
                      </span>
                    </motion.div>

                    {/* Nom + identité animés en bas de la photo */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#C9A227] mb-1"
                      >
                        Pasteur
                      </motion.p>
                      <motion.h3
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.4 }}
                        className="font-serif text-2xl font-bold text-[#FAF6EF] drop-shadow-lg"
                      >
                        Kongo
                      </motion.h3>
                      <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="h-0.5 bg-gradient-to-r from-[#C9A227] to-transparent mt-2 origin-left"
                      />
                    </div>
                  </div>

                  {/* Footer de la carte */}
                  <div className="px-5 py-4 border-t border-[#C9A227]/20">
                    <div className="flex items-center gap-2 text-xs">
                      <Users className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                      <span className="text-[#FAF6EF]/70 font-medium">
                        Berger de la communauté
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-2">
                      <Calendar className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                      <span className="text-[#FAF6EF]/70 font-medium">
                        Ministère pastoral
                      </span>
                    </div>
                  </div>
                </div>

                {/* Indicateur "Biographie officielle" */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#C9A227]/10 border border-[#C9A227]/30"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
                  <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9C7E1E]">
                    Biographie officielle
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </article>

      {/* ═══ LIENS VERS AUTRES CONTENUS ═══ */}
      <section className="py-16 bg-[#2A0E3D]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
              Aller plus loin
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#FAF6EF]">
              Explorer le ministère
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link
              href="/enseignements?servant=kongo"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <BookOpen className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Enseignements
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Études bibliques : fêtes de l'Éternel, discernement spirituel.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Étudier <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
            <Link
              href="/videos?servant=kongo"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <Video className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Vidéos & Lives
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Enseignements vidéo et directs du Pasteur Kongo.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Regarder <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
            <Link
              href="/communaute"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <Users className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Communauté
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Berger de la communauté, accompagnement pastoral.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Rejoindre <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CTA PAM ═══ */}
      <section className="py-12 bg-[#1A0826]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
            Découvrez également
          </p>
          <Link
            href="/pam"
            className="inline-flex items-center gap-2 text-[#FAF6EF] hover:text-[#C9A227] font-serif text-lg font-bold transition-colors"
          >
            Pam — Afrika Alkebulane Pamela Dali <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
