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
      className="relative bg-gradient-to-r from-state-danger/20 via-state-danger/10 to-state-danger/20 border-y border-state-danger/30 overflow-hidden"
    >
      {/* Effet de scan lumineux */}
      {isLive && (
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-state-danger/10 to-transparent pointer-events-none"
        />
      )}

      <div className="container mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.2em] font-bold bg-state-danger text-[#FAF6EF]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FAF6EF] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#FAF6EF]" />
            </span>
            {isLive ? "EN DIRECT" : "PROCHAIN DIRECT"}
          </span>
          <span className="text-sm font-medium text-[#1E0F2B] line-clamp-1">
            {title}
          </span>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-state-danger text-[#FAF6EF] text-xs font-semibold hover:bg-state-danger/90 transition-colors group"
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
      className="relative bg-[#2A0E3D] text-[#FAF6EF] rounded-2xl border border-[#C9A227]/30 overflow-hidden p-7"
    >
      {/* Décor fond */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8C5FA8]/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#DDBE55]/70 font-semibold mb-2">
          Prochain direct programmé
        </p>
        <h3 className="font-serif text-xl font-semibold text-[#FAF6EF] mb-3 leading-snug">
          {title}
        </h3>
        <p className="text-xs text-[#FAF6EF]/60 mb-5">
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
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#C9A227] text-[#1E0F2B] text-xs font-semibold hover:bg-[#DDBE55] transition-colors">
          <Bell className="w-3.5 h-3.5" />
          Recevoir une notification
        </button>
      </div>
    </motion.div>
  );
}
