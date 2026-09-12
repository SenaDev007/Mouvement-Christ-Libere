"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Radio, Bell, ChevronRight } from "lucide-react";

interface LiveBannerProps {
  title: string;
  href: string;
  isLive?: boolean;
}

export function LiveBanner({ title, href, isLive = true }: LiveBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative bg-gradient-to-r from-[#FF7A1A]/20 via-[#FF7A1A]/10 to-[#FF7A1A]/20 border-y border-[#FF7A1A]/30 overflow-hidden"
    >
      {/* Effet de scan lumineux */}
      {isLive && (
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#FF7A1A]/10 to-transparent pointer-events-none"
        />
      )}

      <div className="container mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          {/* V3.68 — badge « EN DIRECT » : accent feu, texte noir (AA 8,04:1) */}
          <span className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.2em] font-bold bg-[#FF7A1A] text-[#000000]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#000000] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#000000]" />
            </span>
            {isLive ? "EN DIRECT" : "PROCHAIN DIRECT"}
          </span>
          <span className="text-sm font-medium text-[#000000] line-clamp-1">
            {title}
          </span>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FF7A1A] text-[#000000] text-xs font-semibold hover:bg-[#FF7A1A]/90 transition-colors group"
        >
          <Radio className="w-3 h-3" />
          {isLive ? "Rejoindre le direct" : "Recevoir une notification"}
          <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </motion.div>
  );
}

interface NextLiveCardProps {
  title: string;
  scheduledAt: string;
  servantName: string;
  href: string;
}

export function NextLiveCard({ title, scheduledAt, servantName, href }: NextLiveCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative bg-[#000000] text-[#F0E9DE] rounded-2xl border border-[#C9A227]/30 overflow-hidden p-7"
    >
      {/* Décor fond */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8A857C]/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#DDBE55]/70 font-semibold mb-2">
          Prochain direct programmé
        </p>
        <h3 className="font-serif text-xl font-semibold text-[#F0E9DE] mb-3 leading-snug">
          {title}
        </h3>
        <p className="text-xs text-[#F0E9DE]/60 mb-5">
          {new Date(scheduledAt).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          à{" "}
          {new Date(scheduledAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {servantName}
        </p>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#C9A227] text-[#000000] text-xs font-semibold hover:bg-[#FF7A1A] transition-colors">
          <Bell className="w-3.5 h-3.5" />
          Recevoir une notification
        </button>
      </div>
    </motion.div>
  );
}
