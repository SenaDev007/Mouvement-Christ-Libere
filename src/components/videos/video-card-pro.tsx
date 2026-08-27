"use client";

import { motion } from "framer-motion";
import { Play, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoCardProProps {
  youtubeId: string;
  title: string;
  description: string;
  duration: string;
  views: number;
  publishedAt: string;
  servantName: string;
  servantCode: "pam" | "kongo";
  category: string;
  delay?: number;
  onClick: () => void;
}

export function VideoCardPro({
  youtubeId,
  title,
  description,
  duration,
  views,
  publishedAt,
  servantName,
  servantCode,
  category,
  delay = 0,
  onClick,
}: VideoCardProProps) {
  const formatViews = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v.toString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className="h-full"
    >
      <button
        onClick={onClick}
        className="group relative block w-full h-full text-left bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 border border-[#8A8378]/15"
      >
        {/* Miniature YouTube */}
        <div className="relative aspect-video bg-[#1A0826] overflow-hidden">
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
            alt={title}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500"
            loading="lazy"
          />
          {/* Overlay sombre */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A0826]/80 via-transparent to-transparent" />

          {/* Bouton play au centre */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A227]/90 group-hover:bg-[#C9A227] group-hover:scale-110 transition-all duration-300 shadow-lg">
              <Play className="w-6 h-6 text-[#1E0F2B] ml-0.5" fill="currentColor" />
            </div>
          </div>

          {/* Durée en bas à droite */}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
            {duration}
          </div>

          {/* Badge catégorie en haut à gauche */}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#2A0E3D]/80 backdrop-blur-sm text-[#C9A227] text-[9px] uppercase tracking-wider font-bold border border-[#C9A227]/30">
            {category}
          </div>

          {/* Badge serviteur en haut à droite */}
          <div className={cn(
            "absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold backdrop-blur-sm border",
            servantCode === "pam"
              ? "bg-[#8C5FA8]/30 text-[#FAF6EF] border-[#8C5FA8]/40"
              : "bg-[#5B7052]/30 text-[#FAF6EF] border-[#5B7052]/40"
          )}>
            {servantName}
          </div>
        </div>

        {/* Corps de la carte */}
        <div className="p-5">
          {/* Titre */}
          <h3 className="font-serif text-base font-bold text-[#1E0F2B] leading-snug mb-2 group-hover:text-[#C9A227] transition-colors line-clamp-2">
            {title}
          </h3>

          {/* Trait doré animé */}
          <div className="w-10 h-0.5 bg-[#C9A227]/30 mb-3 group-hover:w-16 group-hover:bg-[#C9A227] transition-all duration-500" />

          {/* Description */}
          <p className="text-xs text-[#1E0F2B]/60 leading-relaxed mb-4 line-clamp-2">
            {description}
          </p>

          {/* Pied de carte */}
          <div className="flex items-center gap-3 text-[10px] text-[#8A8378]">
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3 h-3 text-[#C9A227]" />
              {formatViews(views)} vues
            </span>
            <span className="text-[#8A8378]/40">·</span>
            <span>{formatDate(publishedAt)}</span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
