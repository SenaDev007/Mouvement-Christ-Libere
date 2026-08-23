"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, BookOpen, Share2, Clock } from "lucide-react";
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

export function TestimonyCard({
  title,
  short,
  themes,
  bookRef,
  servantName,
  readingTime,
  status,
  href,
  delay = 0,
}: TestimonyCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className="group relative bg-ivory border border-stone/20 rounded-card overflow-hidden hover:border-gold/40 hover:shadow-[0_15px_50px_-15px_rgba(42,14,61,0.2)] transition-all duration-500 flex flex-col"
    >
      {/* Filet or supérieur */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold via-gold-light to-gold opacity-60 group-hover:opacity-100 transition-opacity" />

      {/* Halo lumineux au hover */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gold/0 group-hover:bg-gold/10 blur-3xl transition-all duration-700 pointer-events-none" />

      <div className="relative z-10 p-6 flex flex-col flex-1">
        {/* En-tête : thème + statut */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            {themes.slice(0, 2).map((theme) => (
              <span
                key={theme}
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-semibold bg-lavender/10 text-lavender border border-lavender/20"
              >
                {theme}
              </span>
            ))}
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Titre */}
        <h3 className="font-serif text-lg font-semibold text-ink leading-snug mb-2 group-hover:text-gold-dark transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Résumé */}
        <p className="text-sm text-ink/70 leading-relaxed mb-4 flex-1 line-clamp-3">
          {short}
        </p>

        {/* Référence biblique */}
        {bookRef && (
          <div className="mb-4 pb-4 border-b border-stone/15">
            <p className="inline-flex items-center gap-1.5 text-xs text-stone">
              <BookOpen className="w-3 h-3 text-gold" />
              <span className="verse-ref">{bookRef}</span>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          <div className="flex items-center gap-3 text-[11px] text-stone">
            <span className="font-medium text-imperial/80">{servantName}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {readingTime}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded text-stone hover:text-gold hover:bg-gold/10 transition-colors"
              aria-label="Partager"
              onClick={(e) => e.preventDefault()}
            >
              <Share2 className="w-3 h-3" />
            </button>
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-imperial hover:text-gold transition-colors group/cta"
            >
              Lire
              <ChevronRight className="w-3 h-3 transition-transform group-hover/cta:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-state-success/15 text-state-success border border-state-success/30">
        <span className="w-1.5 h-1.5 rounded-full bg-state-success" />
        Confirmé
      </span>
    );
  }
  if (status === "TO_DISCERN") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gold/15 text-gold-dark border border-gold/30">
        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
        À discerner
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone/15 text-stone border border-stone/30">
      Archivé
    </span>
  );
}
