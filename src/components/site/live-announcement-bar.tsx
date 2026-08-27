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

  // Couleur or pour programmé, vert pour live
  const bgGradient = isLive
    ? "linear-gradient(90deg, #16a34a 0%, #15803d 100%)"
    : "linear-gradient(90deg, #C9A227 0%, #DDBE55 50%, #C9A227 100%)";

  // Texte complet à faire défiler
  const announcementText = isLive
    ? `${live.title} — ${live.servantName} est en direct maintenant !`
    : `${live.title} — ${live.servantName} • ${formatDate(scheduledDate)} à ${formatTime(scheduledDate)}${isToday ? " (aujourd'hui)" : ""}`;

  return (
    <div
      className="live-announcement-bar relative w-full overflow-hidden border-b"
      style={{
        background: bgGradient,
        borderColor: isLive ? "rgba(20, 83, 45, 0.3)" : "rgba(156, 126, 30, 0.3)",
      }}
    >
      <div className="relative flex items-center py-2 px-4 gap-2.5">
        {/* Icône fixe à gauche */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLive ? (
            <Radio className="w-4 h-4" style={{ color: "#ffffff" }} />
        ) : (
            <Tv className="w-4 h-4" style={{ color: "#1E0F2B" }} />
          )}
          {/* Point clignotant */}
          <span className="relative flex h-3 w-3">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: isLive ? "#4ade80" : "#dc2626" }}
            />
            <span
              className="relative inline-flex rounded-full h-3 w-3"
              style={{ backgroundColor: isLive ? "#4ade80" : "#dc2626" }}
            />
          </span>
          {/* Badge statut */}
          <span
            className="text-xs uppercase tracking-[0.12em] font-bold whitespace-nowrap"
            style={{ color: isLive ? "#ffffff" : "#1E0F2B" }}
          >
            {isLive ? "En direct" : "Direct programmé"}
          </span>
        </div>

        {/* Séparateur fixe */}
        <span style={{ color: isLive ? "rgba(255,255,255,0.3)" : "rgba(30,15,43,0.2)" }}>|</span>

        {/* Zone de texte défilant (marquee) */}
        <div className="flex-1 overflow-hidden min-w-0">
          <div
            className="live-marquee-inner whitespace-nowrap"
            style={{
              animation: "liveMarquee 25s linear infinite",
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: isLive ? "#ffffff" : "#1E0F2B" }}
            >
              {announcementText}
            </span>
          </div>
        </div>

        {/* Bouton d'action fixe à droite — clignotant */}
        <Link
          href={linkHref}
          target={linkTarget}
          rel={linkTarget === "_blank" ? "noopener noreferrer" : undefined}
          className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all hover:scale-105"
          style={{
            backgroundColor: isLive ? "#ffffff" : "#1E0F2B",
            color: isLive ? "#15803d" : "#C9A227",
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
