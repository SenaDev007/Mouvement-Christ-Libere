"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Clock, BookOpen, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestimonyCardProps {
  title: string;
  short: string;
  themes: string[];
  bookRef?: string;
  servantName: string;
  readingTime: string;
  status: "CONFIRMED" | "TO_DISCERN" | "ARCHIVED";
  href: string;
  delay?: number;
}

export function TestimonyCard({ title, short, themes, bookRef, servantName, readingTime, status, href, delay = 0 }: TestimonyCardProps) {
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
          {/* En-tête : icône citation + statut */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/20 flex-shrink-0">
              <Quote className="w-4 h-4 text-[#C9A227]" />
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Thèmes */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {themes.slice(0, 2).map((theme) => (
              <span
                key={theme}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-[#8C5FA8]/8 text-[#7C4A9A] border border-[#8C5FA8]/15"
              >
                {theme}
              </span>
            ))}
          </div>

          {/* Titre */}
          <h3 className="font-serif text-lg md:text-xl font-bold text-[#1E0F2B] leading-snug mb-3 group-hover:text-[#C9A227] transition-colors line-clamp-2 break-words">
            {title}
          </h3>

          {/* Trait de séparation élégant */}
          <div className="w-12 h-0.5 bg-[#C9A227]/30 mb-3 group-hover:w-20 group-hover:bg-[#C9A227] transition-all duration-500" />

          {/* Résumé */}
          <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-5 line-clamp-3 flex-1">
            {short}
          </p>

          {/* Référence biblique */}
          {bookRef && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#C9A227]/8 text-[#9C7E1E] border border-[#C9A227]/15">
                <BookOpen className="w-3 h-3" />
                {bookRef}
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
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-[#2A0E3D] leading-tight break-words">
                  {servantName}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#8A8378]">
                  <Clock className="w-2.5 h-2.5" />
                  {readingTime}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
              Lire
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#5B7052]/10 text-[#4A6042] border border-[#5B7052]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#5B7052]" />
        Confirmé
      </span>
    );
  }
  if (status === "TO_DISCERN") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#B5502F]/10 text-[#B5502F] border border-[#B5502F]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B5502F]" />
        À discerner
      </span>
    );
  }
  return null;
}
