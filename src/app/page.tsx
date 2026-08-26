"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight, Sparkles, BookOpen, FileText, Video, Users,
  Calendar, MessageSquare, Heart, ArrowRight,
} from "lucide-react";

const VERSES = [
  "Et Hénoch marcha avec Dieu", "Genèse 5:24",
  "Le chofar va retentir", "1 Thessaloniciens 4:16",
  "Rassemblez mes dispersés", "Ésaïe 11:12",
  "Voici, je viens bientôt", "Apocalypse 3:11",
  "Préparez le chemin du Seigneur", "Ésaïe 40:3",
  "Au son du chofar", "Christ Libère",
];

const STATS = [
  { value: "31", label: "témoignages authentiques" },
  { value: "8", label: "enseignements publiés" },
  { value: "7", label: "jalons biographiques" },
  { value: "24h", label: "délai de réponse" },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Témoignages",
    description: "Récits d'expériences spirituelles authentiques — visites au ciel, paroles reçues, combats spirituels.",
    href: "/temoignages",
  },
  {
    icon: BookOpen,
    title: "Enseignements",
    description: "Études bibliques classées par thème, par livre et par niveau, pour approfondir à votre rythme.",
    href: "/enseignements",
  },
  {
    icon: Video,
    title: "Vidéos & Lives",
    description: "Enseignements vidéo et directs dans leur version originale et complète, conservés intégralement.",
    href: "/videos",
  },
  {
    icon: Users,
    title: "Communauté",
    description: "Canaux d'échange organisés par thème, modérés avec attention, pour grandir ensemble dans la foi.",
    href: "/communaute",
  },
];

const QUICK_NAV = [
  { label: "Pam", href: "/pam", icon: Users },
  { label: "Pasteur Kongo", href: "/pasteur-kongo", icon: Users },
  { label: "Témoignages", href: "/temoignages", icon: FileText },
  { label: "Enseignements", href: "/enseignements", icon: BookOpen },
  { label: "Vidéos", href: "/videos", icon: Video },
  { label: "Bible", href: "/bible", icon: BookOpen },
  { label: "Calendrier", href: "/calendrier-biblique", icon: Calendar },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ═════ HERO ═════ */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-white">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop" alt="Ciel étoilé" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/80 via-[#2A0E3D]/90 to-[#1A0826]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#C9A227]">Un même appel, deux serviteurs</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6">
            Afrika Alkebulane Pamela Dali<br /><span className="text-[#C9A227]">& Pasteur Kongo</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-10">
            Témoignages, enseignements et vie de communauté, au service du rassemblement des fils d'Israël dispersés — en préparation au retour du Maître Yeshua, au son du chofar.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pam" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300">
              Découvrir le témoignage de Pam <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
            <Link href="/pasteur-kongo" className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300">
              Découvrir le Pasteur Kongo <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═════ STATS (réduit) ═════ */}
      <section className="py-12 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }} className="text-center">
                <div className="font-serif font-extrabold text-3xl md:text-4xl text-[#C9A227] mb-1">{stat.value}</div>
                <div className="text-xs text-[#8A8378] font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════ DEUX SERVITEURS (juste après stats) ═════ */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">Les serviteurs</p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E0F2B] leading-tight">
              Découvrez leur parcours
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
            {/* Pam */}
            <Link href="/pam" className="group bg-[#FAF6EF] rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 hover:shadow-xl transition-all duration-500">
              <div className="flex items-center justify-center w-20 h-20 rounded-full overflow-hidden bg-[#2A0E3D] mb-6 ring-2 ring-[#C9A227]/30 group-hover:ring-[#C9A227] transition-all">
                <Image
                  src="/pam.jpeg"
                  alt="Pam — Afrika Alkebulane Pamela Dali"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#1E0F2B] mb-3">Afrika Alkebulane Pamela Dali</h3>
              <p className="text-xs uppercase tracking-wide text-[#C9A227] font-semibold mb-3">Servante de l'Éternel</p>
              <p className="text-sm text-[#8A8378] leading-relaxed mb-6">
                Témoignages de visites au ciel, révélations prophétiques, enseignements sur la sanctification et le retour de Yeshua HaMashiach.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#C9A227] group-hover:gap-2 transition-all">
                Lire la biographie <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            {/* Center */}
            <div className="flex flex-col items-center justify-center p-8">
              <div className="w-px h-16 bg-[#C9A227]/30 mb-6 hidden lg:block" />
              <div className="text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#C9A227]/10 mb-4">
                  <Heart className="w-8 h-8 text-[#C9A227]" />
                </div>
                <p className="font-serif text-lg italic text-[#8A8378] text-center max-w-xs">
                  « Deux appels qui se rejoignent, deux ministères distincts qui s'articulent sans se confondre. »
                </p>
              </div>
              <div className="w-px h-16 bg-[#C9A227]/30 mt-6 hidden lg:block" />
            </div>

            {/* Pasteur Kongo */}
            <Link href="/pasteur-kongo" className="group bg-[#FAF6EF] rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 hover:shadow-xl transition-all duration-500">
              <div className="flex items-center justify-center w-20 h-20 rounded-full overflow-hidden bg-[#2A0E3D] mb-6 ring-2 ring-[#C9A227]/30 group-hover:ring-[#C9A227] transition-all">
                <Image
                  src="/pasteur-kongo.jpeg"
                  alt="Pasteur Kongo"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#1E0F2B] mb-3">Pasteur Kongo</h3>
              <p className="text-xs uppercase tracking-wide text-[#C9A227] font-semibold mb-3">Ministère pastoral</p>
              <p className="text-sm text-[#8A8378] leading-relaxed mb-6">
                Enseignements pastoraux, soins des brebis, discernement spirituel et accompagnement de la communauté dans la foi.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#C9A227] group-hover:gap-2 transition-all">
                Lire la biographie <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═════ DEUX VOIX, UNE MÊME VISION (features) ═════ */}
      <section className="py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">Ce que cette plateforme rassemble</p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E0F2B] leading-tight">Deux voix, une même vision</h2>
            <p className="text-base text-[#8A8378] mt-4 max-w-2xl mx-auto">
              Pam et le Pasteur Kongo exercent chacun un ministère distinct, uni par le mariage et par une même conviction : préparer les cœurs, transmettre ce qui a été reçu.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }}>
                  <Link href={feature.href} className="group block bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 h-full hover:shadow-xl transition-all duration-500">
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A227]/10 mb-6 group-hover:bg-[#C9A227]/20 transition-colors">
                      <Icon className="w-7 h-7 text-[#C9A227]" />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-[#1E0F2B] mb-3">{feature.title}</h3>
                    <p className="text-sm text-[#8A8378] leading-relaxed mb-4">{feature.description}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#C9A227] group-hover:gap-2 transition-all">Découvrir <ArrowRight className="w-4 h-4" /></span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════ DERNIER ENSEIGNEMENT ═════ */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">Le dernier enseignement</p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E0F2B] leading-tight">Pour approfondir la Parole</h2>
          </div>
          <div className="bg-[#FAF6EF] rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 md:p-12 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#8C5FA8]/10 text-[#8C5FA8] border border-[#8C5FA8]/20">Doctrine</span>
              <span className="text-xs text-[#8A8378]">Pam</span>
            </div>
            <h3 className="font-serif text-2xl font-bold text-[#1E0F2B] mb-4">La Véritable Nature du Saint-Esprit et la Trinité</h3>
            <p className="text-sm md:text-base text-[#1E0F2B]/70 leading-relaxed mb-6">
              Au ciel, il n'y a pas trois trônes pour le Père, le Fils et le Saint-Esprit. Il n'y a qu'un seul Trône, et c'est la même personne qui s'y manifeste sous différentes formes. Le Saint-Esprit est une personne réelle, douce et sensible...
            </p>
            <Link href="/enseignements" className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-[#C9A227] hover:bg-[#A3821C] text-[#1E0F2B] font-sans font-bold text-sm transition-all duration-300">
              Voir tous les enseignements <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═════ MARQUEE DE VERSETS (avec animation CSS) ═════ */}
      <section className="bg-[#2A0E3D] border-y border-[#C9A227]/20 py-6 overflow-hidden">
        <div className="flex items-center gap-8 whitespace-nowrap" style={{ animation: "marquee 30s linear infinite" }}>
          {[...VERSES, ...VERSES, ...VERSES].map((verse, i) => (
            <span key={i} className="inline-flex items-center gap-3 flex-shrink-0">
              <Sparkles className="w-3 h-3 text-[#C9A227]/60 flex-shrink-0" />
              <span className={i % 2 === 0 ? "font-serif italic text-[#FAF6EF]/80 text-lg" : "text-xs uppercase tracking-[0.2em] text-[#C9A227]/60 font-semibold"}>
                {verse}
              </span>
            </span>
          ))}
        </div>
        <style jsx>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-33.33%); }
          }
        `}</style>
      </section>

      {/* ═════ CTA COMMUNAUTÉ ═════ */}
      <section className="py-24 bg-[#2A0E3D] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-semibold mb-4">Communauté</p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#FAF6EF] leading-tight mb-6">Rejoignez les canaux d'échange</h2>
            <p className="text-base md:text-lg text-[#FAF6EF]/60 leading-relaxed max-w-2xl mx-auto mb-10">
              Des espaces d'échange organisés par thème, modérés avec attention, pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints chiffrés, intercession — à chacun son rythme.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/communaute" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300">
                Rejoindre la communauté <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
              <Link href="/communaute" className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300">
                <MessageSquare className="w-4 h-4 mr-2" /> Yeshua Connect
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═════ NAVIGATION RAPIDE (avec titre) ═════ */}
      <section className="py-20 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">Explorer la plateforme</p>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1E0F2B] leading-tight">
              Accès direct aux contenus
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {QUICK_NAV.map((item, i) => {
              const Icon = item.icon;
              return (
                <Link key={i} href={item.href} className="group flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 hover:border-[#C9A227]/40 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#C9A227]/10 group-hover:bg-[#C9A227]/20 transition-colors">
                    <Icon className="w-6 h-6 text-[#C9A227]" />
                  </div>
                  <span className="text-sm font-semibold text-[#1E0F2B]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
