"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Radio, Clock, Play } from "lucide-react";

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
 * - Taille: w-80 (320px) — plus grande
 * - Badge icône Radio rouge avec animation aller-retour gauche→droite
 * - Signal vert "EN DIRECT" quand le live est en cours
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
      if (diff <= 0) { setCountdown("Bientôt..."); return; }
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
          className={`absolute -inset-2 rounded-2xl blur-lg ${isLive ? "bg-green-500/40" : "bg-red-600/30"}`}
          style={{ animation: "livePulse 2s ease-in-out infinite" }}
        />

        {/* Carte — plus grande (w-80 = 320px) */}
        <div className="relative bg-[#1A0826]/80 backdrop-blur-md rounded-2xl overflow-hidden border border-[#C9A227]/30 shadow-2xl w-80 transition-all group-hover:scale-105">
          {/* Miniature */}
          <div className="relative aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={live.thumbnailUrl} alt={live.title} className="w-full h-full object-cover" />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0826] via-[#1A0826]/20 to-transparent" />

            {/* Badge avec icône Radio rouge + animation aller-retour */}
            {isLive ? (
              <div
                className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-600/90 backdrop-blur-sm"
                style={{ animation: "livePulse 2s ease-in-out infinite" }}
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[11px] font-bold text-white">EN DIRECT</span>
              </div>
            ) : (
              <div
                className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 backdrop-blur-sm"
                style={{ animation: "badgeSlide 3s ease-in-out infinite" }}
              >
                <Radio className="w-3.5 h-3.5 text-white" fill="white" />
                <span className="text-[11px] font-bold text-white">LIVE À VENIR</span>
              </div>
            )}

            {/* Titre en bas de la miniature */}
            <p className="absolute bottom-2 left-3 right-3 text-sm font-bold text-white line-clamp-1 drop-shadow-lg">
              {live.title}
            </p>
          </div>

          {/* Barre inférieure */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#1A0826]">
            <span className="text-[11px] text-white/60 truncate">
              {live.servantName}
              {!isLive && countdown && ` · ${countdown}`}
            </span>
            <div
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold ${
                isLive ? "bg-green-600 text-white" : "bg-[#C9A227] text-[#1E0F2B]"
              }`}
            >
              {isLive ? (
                <span className="flex items-center gap-1">
                  <Play className="w-2.5 h-2.5" fill="currentColor" />
                  Regarder
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {countdown}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes livePulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }
        @keyframes badgeSlide {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(8px); }
          75% { transform: translateX(-8px); }
        }
      `}</style>
    </Link>
  );
}
