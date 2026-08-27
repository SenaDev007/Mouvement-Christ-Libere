"use client";

import { useState, useEffect, useRef } from "react";
import {
  Radio, Users, Clock, Calendar, Share2, AlertCircle,
  Play, Eye, ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface LiveViewerClientProps {
  live: {
    id: string;
    title: string;
    description: string;
    scheduledAt: string;
    startedAt: string | null;
    endedAt: string | null;
    status: string;
    servantName: string;
    servantCode: string;
    servantPortraitUrl: string | null;
    youtubeUrl: string | null;
    facebookUrl: string | null;
    tiktokUrl: string | null;
    livekitRoomName: string | null;
    viewerCount: number;
    thumbnailUrl: string | null;
  };
}

export function LiveViewerClient({ live }: LiveViewerClientProps) {
  const [countdown, setCountdown] = useState("");
  const [isLive, setIsLive] = useState(live.status === "LIVE");
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);

  // ─── Compte à rebours si programmé ───
  useEffect(() => {
    if (live.status !== "SCHEDULED") return;

    const update = () => {
      const target = new Date(live.scheduledAt).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown("Le live commence...");
        // Recharger la page pour vérifier le statut
        window.location.reload();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}j ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [live.status, live.scheduledAt]);

  // ─── Polling du statut si programmé ───
  useEffect(() => {
    if (live.status !== "SCHEDULED") return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/live/next`);
        const data = await res.json();
        if (data.live?.id === live.id && data.live.status === "LIVE") {
          window.location.reload();
        }
      } catch {
        // silent
      }
    };

    const interval = setInterval(checkStatus, 30000); // 30s
    return () => clearInterval(interval);
  }, [live.status, live.id]);

  // ─── Lecteur HLS si live en cours ───
  useEffect(() => {
    if (live.status !== "LIVE" || !live.livekitRoomName) return;

    // Pour LiveKit, on utiliserait le lecteur WebRTC natif
    // Pour l'instant, fallback sur YouTube si disponible
    if (live.youtubeUrl) return;

    // Si on a un hlsUrl, utiliser hls.js
    const loadHls = async () => {
      try {
        const Hls = (await import("hls.js")).default;
        if (videoRef.current && Hls.isSupported()) {
          const hls = new Hls({
            liveDurationInfinity: true,
            lowLatencyMode: true,
          });
          hlsRef.current = hls;
          // URL HLS serait construite depuis LiveKit
          // hls.loadSource(hlsUrl);
          // hls.attachMedia(videoRef.current);
        }
      } catch (err) {
        console.error("[live] HLS load error:", err);
      }
    };

    loadHls();
    return () => {
      if (hlsRef.current) {
        (hlsRef.current as { destroy: () => void }).destroy();
      }
    };
  }, [live.status, live.livekitRoomName, live.youtubeUrl]);

  const accentColor = live.servantCode === "pam" ? "#C9A227" : "#8C5FA8";

  return (
    <div className="min-h-screen bg-[#1A0826]">
      {/* ─── Lecteur vidéo ─── */}
      <div className="pt-20 px-4 pb-8">
        <div className="max-w-5xl mx-auto">
          {/* Conteneur vidéo */}
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
            {/* Si LIVE avec YouTube */}
            {isLive && live.youtubeUrl && (
              <iframe
                src={getYouTubeEmbedUrl(live.youtubeUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}

            {/* Si LIVE sans YouTube — lecteur WebRTC/HLS natif */}
            {isLive && !live.youtubeUrl && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            )}

            {/* Si programmé — compte à rebours */}
            {live.status === "SCHEDULED" && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2A0E3D] to-[#1A0826]">
                <div className="text-center text-[#FAF6EF] p-8">
                  {live.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={live.thumbnailUrl}
                      alt={live.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-20"
                    />
                  )}
                  <div className="relative z-10">
                    <Calendar className="w-12 h-12 text-[#C9A227] mx-auto mb-4" />
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227] mb-2">
                      Live programmé
                    </p>
                    <p className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
                      {new Date(live.scheduledAt).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-lg">
                      <Clock className="w-5 h-5" />
                      {countdown}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Si terminé — replay ou message */}
            {live.status === "ENDED" && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2A0E3D] to-[#1A0826]">
                <div className="text-center text-[#FAF6EF] p-8">
                  <AlertCircle className="w-12 h-12 text-[#8A8378] mx-auto mb-4" />
                  <p className="text-xl font-bold mb-2">Ce live est terminé</p>
                  <p className="text-sm text-[#FAF6EF]/60">
                    Le replay sera disponible prochainement
                  </p>
                </div>
              </div>
            )}

            {/* Badge LIVE */}
            {isLive && (
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold animate-pulse">
                  <Radio className="w-3 h-3" />
                  EN DIRECT
                </span>
              </div>
            )}

            {/* Spectateurs */}
            {isLive && (
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm">
                  <Eye className="w-3 h-3" />
                  {live.viewerCount}
                </span>
              </div>
            )}
          </div>

          {/* ─── Infos du live ─── */}
          <div className="mt-6 grid md:grid-cols-[1fr_300px] gap-6">
            {/* Contenu principal */}
            <div>
              <h1
                className="text-xl md:text-2xl font-bold text-[#FAF6EF] mb-3"
                style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
              >
                {live.title}
              </h1>

              {/* Serviteur */}
              <div className="flex items-center gap-3 mb-4">
                {live.servantPortraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={live.servantPortraitUrl}
                    alt={live.servantName}
                    className="w-10 h-10 rounded-full object-cover border-2"
                    style={{ borderColor: accentColor }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {live.servantName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-[#FAF6EF]">{live.servantName}</p>
                  <p className="text-xs text-[#FAF6EF]/60">
                    {isLive ? "En direct maintenant" : new Date(live.scheduledAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>

              {/* Description */}
              {live.description && (
                <div className="p-4 rounded-xl bg-[#FAF6EF]/5 border border-[#FAF6EF]/10">
                  <p className="text-sm text-[#FAF6EF]/80 leading-relaxed whitespace-pre-wrap">
                    {live.description}
                  </p>
                </div>
              )}

              {/* Boutons de partage */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-[#FAF6EF]/60 mr-2">Regarder sur :</span>
                {live.youtubeUrl && (
                  <a
                    href={live.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    YouTube
                  </a>
                )}
                {live.facebookUrl && (
                  <a
                    href={live.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Facebook
                  </a>
                )}
                {live.tiktokUrl && (
                  <a
                    href={live.tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    TikTok
                  </a>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#FAF6EF]/5 border border-[#FAF6EF]/10">
                <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227] mb-3">
                  Informations
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#FAF6EF]/60">Statut</span>
                    <span className="font-bold text-[#FAF6EF]">
                      {isLive ? "🟢 En direct" : live.status === "SCHEDULED" ? "🟡 Programmé" : "⚫ Terminé"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#FAF6EF]/60">Date</span>
                    <span className="font-bold text-[#FAF6EF]">
                      {new Date(live.scheduledAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#FAF6EF]/60">Heure</span>
                    <span className="font-bold text-[#FAF6EF]">
                      {new Date(live.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {isLive && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#FAF6EF]/60">Spectateurs</span>
                      <span className="font-bold text-[#FAF6EF] flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {live.viewerCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Link
                href={live.servantCode === "pam" ? "/pam" : "/pasteur-kongo"}
                className="block p-4 rounded-xl bg-[#FAF6EF]/5 border border-[#FAF6EF]/10 hover:border-[#C9A227]/30 transition-colors"
              >
                <p className="text-xs uppercase tracking-wider font-bold text-[#C9A227] mb-1">
                  Découvrir
                </p>
                <p className="text-sm font-bold text-[#FAF6EF]">
                  {live.servantName} →
                </p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
  }
  return url;
}
