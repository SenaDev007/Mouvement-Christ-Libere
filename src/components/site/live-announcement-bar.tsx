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

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });

  const formatDate = (date: Date) =>
    date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Porto-Novo" });

  const linkHref = isLive && live.youtubeUrl ? live.youtubeUrl : "/videos";
  const linkTarget = isLive && live.youtubeUrl ? "_blank" : undefined;

  return (
    <div
      className="live-announcement-bar relative overflow-hidden border-b z-30"
      style={{
        background: isLive
          ? "linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)"
          : "linear-gradient(90deg, #C9A227 0%, #DDBE55 50%, #C9A227 100%)",
        borderColor: isLive ? "rgba(127, 29, 29, 0.3)" : "rgba(156, 126, 30, 0.3)",
      }}
    >
      <div className="relative flex items-center justify-center gap-3 py-2.5 px-4 max-w-7xl mx-auto">
        {/* Point pulsant */}
        <span className="relative flex h-3 w-3 flex-shrink-0">
          {isLive && (
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: "#ffffff" }}
            />
          )}
          <span
            className="relative inline-flex rounded-full h-3 w-3"
            style={{ backgroundColor: isLive ? "#ffffff" : "#1E0F2B" }}
          />
        </span>

        {/* Badge statut */}
        <span
          className="text-xs uppercase tracking-[0.15em] font-bold flex-shrink-0"
          style={{ color: isLive ? "#ffffff" : "#1E0F2B", fontFamily: "var(--font-inter), 'Segoe UI', sans-serif" }}
        >
          {isLive ? "En direct" : "Direct programmé"}
        </span>

        {/* Séparateur */}
        <span
          className="text-sm flex-shrink-0"
          style={{ color: isLive ? "rgba(255,255,255,0.4)" : "rgba(30,15,43,0.3)" }}
        >
          |
        </span>

        {/* Titre du live */}
        <span
          className="text-sm font-semibold truncate"
          style={{ color: isLive ? "#ffffff" : "#1E0F2B", fontFamily: "var(--font-inter), 'Segoe UI', sans-serif" }}
        >
          {live.title} — {live.servantName}
          {!isLive && (
            <span style={{ opacity: 0.8, marginLeft: "4px" }}>
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
          className="live-action-btn flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105"
          style={{
            backgroundColor: isLive ? "#ffffff" : "#1E0F2B",
            color: isLive ? "#dc2626" : "#C9A227",
            fontFamily: "var(--font-inter), 'Segoe UI', sans-serif",
          }}
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
        className="live-shimmer absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
          animation: "liveShimmer 3s ease-in-out infinite",
        }}
      />
    </div>
  );
}
