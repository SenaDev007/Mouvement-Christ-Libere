"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Radio, Clock, Calendar, ChevronRight } from "lucide-react";

interface UpcomingLive {
  id: string;
  title: string;
  scheduledAt: string;
  servantName: string;
  servantCode: string;
  thumbnailUrl: string | null;
}

/**
 * Affiche la miniature du prochain live programmé en floating card sur le hero.
 * Ne s'affiche que s'il y a un live programmé (SCHEDULED) dans les prochaines 7 jours.
 */
export function UpcomingLiveFloat() {
  const [live, setLive] = useState<UpcomingLive | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const res = await fetch("/api/live/next");
        const data = await res.json();
        if (data.live && data.live.status === "SCHEDULED" && data.live.thumbnailUrl) {
          setLive(data.live);
        }
      } catch {}
    };
    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!live) return;
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

  const accentColor = live.servantCode === "pam" ? "#C9A227" : "#8C5FA8";

  return (
    <Link
      href={`/live/${live.id}`}
      className="absolute bottom-6 right-6 z-30 max-w-xs group"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-[#C9A227]/30 transition-all group-hover:scale-105 group-hover:shadow-3xl">
        {/* Miniature */}
        <div className="relative aspect-video overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={live.thumbnailUrl}
            alt={live.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* Badge "Live à venir" */}
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#C9A227] text-[#1E0F2B] text-[10px] font-bold">
              <Calendar className="w-2.5 h-2.5" />
              Live à venir
            </span>
          </div>

          {/* Compte à rebours */}
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 text-white text-[10px] font-bold backdrop-blur-sm">
              <Clock className="w-2.5 h-2.5" />
              {countdown}
            </span>
          </div>

          {/* Titre + serviteur en bas */}
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <p className="text-xs font-bold text-white line-clamp-1 mb-0.5">{live.title}</p>
            <p className="text-[10px] font-medium" style={{ color: accentColor === "#C9A227" ? "#DDBE55" : "#c4a8d4" }}>
              {live.servantName}
            </p>
          </div>
        </div>

        {/* Barre CTA */}
        <div className="px-3 py-2 flex items-center justify-between bg-[#2A0E3D]">
          <span className="text-[10px] text-[#FAF6EF]/70">
            {new Date(live.scheduledAt).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#C9A227]">
            Rejoindre
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}
