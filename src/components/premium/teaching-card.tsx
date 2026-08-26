"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Clock, BookOpen } from "lucide-react";

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
    >
      <Link
        href={href}
        className="group block bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 h-full hover:shadow-xl transition-all duration-500"
      >
        {/* Theme + Level */}
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/20">{theme}</span>
          <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-[#2A0E3D]/5 text-[#2A0E3D]/70">{level}</span>
        </div>

        {/* Title */}
        <h3 className="font-serif text-lg font-bold text-[#1E0F2B] leading-snug mb-3 group-hover:text-[#C9A227] transition-colors line-clamp-2">{title}</h3>

        {/* Excerpt */}
        <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-5 line-clamp-3">{excerpt}</p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#8A8378]/15">
          <div className="flex items-center gap-3 text-[11px] text-[#8A8378]">
            <span className="font-medium text-[#2A0E3D]">{servantName}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{readingTime}</span>
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{book}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#C9A227] group-hover:gap-2 transition-all">
            Lire <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </Link>
    </motion.article>
  );
}
