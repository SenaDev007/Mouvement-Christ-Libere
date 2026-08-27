"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ChevronRight, Calendar, Clock } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch("/api/live/next");
        if (res.ok) {
          const data = await res.json();
          setLive(data.live);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchLive();
    // Poll toutes les 60s
    const interval = setInterval(fetchLive, 60000);
    return () => clearInterval(interval);
  }, []);

  // Ne pas afficher si pas de live ou en cours de chargement
  if (loading || !live) return null;

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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="overflow-hidden"
      >
        <div
          className={`relative overflow-hidden border-b ${
            isLive
              ? "bg-red-600/90 border-red-700/30"
              : "bg-[#C9A227]/95 border-[#9C7E1E]/30"
          }`}
        >
          {/* Animation de défilement (marquee) */}
          <div className="relative flex items-center py-2 px-4">
            {/* Point pulsant */}
            <div className="flex items-center gap-2 flex-shrink-0 mr-4">
              <span className="relative flex h-3 w-3">
                {isLive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isLive ? "bg-white" : "bg-[#1E0F2B]"
                  }`}
                ></span>
              </span>
              <span
                className={`text-xs uppercase tracking-[0.18em] font-bold ${
                  isLive ? "text-white" : "text-[#1E0F2B]"
                }`}
              >
                {isLive ? "En direct" : "Direct programmé"}
              </span>
            </div>

            {/* Texte défilant */}
            <div className="flex-1 overflow-hidden">
              <motion.div
                animate={{ x: ["100%", "-100%"] }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="whitespace-nowrap"
              >
                <span
                  className={`text-sm font-semibold ${
                    isLive ? "text-white" : "text-[#1E0F2B]"
                  }`}
                >
                  {isLive
                    ? `🔴 ${live.title} — ${live.servantName} est en direct maintenant !`
                    : `📺 ${live.title} — ${live.servantName} • ${formatDate(scheduledDate)} à ${formatTime(scheduledDate)}${isToday ? " (aujourd'hui)" : ""}`}
                </span>
              </motion.div>
            </div>

            {/* Bouton d'action */}
            <Link
              href={isLive && live.youtubeUrl ? live.youtubeUrl : "/videos"}
              target={isLive && live.youtubeUrl ? "_blank" : undefined}
              rel={isLive && live.youtubeUrl ? "noopener noreferrer" : undefined}
              className={`flex-shrink-0 ml-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 ${
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
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 2,
            }}
            className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
