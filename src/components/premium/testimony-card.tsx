"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Clock, BookOpen, ChevronRight } from "lucide-react";
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
    >
      <Link
        href={href}
        className="group block bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8 h-full hover:shadow-xl transition-all duration-500"
      >
        {/* Themes */}
        <div className="flex items-center gap-2 mb-4">
          {themes.slice(0, 2).map((theme) => (
            <span key={theme} className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-[#8C5FA8]/10 text-[#8C5FA8] border border-[#8C5FA8]/20">
              {theme}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="font-serif text-lg font-bold text-[#1E0F2B] leading-snug mb-3 group-hover:text-[#C9A227] transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Short */}
        <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-5 line-clamp-3">{short}</p>

        {/* Book ref */}
        {bookRef && (
          <div className="mb-4 pb-4 border-b border-[#8A8378]/15">
            <p className="inline-flex items-center gap-1.5 text-xs text-[#8A8378]">
              <BookOpen className="w-3 h-3 text-[#C9A227]" />
              <span>{bookRef}</span>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          <div className="flex items-center gap-3 text-[11px] text-[#8A8378]">
            <span className="font-medium text-[#2A0E3D]">{servantName}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {readingTime}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#C9A227] group-hover:gap-2 transition-all">
            Lire <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </Link>
    </motion.article>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "CONFIRMED") {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#5B7052]/10 text-[#5B7052] border border-[#5B7052]/20">Confirmé</span>;
  }
  if (status === "TO_DISCERN") {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#B5502F]/10 text-[#B5502F] border border-[#B5502F]/20">À discerner</span>;
  }
  return null;
}
