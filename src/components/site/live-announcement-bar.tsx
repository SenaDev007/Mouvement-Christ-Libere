"use client";

import { useState, useEffect } from "react";
import { Tv, ChevronRight, Clock, Radio } from "lucide-react";
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

  // Couleurs : rouge pour programmé, vert pour live
  const bgColor = isLive
    ? "linear-gradient(90deg, #16a34a 0%, #15803d 100%)"
    : "linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)";
  const borderColor = isLive ? "rgba(20, 83, 45, 0.3)" : "rgba(127, 29, 29, 0.3)";

  return (
    <div
      className="live-announcement-bar relative w-full border-b"
      style={{ background: bgColor, borderColor }}
    >
      <div className="relative flex items-center justify-center gap-2.5 py-2 px-4 max-w-full mx-auto flex-wrap">
        {/* Icône TV / Radio */}
        {isLive ? (
          <Radio className="w-4 h-4 flex-shrink-0" style={{ color: "#ffffff" }} />
        ) : (
          <Tv className="w-4 h-4 flex-shrink-0" style={{ color: "#ffffff" }} />
        )}

        {/* Point clignotant — rouge si programmé, vert si live */}
        <span className="relative flex h-3 w-3 flex-shrink-0">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: isLive ? "#4ade80" : "#fca5a5" }}
          />
          <span
            className="relative inline-flex rounded-full h-3 w-3"
            style={{ backgroundColor: isLive ? "#4ade80" : "#f87171" }}
          />
        </span>

        {/* Badge statut */}
        <span
          className="text-xs uppercase tracking-[0.12em] font-bold flex-shrink-0"
          style={{ color: "#ffffff" }}
        >
          {isLive ? "En direct" : "Direct programmé"}
        </span>

        {/* Séparateur */}
        <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>

        {/* Titre du live — non tronqué */}
        <span
          className="text-sm font-semibold flex-shrink min-w-0"
          style={{ color: "#ffffff" }}
        >
          {live.title} — {live.servantName}
          {!isLive && (
            <span style={{ opacity: 0.8, marginLeft: "4px" }}>
              • {formatDate(scheduledDate)} à {formatTime(scheduledDate)}
              {isToday ? " (aujourd'hui)" : ""}
            </span>
          )}
        </span>

        {/* Bouton d'action — clignotant */}
        <Link
          href={linkHref}
          target={linkTarget}
          rel={linkTarget === "_blank" ? "noopener noreferrer" : undefined}
          className="live-action-btn flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all hover:scale-105"
          style={{
            backgroundColor: "#ffffff",
            color: isLive ? "#15803d" : "#dc2626",
            animation: "liveBtnBlink 1.5s ease-in-out infinite",
          }}
        >
          {isLive ? (
            <>
              <Radio className="w-3 h-3" />
              Rejoindre
            </>
          ) : (
            <>
              <Clock className="w-3 h-3" />
              Rappel
            </>
          )}
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Effet shimmer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
          animation: "liveShimmer 3s ease-in-out infinite",
        }}
      />
    </div>
  );
}
