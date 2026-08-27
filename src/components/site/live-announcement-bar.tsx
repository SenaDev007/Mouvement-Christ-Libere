"use client";

import { useState, useEffect } from "react";
import { Radio, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";

interface LiveAnnouncement {
  id: string;
  title: string;
  scheduledAt: string;
  status: "SCHEDULED" | "LIVE";
  servantName: string;
  youtubeUrl?: string | null;
}

export function LiveAnnouncementBar() {
  const [live, setLive] = useState<LiveAnnouncement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchLive = async () => {
      try {
        const res = await fetch("/api/live/next");
        if (res.ok) {
          const data = await res.json();
          setLive(data.live);
        }
      } catch {}
    };
    fetchLive();
    const interval = setInterval(fetchLive, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted || !live) return null;

  const isLive = live.status === "LIVE";
  const scheduledDate = new Date(live.scheduledAt);
  const now = new Date();
  const isToday = scheduledDate.toDateString() === now.toDateString();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Porto-Novo",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Africa/Porto-Novo",
    });
  };

  const linkHref = isLive && live.youtubeUrl ? live.youtubeUrl : "/videos";
  const linkTarget = isLive && live.youtubeUrl ? "_blank" : undefined;

  return (
    <div
      className={`relative overflow-hidden border-b z-30 ${
        isLive
          ? "bg-gradient-to-r from-red-600 to-red-700 border-red-800/30"
          : "bg-gradient-to-r from-[#C9A227] to-[#DDBE55] border-[#9C7E1E]/30"
      }`}
    >
      <div className="relative flex items-center justify-center gap-3 py-2.5 px-4">
        {/* Point pulsant */}
        <span className="relative flex h-3 w-3 flex-shrink-0">
          {isLive && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-3 w-3 ${
              isLive ? "bg-white" : "bg-[#1E0F2B]"
            }`}
          ></span>
        </span>

        {/* Badge statut */}
        <span
          className={`text-xs uppercase tracking-[0.15em] font-bold flex-shrink-0 ${
            isLive ? "text-white" : "text-[#1E0F2B]"
          }`}
        >
          {isLive ? "🔴 En direct" : "📺 Direct programmé"}
        </span>

        {/* Texte de l'annonce */}
        <span
          className={`text-sm font-semibold truncate ${
            isLive ? "text-white" : "text-[#1E0F2B]"
          }`}
        >
          {live.title} — {live.servantName}
          {!isLive && (
            <span className="opacity-80 ml-1">
              • {formatDate(scheduledDate)} à {formatTime(scheduledDate)}
              {isToday ? " (aujourd'hui)" : ""}
            </span>
          )}
        </span>

        {/* Bouton d'action */}
        <Link
          href={linkHref}
          target={linkTarget}
          rel={linkTarget === "_blank" ? "noopener noreferrer" : undefined}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 ${
            isLive
              ? "bg-white text-red-600 hover:bg-white/90"
              : "bg-[#1E0F2B] text-[#C9A227] hover:bg-[#1E0F2B]/90"
          }`}
        >
          {isLive ? (
            <>
              <Radio className="w-3.5 h-3.5" />
              Rejoindre
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5" />
              Rappel
            </>
          )}
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Effet de brillance (shimmer) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)`,
          animation: "shimmer 3s ease-in-out infinite",
        }}
      />
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
