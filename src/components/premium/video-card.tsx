"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Play, Eye, Calendar, ChevronRight, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  title: string;
  description: string;
  duration: string;
  views: number;
  date: string;
  href: string;
  servantPortrait: string;
  servantName: string;
  isLive?: boolean;
  delay?: number;
}

export function VideoCard({
  title,
  description,
  duration,
  views,
  date,
  href,
  servantPortrait,
  servantName,
  isLive = false,
  delay = 0,
}: VideoCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className="group cursor-pointer"
    >
      <Link href={href} className="block">
        {/* Thumbnail / Player placeholder */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#2A0E3D]">
          {/* Gradient background animé */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#2A0E3D] via-[#2A0E3D]-light to-[#2A0E3D]-dark" />

          {/* Pattern décoratif */}
          <div className="absolute inset-0 opacity-[0.07]">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
          </div>

          {/* Halo or au hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#C9A227]/0 via-[#C9A227]/0 to-[#C9A227]/0 group-hover:from-[#C9A227]/10 group-hover:via-[#C9A227]/0 group-hover:to-[#C9A227]/20 transition-all duration-700" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#C9A227]/20 blur-xl group-hover:bg-[#C9A227]/30 transition-all" />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full border-2 border-[#C9A227]/60 bg-[#1A0826]/40 backdrop-blur-sm group-hover:border-[#C9A227] group-hover:bg-[#C9A227]/20 group-hover:scale-110 transition-all duration-300">
                {isLive ? (
                  <Radio className="w-6 h-6 text-[#C9A227] fill-gold" />
                ) : (
                  <Play className="w-6 h-6 text-[#C9A227] fill-gold ml-1" />
                )}
              </div>
            </div>
          </div>

          {/* Badge LIVE ou Duration */}
          <div className="absolute bottom-3 right-3">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.18em] font-bold bg-state-danger text-[#FAF6EF]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FAF6EF] animate-pulse" />
                EN DIRECT
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-[#1A0826]/80 backdrop-blur-sm text-[#FAF6EF] text-[10px] font-semibold">
                {duration}
              </span>
            )}
          </div>

          {/* Portrait serviteur */}
          <div className="absolute top-3 left-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full border border-[#C9A227]/50 bg-[#1A0826]/60 backdrop-blur-sm">
              <span className="font-serif text-[10px] font-semibold text-[#C9A227]">
                {servantPortrait}
              </span>
            </div>
          </div>
        </div>

        {/* Contenu texte */}
        <div className="mt-3 px-1">
          <h3 className="font-serif text-base font-semibold text-[#1E0F2B] leading-snug mb-1.5 line-clamp-2 group-hover:text-[#A3821C] transition-colors">
            {title}
          </h3>
          <p className="text-xs text-[#8A8378] mb-2">{servantName}</p>
          <p className="text-xs text-[#1E0F2B]/60 line-clamp-2 mb-3 leading-relaxed">
            {description}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-[#8A8378]">
            {!isLive && (
              <span className="inline-flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {views.toLocaleString("fr-FR")}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
