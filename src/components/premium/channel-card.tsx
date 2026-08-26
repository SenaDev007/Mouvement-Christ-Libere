"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Lock,
  Hash,
  Volume2,
  Megaphone,
  Users,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelCardProps {
  name: string;
  description: string;
  type: "TEXT" | "VOICE" | "VIDEO" | "ANNOUNCEMENT" | "RESTRICTED";
  members?: number;
  isEncrypted: boolean;
  href: string;
  delay?: number;
}

const TYPE_CONFIG = {
  TEXT: { icon: Hash, label: "Texte", color: "text-[#2A0E3D] bg-[#2A0E3D]/10" },
  VOICE: { icon: Volume2, label: "Voix", color: "text-[#8C5FA8] bg-[#8C5FA8]/10" },
  VIDEO: { icon: Volume2, label: "Vidéo", color: "text-[#8C5FA8] bg-[#8C5FA8]/10" },
  ANNOUNCEMENT: { icon: Megaphone, label: "Annonce", color: "text-[#A3821C] bg-[#C9A227]/10" },
  RESTRICTED: { icon: Lock, label: "Restreint", color: "text-state-danger bg-state-danger/10" },
} as const;

export function ChannelCard({
  name,
  description,
  type,
  members,
  isEncrypted,
  href,
  delay = 0,
}: ChannelCardProps) {
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "group relative p-6 rounded-2xl border transition-all duration-500",
        isEncrypted
          ? "bg-[#2A0E3D]/5 border-[#C9A227]/30 hover:border-[#C9A227]/60 hover:shadow-[0_10px_40px_-10px_rgba(201,162,39,0.2)]"
          : "bg-[#FAF6EF] border-[#8A8378]/20 hover:border-[#C9A227]/40 hover:shadow-[0_10px_40px_-10px_rgba(42,14,61,0.15)]"
      )}
    >
      {/* Halo au hover */}
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-[#C9A227]/0 group-hover:bg-[#C9A227]/10 blur-3xl transition-all duration-700 pointer-events-none" />

      <div className="relative z-10">
        {/* En-tête */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center w-11 h-11 rounded-md",
                config.color
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold text-[#1E0F2B] leading-tight">
                {name}
              </h3>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-semibold mt-0.5">
                Canal {config.label}
              </p>
            </div>
          </div>
          {isEncrypted && (
            <span
              title="Canal chiffré de bout en bout"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-[#C9A227]/15 text-[#A3821C] border border-[#C9A227]/30"
            >
              <Lock className="w-2.5 h-2.5" />
              E2E
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-5">
          {description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#8A8378]/15">
          {members !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#8A8378]">
              <Users className="w-3 h-3" />
              {members > 0 ? `${members} membres` : "Canal d'écoute"}
            </span>
          )}
          <Link
            href={href}
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold transition-colors group/cta ml-auto",
              type === "RESTRICTED"
                ? "text-[#8A8378] hover:text-[#C9A227]"
                : "text-[#2A0E3D] hover:text-[#C9A227]"
            )}
          >
            {type === "RESTRICTED" ? "Demander l'accès" : "Rejoindre"}
            <ChevronRight className="w-3 h-3 transition-transform group-hover/cta:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

interface SecureBannerProps {
  title: string;
  description: string;
}

export function SecureBanner({ title, description }: SecureBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative bg-[#2A0E3D] text-[#FAF6EF] rounded-2xl border border-[#C9A227]/30 overflow-hidden p-8"
    >
      {/* Décor fond */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 flex items-start gap-5">
        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[#C9A227]/15 border border-[#C9A227]/30 flex-shrink-0">
          <ShieldCheck className="w-6 h-6 text-[#C9A227]" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-semibold text-[#FAF6EF] mb-2">
            {title}
          </h3>
          <p className="text-sm text-[#FAF6EF]/80 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
