"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Radio, Clock, Calendar, ChevronRight, Play } from "lucide-react";

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
 * Affiche la miniature du prochain live juste sous la barre d'annonce.
 * - Position: sticky sous la barre d'annonce (pas en bas du hero)
 * - Effet pulsatile pour attirer l'attention
 * - Badge "Live à venir" avec fond transparent (ne cache pas le visage)
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
  const accentColor = live.servantCode === "pam" ? "#C9A227" : "#8C5FA8";

  return (
    <div className="relative w-full bg-[#1A0826] py-2 px-4 border-b border-[#C9A227]/10">
      <div className="max-w-7xl mx-auto flex items-center justify-center">
        <Link
          href={`/live/${live.id}`}
          className="group relative flex items-center gap-3 max-w-md w-full"
        >
          {/* Miniature avec effet pulsatile */}
          <div className="relative flex-shrink-0">
            {/* Halo pulsatile */}
            <div
              className={`absolute -inset-1 rounded-lg ${isLive ? "bg-green-500/30" : "bg-[#C9A227]/30"} blur-sm`}
              style={{ animation: "livePulse 2s ease-in-out infinite" }}
            />
            {/* Image */}
            <div className="relative w-20 h-12 rounded-md overflow-hidden border border-[#C9A227]/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={live.thumbnailUrl} alt={live.title} className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Texte */}
          <div className="flex-1 min-w-0">
            {/* Badge — fond transparent */}
            {isLive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                EN DIRECT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#C9A227] mb-0.5">
                <Calendar className="w-2.5 h-2.5" />
                LIVE À VENIR
              </span>
            )}
            <p className="text-xs font-bold text-white line-clamp-1">{live.title}</p>
            <p className="text-[10px] text-white/50">
              {live.servantName} {isLive ? "" : `· ${countdown}`}
            </p>
          </div>

          {/* Bouton */}
          <div
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all group-hover:scale-105 ${
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
        </Link>
      </div>

      <style jsx>{`
        @keyframes livePulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
