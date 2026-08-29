"use client";

import { apiFetch } from "@/lib/api-client";
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
        const res = await apiFetch("/api/live/next");
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

  const linkHref = live?.id ? `/live/${live.id}` : "/videos";
  const linkTarget = undefined;

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
        {/* Icône fixe à gauche — icône Radio clignotante (pas de TV, pas de point rouge) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Radio
            className="w-4 h-4"
            style={{ color: isLive ? "#ffffff" : "#1E0F2B", animation: "liveBtnBlink 1.5s ease-in-out infinite" }}
          />
          {/* Badge statut — desktop uniquement sur mobile on cache */}
          <span
            className="hidden sm:inline text-xs uppercase tracking-[0.12em] font-bold whitespace-nowrap"
            style={{ color: isLive ? "#ffffff" : "#1E0F2B" }}
          >
            {isLive ? "En direct" : "Direct programmé"}
          </span>
        </div>

        {/* Séparateur fixe — desktop uniquement */}
        <span className="hidden sm:inline" style={{ color: isLive ? "rgba(255,255,255,0.3)" : "rgba(30,15,43,0.2)" }}>|</span>

        {/* Zone de texte défilant (marquee) */}
        <div className="flex-1 overflow-hidden min-w-0">
          <div
            className="live-marquee-inner whitespace-nowrap"
            style={{
              animation: "liveMarquee 15s linear infinite",
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

        {/* Bouton d'action fixe à droite */}
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
              <span className="hidden sm:inline">Rejoindre</span>
              <span className="sm:hidden">Live</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Rejoindre</span>
              <span className="sm:hidden">Rejoindre</span>
              <ChevronRight className="w-3 h-3" />
            </>
          )}
          {isLive && <ChevronRight className="w-3 h-3" />}
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
