"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SectionDividerProps {
  variant?: "gold-line" | "ornament" | "star";
  className?: string;
}

export function SectionDivider({ variant = "gold-line", className }: SectionDividerProps) {
  if (variant === "star") {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="w-5 h-5 mx-3 text-gold"
          aria-hidden="true"
        >
          <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
        </svg>
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
      </div>
    );
  }

  if (variant === "ornament") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className={cn("flex items-center justify-center py-12", className)}
      >
        <div className="flex items-center gap-3">
          <div className="h-px w-24 bg-gradient-to-r from-transparent to-gold/60" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gold" />
            <div className="w-2 h-2 rotate-45 border border-gold/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-gold" />
          </div>
          <div className="h-px w-24 bg-gradient-to-l from-transparent to-gold/60" />
        </div>
      </motion.div>
    );
  }

  // gold-line (default)
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <div className="h-px w-full max-w-md bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
    </div>
  );
}

interface QuoteBlockProps {
  text: string;
  reference: string;
  variant?: "light" | "dark";
}

export function QuoteBlock({ text, reference, variant = "dark" }: QuoteBlockProps) {
  const isDark = variant === "dark";
  return (
    <div className="relative text-center max-w-4xl mx-auto px-4">
      {/* Guillemet décoratif */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-6 flex justify-center"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={cn("w-12 h-12", isDark ? "text-gold/60" : "text-gold")}
          aria-hidden="true"
        >
          <path d="M9.5 8C7 8 5 10 5 12.5S7 17 9.5 17c.3 0 .6 0 .9-.1-.6 1.2-1.8 2.1-3.4 2.4V21c3.4-.4 6-3.4 6-7V12.5C13 10 11 8 9.5 8zm9 0C16 8 14 10 14 12.5S16 17 18.5 17c.3 0 .6 0 .9-.1-.6 1.2-1.8 2.1-3.4 2.4V21c3.4-.4 6-3.4 6-7V12.5C22 10 20 8 18.5 8z" />
        </svg>
      </motion.div>

      <motion.blockquote
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className={cn(
          "font-serif text-2xl md:text-3xl lg:text-4xl font-medium leading-relaxed italic mb-6",
          isDark ? "text-ivory" : "text-ink"
        )}
      >
        « {text} »
      </motion.blockquote>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="flex items-center justify-center gap-3"
      >
        <div className="h-px w-12 bg-gold" />
        <span className="text-xs uppercase tracking-[0.25em] text-gold-light/80 font-semibold">
          {reference}
        </span>
        <div className="h-px w-12 bg-gold" />
      </motion.div>
    </div>
  );
}
