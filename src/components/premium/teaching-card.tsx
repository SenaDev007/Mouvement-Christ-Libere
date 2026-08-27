"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Clock, BookOpen, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeachingCardProps {
  title: string;
  excerpt: string;
  theme: string;
  book: string;
  level: "DECOUVERTE" | "INTERMEDIAIRE" | "AVANCE";
  readingTime: string;
  servantName: string;
  href: string;
  delay?: number;
}

export function TeachingCard({ title, excerpt, theme, book, level, readingTime, servantName, href, delay = 0 }: TeachingCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className="h-full"
    >
      <Link
        href={href}
        className="group relative block h-full bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 border border-[#8A8378]/15"
      >
        {/* Bande dorée supérieure */}
        <div className="h-1.5 bg-gradient-to-r from-[#C9A227] via-[#DDBE55] to-[#C9A227]" />

        {/* Corps de la carte */}
        <div className="p-6 md:p-7 flex flex-col h-full">
          {/* En-tête : icône enseignement + niveau */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/20 flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-[#C9A227]" />
            </div>
            <LevelBadge level={level} />
          </div>

          {/* Thème */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-[#C9A227]/10 text-[#9C7E1E] border border-[#C9A227]/20">
              {theme}
            </span>
          </div>

          {/* Titre */}
          <h3 className="font-serif text-lg md:text-xl font-bold text-[#1E0F2B] leading-snug mb-3 group-hover:text-[#C9A227] transition-colors line-clamp-2">
            {title}
          </h3>

          {/* Trait de séparation élégant */}
          <div className="w-12 h-0.5 bg-[#C9A227]/30 mb-3 group-hover:w-20 group-hover:bg-[#C9A227] transition-all duration-500" />

          {/* Résumé */}
          <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-5 line-clamp-3 flex-1">
            {excerpt}
          </p>

          {/* Référence biblique */}
          {book && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#C9A227]/8 text-[#9C7E1E] border border-[#C9A227]/15">
                <BookOpen className="w-3 h-3" />
                {book}
              </span>
            </div>
          )}

          {/* Pied de carte */}
          <div className="flex items-center justify-between pt-4 mt-auto border-t border-[#8A8378]/12">
            <div className="flex items-center gap-2.5">
              {/* Avatar serviteur */}
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#2A0E3D] flex-shrink-0">
                <span className="text-[10px] font-bold text-[#C9A227]">
                  {servantName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-[#2A0E3D] leading-tight">
                  {servantName}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#8A8378]">
                  <Clock className="w-2.5 h-2.5" />
                  {readingTime}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
              Étudier
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function LevelBadge({ level }: { level: string }) {
  if (level === "DECOUVERTE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#5B7052]/10 text-[#4A6042] border border-[#5B7052]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#5B7052]" />
        Découverte
      </span>
    );
  }
  if (level === "INTERMEDIAIRE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#C9A227]/10 text-[#9C7E1E] border border-[#C9A227]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]" />
        Intermédiaire
      </span>
    );
  }
  if (level === "AVANCE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#8C5FA8]/10 text-[#7C4A9A] border border-[#8C5FA8]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8C5FA8]" />
        Avancé
      </span>
    );
  }
  return null;
}
