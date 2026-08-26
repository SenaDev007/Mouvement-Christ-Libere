"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  ChevronRight,
  FileText,
  Rss,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownText } from "@/components/site/markdown-text";

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
  featured?: boolean;
}

const LEVEL_CONFIG = {
  DECOUVERTE: { label: "Découverte", color: "bg-state-success/15 text-state-success border-state-success/30" },
  INTERMEDIAIRE: { label: "Intermédiaire", color: "bg-[#C9A227]/15 text-[#A3821C] border-[#C9A227]/30" },
  AVANCE: { label: "Avancé", color: "bg-[#8C5FA8]/15 text-[#8C5FA8] border-[#8C5FA8]/30" },
} as const;

export function TeachingCard({
  title,
  excerpt,
  theme,
  book,
  level,
  readingTime,
  servantName,
  href,
  delay = 0,
  featured = false,
}: TeachingCardProps) {
  const levelConfig = LEVEL_CONFIG[level];

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className={cn(
        "group relative bg-[#FAF6EF] border rounded-2xl overflow-hidden transition-all duration-500 flex flex-col",
        featured
          ? "border-[#C9A227]/40 hover:border-[#C9A227] hover:shadow-[0_20px_60px_-20px_rgba(201,162,39,0.3)]"
          : "border-[#8A8378]/20 hover:border-[#C9A227]/40 hover:shadow-[0_15px_50px_-15px_rgba(42,14,61,0.2)]"
      )}
    >
      {/* Filet or supérieur */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#C9A227] via-[#C9A227]-light to-[#C9A227] opacity-60 group-hover:opacity-100 transition-opacity" />

      {/* Halo lumineux */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#C9A227]/0 group-hover:bg-[#C9A227]/10 blur-3xl transition-all duration-700 pointer-events-none" />

      <div className="relative z-10 p-6 flex flex-col flex-1">
        {/* En-tête : thème + niveau */}
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#A3821C] font-semibold">
            <BookOpen className="w-3 h-3" />
            {theme}
          </span>
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
              levelConfig.color
            )}
          >
            {levelConfig.label}
          </span>
        </div>

        {/* Titre */}
        <h3
          className={cn(
            "font-serif font-semibold text-[#1E0F2B] leading-snug mb-3 group-hover:text-[#A3821C] transition-colors",
            featured ? "text-2xl" : "text-lg"
          )}
        >
          {title}
        </h3>

        {/* Extrait */}
<<<<<<< HEAD
        <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-5 flex-1 line-clamp-3">
          {excerpt}
        </p>
=======
        <div className="text-sm text-ink/70 leading-relaxed mb-5 flex-1 line-clamp-3">
          <MarkdownText>{excerpt}</MarkdownText>
        </div>
>>>>>>> 0e4ca3c85bddb61fe50afe4bc108570dc67bf63b

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#8A8378]/15">
          <div className="flex items-center gap-3 text-[11px] text-[#8A8378]">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {book}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {readingTime}
            </span>
          </div>
          <span className="text-[11px] text-[#8A8378]">{servantName}</span>
        </div>

        {/* Actions au hover */}
        <div className="mt-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded text-[#8A8378] hover:text-[#C9A227] hover:bg-[#C9A227]/10 transition-colors"
              aria-label="PDF"
              onClick={(e) => e.preventDefault()}
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded text-[#8A8378] hover:text-[#C9A227] hover:bg-[#C9A227]/10 transition-colors"
              aria-label="RSS"
              onClick={(e) => e.preventDefault()}
            >
              <Rss className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded text-[#8A8378] hover:text-[#C9A227] hover:bg-[#C9A227]/10 transition-colors"
              aria-label="Email"
              onClick={(e) => e.preventDefault()}
            >
              <Mail className="w-3.5 h-3.5" />
            </button>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors group/cta"
          >
            Lire
            <ChevronRight className="w-3 h-3 transition-transform group-hover/cta:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
