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
 * Miniature du prochain live qui flotte en HAUT du hero.
 *
 * En HAUT de la miniature:
 * - Si SCHEDULED: icône Radio rouge seule (pas de texte) sur fond rouge
 * - Si LIVE: icône Radio verte seule sur fond vert
 *
 * En BAS (barre inférieure):
 * - Si SCHEDULED: "LIVE À VENIR" (texte rouge sur fond rouge léger) + compte à rebours
 * - Si LIVE: "EN COURS" (texte vert sur fond vert) + bouton "Rejoindre"
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
    const interval = setInterval(fetchUpcoming, 15000); // 15s pour plus de dynamisme
    return () => clearInterval(interval);
  }, []);

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

            {/* EN HAUT: icône Radio seule (pas de texte) */}
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

            {/* Titre en bas de la miniature */}
            <p className="absolute bottom-2 left-3 right-3 text-sm font-bold text-white line-clamp-1 drop-shadow-lg">
              {live.title}
            </p>
          </div>

          {/* EN BAS: barre avec statut + action */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#1A0826]">
            {isLive ? (
              <>
                {/* Statut: EN COURS (vert) */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-600/20 border border-green-500/30 text-[10px] font-bold text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  EN COURS
                </span>
                {/* Bouton: Rejoindre (vert) */}
                <div className="flex-shrink-0 px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center gap-1">
                  <Play className="w-2.5 h-2.5" fill="currentColor" />
                  Rejoindre
                </div>
              </>
            ) : (
              <>
                {/* Statut: LIVE À VENIR (rouge) */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/20 border border-red-500/30 text-[10px] font-bold text-red-400">
                  <Radio className="w-2.5 h-2.5" />
                  LIVE À VENIR
                </span>
                {/* Compte à rebours */}
                <div className="flex-shrink-0 px-3 py-1 rounded-full bg-[#C9A227] text-[#1E0F2B] text-[10px] font-bold flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {countdown}
                </div>
              </>
            )}
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
          25% { transform: translateX(6px); }
          75% { transform: translateX(-6px); }
        }
      `}</style>
    </Link>
  );
}
