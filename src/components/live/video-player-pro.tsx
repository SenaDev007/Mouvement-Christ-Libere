"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, Radio, Eye, Loader2, AlertCircle, SkipForward,
} from "lucide-react";

interface VideoPlayerProProps {
  // ⭐ V3.22 — RefObject<HTMLVideoElement | null> : typage React 19 (le ref
  // d'un élément vidéo peut valoir null avant montage — même usage qu'avant).
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isLive: boolean;
  viewerCount: number;
  connecting?: boolean;
  connectionError?: string;
  onRetry?: () => void;
}

/**
 * Lecteur vidéo professionnel façon YouTube Live.
 * Wrappe un élément <video> avec tous les contrôles :
 * - Play/Pause (clic sur la vidéo ou bouton)
 * - Volume (mute/unmute + slider)
 * - Barre de progression (pour le replay, rouge pour le live)
 * - Plein écran
 * - Badge LIVE + viewers
 * - Auto-hide des contrôles après 3s
 * - Double-clic = plein écran
 */
export function VideoPlayerPro({
  videoRef,
  isLive,
  viewerCount,
  connecting = false,
  connectionError = "",
  onRetry,
}: VideoPlayerProProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Sync état vidéo ───
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      // Auto-play
      video.play().catch(() => {});
    };
    const onVolumeChange = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("volumechange", onVolumeChange);
    };
  }, [videoRef]);

  // ─── Play/Pause ───
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [videoRef]);

  // ─── Volume ───
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) {
      video.volume = 0.5;
    }
  }, [videoRef]);

  const handleVolumeChange = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const newVolume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.volume = newVolume;
    video.muted = newVolume === 0;
  }, [videoRef]);

  // ─── Plein écran ───
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ─── Auto-hide contrôles ───
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showVolumeSlider && !showSettings) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, showVolumeSlider, showSettings]);

  useEffect(() => {
    showControlsTemporarily();
    return () => {
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [showControlsTemporarily]);

  // ─── Seek (pour replay) ───
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration || isLive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * duration;
  }, [videoRef, duration, isLive]);

  // ─── Playback rate ───
  const changePlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  }, [videoRef]);

  // ─── Format temps ───
  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ─── Double-clic = plein écran ───
  const handleDoubleClick = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  // ─── Click = play/pause (avec délai pour distinguuer du double-clic) ───
  const handleClick = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
      return;
    }
    controlsTimeoutRef.current = setTimeout(() => {
      togglePlay();
      controlsTimeoutRef.current = null;
    }, 200);
  }, [togglePlay]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group select-none"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && !showVolumeSlider && !showSettings && setShowControls(false)}
    >
      {/* ─── Élément vidéo (rendu ici pour que les contrôles le wrappe) ─── */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      {/* ─── Overlay connexion ─── */}
      {connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center text-white">
            <Loader2 className="w-12 h-12 text-red-600 mx-auto mb-3 animate-spin" />
            <p className="text-sm font-medium">Connexion au live en cours...</p>
          </div>
        </div>
      )}

      {/* ─── Overlay erreur ─── */}
      {connectionError && !connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center text-white p-8 max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-lg font-bold mb-2">Impossible de se connecter au live</p>
            <p className="text-sm text-white/60 mb-4">{connectionError}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Badge LIVE (haut gauche) ─── */}
      {isLive && !connecting && (
        <div
          className={`absolute top-4 left-4 z-20 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            EN DIRECT
          </span>
        </div>
      )}

      {/* ─── Viewers (haut droite) ─── */}
      {isLive && !connecting && (
        <div
          className={`absolute top-4 right-4 z-20 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm">
            <Eye className="w-3 h-3" />
            {viewerCount}
          </span>
        </div>
      )}

      {/* ─── Bouton play central quand en pause ─── */}
      {!isPlaying && !connecting && !connectionError && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
          aria-label="Lire"
        >
          <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors">
            <Play className="w-10 h-10 text-white ml-1" fill="white" />
          </div>
        </button>
      )}

      {/* ─── Barre de contrôles (bas) ─── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Gradient de fond */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent h-24 pointer-events-none" />

        {/* Barre de progression (replay) ou barre live */}
        <div className="relative px-4 pt-2">
          {isLive ? (
            // Barre live — rouge fixe
            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full w-full bg-red-600 rounded-full" />
            </div>
          ) : (
            // Barre replay — seekable
            <div
              className="h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer group/bar relative"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-red-600 rounded-full relative"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
              </div>
            </div>
          )}
        </div>

        {/* Boutons contrôles */}
        <div className="relative flex items-center gap-2 px-4 py-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
            aria-label={isPlaying ? "Pause" : "Lecture"}
          >
            {isPlaying ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5" fill="white" />}
          </button>

          {/* Skip 10s (replay only) */}
          {!isLive && (
            <button
              onClick={() => {
                const v = videoRef.current;
                if (v) v.currentTime += 10;
              }}
              className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
              aria-label="Avancer de 10 secondes"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          )}

          {/* Volume */}
          <div
            className="flex items-center gap-1 group/vol"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={toggleMute}
              className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
              aria-label={isMuted ? "Activer le son" : "Couper le son"}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {/* Slider volume */}
            <div
              className={`overflow-hidden transition-all duration-200 ${showVolumeSlider ? "w-20 opacity-100" : "w-0 opacity-0"}`}
            >
              <div
                className="h-1 bg-white/20 rounded-full cursor-pointer relative"
                onClick={handleVolumeChange}
              >
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Temps (replay only) */}
          {!isLive && (
            <span className="text-xs text-white font-medium ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}

          {/* Badge LIVE au centre */}
          {isLive && (
            <span className="text-xs text-red-500 font-bold ml-1 flex items-center gap-1">
              <Radio className="w-3 h-3" />
              Direct
            </span>
          )}

          {/* Espace flexible */}
          <div className="flex-1" />

          {/* Paramètres (vitesse de lecture) */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
              aria-label="Paramètres"
            >
              <Settings className="w-5 h-5" />
            </button>
            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-lg p-2 min-w-[140px] border border-white/10">
                <p className="text-xs text-white/50 uppercase tracking-wider font-bold px-2 py-1">Vitesse</p>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={`block w-full text-left px-3 py-1.5 text-sm rounded transition-colors ${
                      playbackRate === rate ? "bg-white/10 text-white font-bold" : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {rate === 1 ? "Normal" : `${rate}x`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Plein écran */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
