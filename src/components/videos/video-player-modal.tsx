"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Clock, Eye, Calendar, ChevronRight } from "lucide-react";

interface VideoPlayerModalProps {
  youtubeId: string;
  title: string;
  description: string;
  duration: string;
  views: number;
  publishedAt: string;
  servantName: string;
  onClose: () => void;
}

export function VideoPlayerModal({
  youtubeId,
  title,
  description,
  duration,
  views,
  publishedAt,
  servantName,
  onClose,
}: VideoPlayerModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!mounted) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatViews = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v.toString();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="bg-[#FAF6EF] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#2A0E3D] text-[#FAF6EF]">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-[#C9A227]" />
              <span className="text-xs uppercase tracking-[0.18em] font-bold text-[#C9A227]">
                Lecture en cours
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#FAF6EF]/10 transition-colors"
              title="Fermer (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lecteur YouTube intégré */}
          <div className="relative w-full bg-black" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>

          {/* Informations vidéo */}
          <div className="p-6 md:p-8">
            <h2 className="font-serif text-xl md:text-2xl font-bold text-[#1E0F2B] leading-snug mb-3">
              {title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 mb-5 text-xs text-[#8A8378]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#2A0E3D]">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2A0E3D]">
                  <span className="text-[9px] font-bold text-[#C9A227]">
                    {servantName.charAt(0).toUpperCase()}
                  </span>
                </div>
                {servantName}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#C9A227]" />
                {duration}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-[#C9A227]" />
                {formatViews(views)} vues
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
                {formatDate(publishedAt)}
              </span>
            </div>

            <div className="w-16 h-0.5 bg-[#C9A227] mb-4" />

            <p className="text-sm md:text-base text-[#1E0F2B]/80 leading-relaxed mb-6">
              {description}
            </p>

            <a
              href={`https://www.youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C9A227] hover:text-[#9C7E1E] transition-colors"
            >
              Voir sur YouTube
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
