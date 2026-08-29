"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Radio, Clock, Play, ChevronLeft, ChevronRight } from "lucide-react";

interface UpcomingLive {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  servantName: string;
  servantCode: string;
  thumbnailUrl: string | null;
}

/**
 * Miniature du prochain live qui flotte en HAUT du hero.
 * Carrousel : si plusieurs lives sont programmés, ils défilent automatiquement.
 */
export function UpcomingLiveFloat() {
  const [lives, setLives] = useState<UpcomingLive[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await apiFetch("/api/live/upcoming");
      const data = await res.json();
      if (data.lives && data.lives.length > 0) {
        // Filter lives that have thumbnails
        const withThumbs = data.lives.filter((l: UpcomingLive) => l.thumbnailUrl);
        setLives(withThumbs);
        if (currentIndex >= withThumbs.length) setCurrentIndex(0);
      } else {
        setLives([]);
      }
    } catch {}
  }, [currentIndex]);

  useEffect(() => {
    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 30000);
    return () => clearInterval(interval);
  }, [fetchUpcoming]);

  // Auto-rotate carousel every 5 seconds if multiple lives — PAUSE au survol
  useEffect(() => {
    if (lives.length <= 1 || isHovered) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % lives.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [lives.length, isHovered]);

  const live = lives[currentIndex];

  useEffect(() => {
    if (!live || live.status !== "SCHEDULED") return;
    const update = () => {
      const target = new Date(live.scheduledAt).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("À venir"); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (days > 0) setCountdown(`${days}j ${hours}h`);
      else if (hours > 0) setCountdown(`${hours}h ${minutes}min`);
      else setCountdown(`${minutes}min`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [live]);

  if (!live || !live.thumbnailUrl) return null;

  const isLive = live.status === "LIVE";

  const goToPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + lives.length) % lives.length);
  };
  const goToNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % lives.length);
  };

  return (
    <Link
      href={`/live/${live.id}`}
      className="absolute top-4 right-4 z-30 group hidden sm:block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        {/* Halo pulsatile */}
        <div
          className={`absolute -inset-2 rounded-2xl blur-lg ${isLive ? "bg-green-500/40" : "bg-red-600/30"}`}
          style={{ animation: "livePulse 2s ease-in-out infinite" }}
        />

        {/* Carte */}
        <div className="relative bg-[#1A0826]/80 backdrop-blur-md rounded-2xl overflow-hidden border border-[#C9A227]/30 shadow-2xl w-64 transition-all group-hover:scale-105">
          {/* Miniature */}
          <div className="relative aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={live.thumbnailUrl}
              alt={live.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0826] via-[#1A0826]/20 to-transparent" />

            {/* Badge en HAUT: icône Radio */}
            {isLive ? (
              <div
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center"
                style={{ animation: "livePulse 2s ease-in-out infinite" }}
              >
                <Radio className="w-4 h-4 text-white" fill="white" />
              </div>
            ) : (
              <div
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-red-600 flex items-center justify-center"
                style={{ animation: "badgeSlide 3s ease-in-out infinite" }}
              >
                <Radio className="w-4 h-4 text-white" fill="white" />
              </div>
            )}

            {/* Carrousel navigation si plusieurs lives */}
            {lives.length > 1 && (
              <>
                <button
                  onClick={goToPrev}
                  className="absolute top-1/2 left-1 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute top-1/2 right-1 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                {/* Dots indicator */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1">
                  {lives.map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? "bg-[#C9A227] w-3" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Titre en bas de la miniature */}
            <p className="absolute bottom-2 left-3 right-3 text-sm font-bold text-white line-clamp-1 drop-shadow-lg">
              {live.title}
            </p>
          </div>

          {/* Barre avec statut + action */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#1A0826]">
            {isLive ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-600/20 border border-green-500/30 text-[10px] font-bold text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  EN COURS
                </span>
                <div className="flex-shrink-0 px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center gap-1">
                  <Play className="w-2.5 h-2.5" fill="currentColor" />
                  Rejoindre
                </div>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/20 border border-red-500/30 text-[10px] font-bold text-red-400">
                  <Radio className="w-2.5 h-2.5" />
                  LIVE À VENIR
                </span>
                <div className="flex-shrink-0 px-3 py-1 rounded-full bg-[#C9A227] text-[#1E0F2B] text-[10px] font-bold flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {countdown}
                </div>
              </>
            )}
          </div>

          {/* Compteur de lives si plusieurs */}
          {lives.length > 1 && (
            <div className="px-3 py-1 bg-[#1A0826]/50 text-center">
              <span className="text-[9px] text-white/40">
                {currentIndex + 1} / {lives.length} lives programmés
              </span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes livePulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }
        @keyframes badgeSlide {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(6px); }
          75% { transform: translateX(-6px); }
        }
      `}</style>
    </Link>
  );
}
