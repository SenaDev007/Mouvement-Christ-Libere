"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, BookOpen, FileText, Video, User } from "lucide-react";

const PAM_SECTIONS = [
  { label: "Biographie", href: "/biographie?servant=pam", icon: User, desc: "Le parcours de PAM, étape par étape — de l'enfance en Alkebulan aux enlèvements au ciel." },
  { label: "Témoignages", href: "/temoignages?servant=pam", icon: FileText, desc: "Récits d'enlèvements au ciel, visites du Paradis, paroles reçues du Seigneur Yeshoua." },
  { label: "Enseignements", href: "/enseignements?servant=pam", icon: BookOpen, desc: "Études bibliques : Hénoch, le rassemblement des dispersés, le chofar, le gouvernement de Yeshoua." },
  { label: "Vidéos & Lives", href: "/videos?servant=pam", icon: Video, desc: "Enseignements vidéo et lives de PAM, archivés dans leur intégralité." },
];

export default function PamPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[70vh] overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop"
            alt="Ciel étoilé"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/70 via-[#2A0E3D]/80 to-[#1A0826]" />
        </div>

        <div className="relative z-10 min-h-[70vh] flex items-center pt-20 pb-12">
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2 mb-6"
            >
              <span className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold">
                Servante de l'Éternel
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold text-[#FAF6EF] mb-4"
            >
              Afrika Alkebulane
              <br />
              <span className="text-[#C9A227]">Pamela Dali</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-lg md:text-xl text-[#FAF6EF]/70 leading-relaxed max-w-2xl mb-8"
            >
              Témoignages d&apos;enlèvements au ciel, instructions reçues du Seigneur Yeshoua.
              Figure contemporaine du patriarche Hénoch — celle qui marche avec Dieu.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <Link
                href="/temoignages?servant=pam"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap"
              >
                Découvrir les témoignages
                <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="bg-[#FAF6EF] py-20 md:py-24">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="grid md:grid-cols-2 gap-6">
            {PAM_SECTIONS.map((section, i) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={section.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link
                    href={section.href}
                    className="group block bg-[#FAF6EF] border border-[#8A8378]/20 rounded-card p-7 relative overflow-hidden hover:border-[#C9A227]/40 transition-all h-full"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#C9A227] opacity-60 group-hover:opacity-100" />
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded bg-[#2A0E3D]/10">
                        <Icon className="w-5 h-5 text-[#2A0E3D]" />
                      </div>
                      <h3 className="font-serif text-lg font-semibold text-[#1E0F2B]">{section.label}</h3>
                    </div>
                    <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-4">{section.desc}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#2A0E3D] group-hover:text-[#C9A227] transition-colors whitespace-nowrap">
                      Explorer
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Lien vers Pasteur Kongo */}
      <section className="bg-[#2A0E3D] py-16 text-center">
        <div className="container mx-auto max-w-2xl px-4">
          <p className="text-sm text-[#FAF6EF]/60 mb-4">Découvrez également</p>
          <Link
            href="/pasteur-kongo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-[#C9A227]/40 text-[#C9A227] font-semibold text-sm hover:bg-[#C9A227]/10 transition-colors whitespace-nowrap"
          >
            Le ministère du Pasteur Kongo
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
