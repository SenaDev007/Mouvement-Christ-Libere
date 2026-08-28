"use client";

import { useState, useEffect, useRef } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Radio, Eye, Calendar, AlertCircle,
  ThumbsUp, ThumbsDown, Share2, Bookmark, MoreHorizontal,
  CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { LiveChat } from "@/components/live/live-chat";
import { LiveReactions } from "@/components/live/live-reactions";
import { VideoPlayerPro } from "@/components/live/video-player-pro";

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
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 200) + 50);
  const [saved, setSaved] = useState(false);
  const [viewerCount, setViewerCount] = useState(live.viewerCount || 0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);

  // Compte à rebours
  useEffect(() => {
    if (live.status !== "SCHEDULED") return;
    const update = () => {
      const target = new Date(live.scheduledAt).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("Le live commence..."); window.location.reload(); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(days > 0 ? `${days}j ${hours}h ${minutes}m` : hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [live.status, live.scheduledAt]);

  // Polling statut
  useEffect(() => {
    if (live.status !== "SCHEDULED") return;
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/live/next");
        const data = await res.json();
        if (data.live?.id === live.id && data.live.status === "LIVE") window.location.reload();
      } catch {}
    };
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [live.status, live.id]);

  // Connexion LiveKit subscriber
  useEffect(() => {
    if (live.status !== "LIVE" || !live.livekitRoomName || live.youtubeUrl) return;

    const connectToRoom = async () => {
      setConnecting(true);
      setConnectionError("");
      try {
        const tokenRes = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: live.livekitRoomName, role: "subscriber", participantName: "Visiteur" }),
        });
        if (!tokenRes.ok) {
          const data = await tokenRes.json();
          throw new Error(data.error || "Token LiveKit indisponible");
        }
        const { token, url } = await tokenRes.json();

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        await room.connect(url, token);

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
          } else if (track.kind === Track.Kind.Audio) {
            const audioEl = document.createElement("audio");
            track.attach(audioEl);
            audioEl.play().catch(() => {});
          }
        });

        room.remoteParticipants.forEach((participant) => {
          participant.getTrackPublications().forEach((pub) => {
            if (pub.track && pub.track.kind === Track.Kind.Video && videoRef.current) {
              pub.track.attach(videoRef.current);
            } else if (pub.track && pub.track.kind === Track.Kind.Audio) {
              const audioEl = document.createElement("audio");
              pub.track.attach(audioEl);
              audioEl.play().catch(() => {});
            }
          });
        });

        setConnecting(false);
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : "Erreur de connexion");
        setConnecting(false);
      }
    };

    connectToRoom();
    return () => { if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; } };
  }, [live.status, live.livekitRoomName, live.youtubeUrl]);

  // Viewer count simulation
  useEffect(() => {
    if (!isLive) return;
    setViewerCount(Math.floor(Math.random() * 100) + 30);
    const interval = setInterval(() => {
      setViewerCount((prev) => Math.max(10, prev + Math.floor(Math.random() * 7) - 3));
    }, 5000);
    return () => clearInterval(interval);
  }, [isLive]);

  const accentColor = live.servantCode === "pam" ? "#C9A227" : "#8C5FA8";
  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : url;
  };

  const handleLike = () => {
    if (liked) { setLiked(false); setLikeCount((c) => c - 1); }
    else { setLiked(true); setLikeCount((c) => c + 1); if (disliked) setDisliked(false); }
  };
  const handleDislike = () => {
    if (disliked) setDisliked(false);
    else { setDisliked(true); if (liked) { setLiked(false); setLikeCount((c) => c - 1); } }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-[1800px] mx-auto px-2 md:px-4 py-2 md:py-4">
        <div className="grid lg:grid-cols-[1fr_400px] gap-4">
          {/* ═══ Colonne gauche : Vidéo + Infos ═══ */}
          <div className="space-y-3">
            {/* Conteneur vidéo */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
              {isLive && live.youtubeUrl && (
                <iframe src={getYouTubeEmbedUrl(live.youtubeUrl)} className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              )}
              {isLive && !live.youtubeUrl && (
                <VideoPlayerPro
                  videoRef={videoRef}
                  isLive={isLive}
                  viewerCount={viewerCount}
                  connecting={connecting}
                  connectionError={connectionError}
                  onRetry={() => window.location.reload()}
                />
              )}
              {live.status === "SCHEDULED" && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2A0E3D] to-[#0f0f0f]">
                  <div className="text-center text-white p-8 relative z-10">
                    <Calendar className="w-12 h-12 text-[#C9A227] mx-auto mb-4" />
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227] mb-2">Live programmé</p>
                    <p className="text-xl md:text-2xl font-bold mb-4">{new Date(live.scheduledAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold">{countdown}</div>
                  </div>
                </div>
              )}
              {live.status === "ENDED" && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f0f]">
                  <div className="text-center text-white p-8">
                    <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <p className="text-lg font-bold mb-2">Ce live est terminé</p>
                    <p className="text-sm text-white/50">Le replay sera disponible prochainement</p>
                  </div>
                </div>
              )}
              {/* Réactions flottantes */}
              {isLive && <LiveReactions liveId={live.id} isLive={isLive} />}
            </div>

            {/* ─── Titre ─── */}
            <h1 className="text-lg md:text-xl font-bold text-white leading-snug" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              {live.title}
            </h1>

            {/* ─── Barre chaîne + actions ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              {/* Gauche : chaîne */}
              <div className="flex items-center gap-3">
                {live.servantPortraitUrl ? (
                  <img src={live.servantPortraitUrl} alt={live.servantName} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: accentColor }}>
                    {live.servantName.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-white">{live.servantName}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white/50" />
                  </div>
                  <p className="text-xs text-white/50">{isLive ? "En direct" : "Diffusion à venir"}</p>
                </div>
                <button className="ml-2 px-4 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 transition-colors">
                  S'abonner
                </button>
              </div>

              {/* Droite : actions */}
              <div className="flex items-center gap-1">
                {/* Like / Dislike groupé */}
                <div className="flex items-center bg-white/10 rounded-full overflow-hidden">
                  <button onClick={handleLike} className="flex items-center gap-1.5 px-3 py-2 hover:bg-white/10 transition-colors">
                    <ThumbsUp className={`w-4 h-4 ${liked ? "text-[#C9A227] fill-[#C9A227]" : "text-white"}`} />
                    <span className="text-xs font-medium text-white">{likeCount}</span>
                  </button>
                  <div className="w-px h-5 bg-white/20" />
                  <button onClick={handleDislike} className="px-3 py-2 hover:bg-white/10 transition-colors">
                    <ThumbsDown className={`w-4 h-4 ${disliked ? "text-[#C9A227] fill-[#C9A227]" : "text-white"}`} />
                  </button>
                </div>

                {/* Partager */}
                <button className="flex items-center gap-1.5 px-3 py-2 bg-white/10 rounded-full hover:bg-white/15 transition-colors">
                  <Share2 className="w-4 h-4 text-white" />
                  <span className="text-xs font-medium text-white hidden sm:inline">Partager</span>
                </button>

                {/* Enregistrer */}
                <button onClick={() => setSaved(!saved)} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 rounded-full hover:bg-white/15 transition-colors">
                  <Bookmark className={`w-4 h-4 ${saved ? "text-[#C9A227] fill-[#C9A227]" : "text-white"}`} />
                  <span className="text-xs font-medium text-white hidden sm:inline">Enregistrer</span>
                </button>

                {/* Plus */}
                <button className="p-2 bg-white/10 rounded-full hover:bg-white/15 transition-colors">
                  <MoreHorizontal className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* ─── Description repliable ─── */}
            <div className="bg-white/5 rounded-xl p-3 cursor-pointer" onClick={() => setShowDescription(!showDescription)}>
              {/* Ligne 1 : viewers + date */}
              <div className="flex items-center gap-2 text-xs mb-1">
                {isLive && (
                  <span className="font-bold text-white flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    {viewerCount} visionnages en cours
                  </span>
                )}
                <span className="text-white/50">
                  Diffusée le {new Date(live.startedAt || live.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              {/* Ligne 2 : description */}
              {live.description && (
                <div className="text-sm text-white/80">
                  <p className={`leading-relaxed ${showDescription ? "" : "line-clamp-2"}`}>
                    {live.description}
                  </p>
                  <button className="text-xs text-white/50 font-medium mt-1 flex items-center gap-1">
                    {showDescription ? (
                      <><ChevronUp className="w-3 h-3" />Afficher moins</>
                    ) : (
                      <><ChevronDown className="w-3 h-3" />...afficher plus</>
                    )}
                  </button>
                </div>
              )}

              {/* Liens plateformes */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                <span className="text-xs text-white/50">Regarder sur :</span>
                {live.youtubeUrl && (
                  <a href={live.youtubeUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-400 text-xs font-bold hover:bg-red-600/30 transition-colors">YouTube</a>
                )}
                {live.facebookUrl && (
                  <a href={live.facebookUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-bold hover:bg-blue-600/30 transition-colors">Facebook</a>
                )}
                {live.tiktokUrl && (
                  <a href={live.tiktokUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors">TikTok</a>
                )}
              </div>
            </div>
          </div>

          {/* ═══ Colonne droite : Chat ═══ */}
          <div className="h-[calc(100vh-120px)] lg:h-auto lg:max-h-[calc(100vh-100px)]">
            <LiveChat liveId={live.id} isLive={isLive} />
          </div>
        </div>
      </div>
    </div>
  );
}
