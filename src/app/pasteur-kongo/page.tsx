"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, BookOpen, FileText, Video, User, ArrowRight, Heart } from "lucide-react";

const KONGO_SECTIONS = [
  { label: "Biographie", href: "/biographie?servant=kongo", icon: User, desc: "Le parcours pastoral du Pasteur Kongo, son appel et son ministère." },
  { label: "Enseignements", href: "/enseignements?servant=kongo", icon: BookOpen, desc: "Études bibliques : fêtes de l'Éternel, discernement spirituel, prière fervente." },
  { label: "Vidéos & Lives", href: "/videos?servant=kongo", icon: Video, desc: "Enseignements vidéo et directs du Pasteur Kongo." },
  { label: "Communauté", href: "/communaute", icon: Heart, desc: "Berger de la communauté, accompagnement pastoral des croyants." },
];

export default function PasteurKongoPage() {
  return (
    <div className="min-h-screen">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[80vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-white">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop" alt="Bible" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/80 via-[#2A0E3D]/90 to-[#1A0826]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center justify-center gap-2 mb-6">
            <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#C9A227]">Ministère pastoral</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6">
            <span className="text-[#C9A227]">Pasteur</span> Kongo
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-10">
            Ministère pastoral complémentaire, enseignements et soins des brebis.
            Un berger qui marche aux côtés de Pam dans l'œuvre du Royaume.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }}>
            <Link href="/enseignements?servant=kongo" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300">
              Découvrir les enseignements <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ FEATURE CARDS ═══ */}
      <section className="py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {KONGO_SECTIONS.map((section, i) => {
              const Icon = section.icon;
              return (
                <motion.div key={section.label} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }}>
                  <Link href={section.href} className="group block bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 h-full hover:shadow-xl transition-all duration-500">
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A227]/10 mb-6 group-hover:bg-[#C9A227]/20 transition-colors">
                      <Icon className="w-7 h-7 text-[#C9A227]" />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-[#1E0F2B] mb-3">{section.label}</h3>
                    <p className="text-sm text-[#8A8378] leading-relaxed mb-4">{section.desc}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#C9A227] group-hover:gap-2 transition-all">Explorer <ArrowRight className="w-4 h-4" /></span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ CTA PAM ═══ */}
      <section className="py-24 bg-[#2A0E3D] relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-semibold mb-4">Découvrez également</p>
          <h2 className="font-serif text-2xl md:text-3xl font-extrabold text-[#FAF6EF] mb-8">Le témoignage de PAM</h2>
          <Link href="/pam" className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300">
            Voir Pam <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>
    </div>
  );
}
