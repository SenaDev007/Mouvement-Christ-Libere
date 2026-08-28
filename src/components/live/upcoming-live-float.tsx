"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Radio, Clock, Calendar, Play } from "lucide-react";

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
 * Affiche la miniature du prochain live qui flotte en HAUT du hero.
 * - Position: absolute top-4 right-4 (haut à droite du hero)
 * - Effet pulsatile pour attirer l'attention
 * - Badge fond transparent (ne cache pas le visage)
 * - Signal vert "En direct" quand le live est en cours
 */
export function UpcomingLiveFloat() {
  const [live, setLive] = useState<UpcomingLive | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const res = await fetch("/api/live/next");
        const data = await res.json();
        if (data.live && (data.live.status === "SCHEDULED" || data.live.status === "LIVE") && data.live.thumbnailUrl) {
          setLive(data.live);
        } else {
          setLive(null);
        }
      } catch {}
    };
    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!live || live.status !== "SCHEDULED") return;
    const update = () => {
      const target = new Date(live.scheduledAt).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("En cours..."); return; }
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

  return (
    <Link
      href={`/live/${live.id}`}
      className="absolute top-4 right-4 z-30 group"
    >
      <div className="relative">
        {/* Halo pulsatile */}
        <div
          className={`absolute -inset-1.5 rounded-xl blur-md ${isLive ? "bg-green-500/40" : "bg-[#C9A227]/40"}`}
          style={{ animation: "livePulse 2s ease-in-out infinite" }}
        />

        {/* Carte */}
        <div className="relative bg-[#1A0826]/80 backdrop-blur-md rounded-xl overflow-hidden border border-[#C9A227]/30 shadow-2xl w-56 transition-all group-hover:scale-105">
          {/* Miniature */}
          <div className="relative aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={live.thumbnailUrl} alt={live.title} className="w-full h-full object-cover" />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0826] via-transparent to-transparent" />

            {/* Badge — fond transparent, en haut à gauche */}
            {isLive ? (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                EN DIRECT
              </span>
            ) : (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#C9A227]">
                <Calendar className="w-2.5 h-2.5" />
                LIVE À VENIR
              </span>
            )}

            {/* Titre en bas de la miniature */}
            <p className="absolute bottom-1.5 left-2 right-2 text-[11px] font-bold text-white line-clamp-1">
              {live.title}
            </p>
          </div>

          {/* Barre inférieure */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-[#1A0826]">
            <span className="text-[9px] text-white/50 truncate">
              {live.servantName}
              {!isLive && countdown && ` · ${countdown}`}
            </span>
            <div
              className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                isLive ? "bg-green-600 text-white" : "bg-[#C9A227] text-[#1E0F2B]"
              }`}
            >
              {isLive ? (
                <span className="flex items-center gap-0.5">
                  <Play className="w-2 h-2" fill="currentColor" />
                  Regarder
                </span>
              ) : (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2 h-2" />
                  {countdown}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes livePulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
      `}</style>
    </Link>
  );
}
