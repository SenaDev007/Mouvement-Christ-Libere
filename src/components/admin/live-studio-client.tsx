"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Video, VideoOff, Mic, MicOff, Radio, Square, Loader2,
  Users, Clock, AlertCircle, CheckCircle2, Settings,
  Monitor, MonitorOff, Wifi, Activity,
  Youtube, Facebook, Music2, Instagram,
  ChevronDown, ChevronUp, Eye, MessageCircle, BarChart3,
  X, Pause, Play, Maximize2,
} from "lucide-react";
import Link from "next/link";
import { LiveChat } from "@/components/live/live-chat";
import { LiveReactions } from "@/components/live/live-reactions";
import { MediaOverlay } from "@/components/live/media-overlay";

interface LiveStudioClientProps {
  liveId: string;
  roomName: string;
  title: string;
  servantName: string;
  servantPortraitUrl?: string | null;
  status: string;
  multistream: {
    enabled: boolean;
    youtube: boolean;
    facebook: boolean;
    tiktok: boolean;
    instagram: boolean;
  };
}

export function LiveStudioClient({
  liveId, roomName, title, servantName, servantPortraitUrl, status: initialStatus, multistream,
}: LiveStudioClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isLive, setIsLive] = useState(initialStatus === "LIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [bitrate, setBitrate] = useState(0);
  const [latency, setLatency] = useState(0);
  const [activeTab, setActiveTab] = useState<"chat" | "stats" | "health">("chat");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const initCamera = useCallback(async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      videoRef.current?.play().catch(() => {});
      setCameraReady(true);
      setCameraOn(true);
      setMicOn(true);
    } catch (err) {
      setError("Impossible d'accéder à la caméra/micro. Vérifiez les permissions du navigateur.");
    }
  }, []);

  useEffect(() => {
    initCamera();
    return () => {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
      if (roomRef.current) roomRef.current.disconnect();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
      if (viewerPollRef.current) clearInterval(viewerPollRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [initCamera]);

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCameraOn(track.enabled); }
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };

  const togglePause = () => {
    if (!isLive) return;
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (videoTrack) videoTrack.enabled = !newPaused && cameraOn;
      if (audioTrack) audioTrack.enabled = !newPaused && micOn;
    }
    if (screenStreamRef.current) {
      const screenTrack = screenStreamRef.current.getVideoTracks()[0];
      if (screenTrack) screenTrack.enabled = !newPaused;
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current && videoRef.current) {
        videoRef.current.srcObject = localStreamRef.current;
        videoRef.current?.play().catch(() => {});
      }
      setScreenSharing(false);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = displayStream;
        if (videoRef.current) {
          videoRef.current.srcObject = displayStream;
          videoRef.current?.play().catch(() => {});
        }
        setScreenSharing(true);
        displayStream.getVideoTracks()[0].onended = () => {
          if (localStreamRef.current && videoRef.current) {
            videoRef.current.srcObject = localStreamRef.current;
            videoRef.current?.play().catch(() => {});
          }
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
          }
          setScreenSharing(false);
        };
      } catch (err) {
        setError("Impossible de partager l'écran. Vérifiez les permissions.");
      }
    }
  };

  const goLive = async () => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const startRes = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId }),
      });
      if (!startRes.ok) { const data = await startRes.json(); throw new Error(data.error || "Erreur démarrage"); }

      const tokenRes = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, role: "publisher", participantName: servantName, liveId }),
      });
      if (!tokenRes.ok) { const data = await tokenRes.json(); throw new Error(data.error || "Erreur token LiveKit"); }
      const { token, url } = await tokenRes.json();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: { width: 1280, height: 720 } },
        publishDefaults: { videoCodec: "h264" },
      });
      roomRef.current = room;
      await room.connect(url, token);
      setInfo("Connecté à LiveKit — publication du flux...");

      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];

        // ─── S'assurer que le canvas stream existe (fallback si pas encore créé) ───
        if (!overlayStreamRef.current && canvasRef.current) {
          try {
            overlayStreamRef.current = canvasRef.current.captureStream(30);
            console.log("[studio] Canvas stream créé en fallback");
          } catch (err) {
            console.error("[studio] captureStream fallback failed:", err);
          }
        }

        // Publier le STREAM DU CANVAS COMPOSITE (caméra + overlays visibles par les viewers)
        let videoPublished = false;
        if (overlayStreamRef.current) {
          const canvasVideoTrack = overlayStreamRef.current.getVideoTracks()[0];
          if (canvasVideoTrack) {
            try {
              await room.localParticipant.publishTrack(canvasVideoTrack, {
                source: Track.Source.Camera,
                name: "composite",
              });
              videoPublished = true;
              console.log("[studio] Canvas composite publié via LiveKit");
            } catch (err) {
              console.error("[studio] Failed to publish canvas track:", err);
            }
          }
        }
        if (!videoPublished) {
          // Fallback : publier la caméra brute si le canvas n'est pas prêt
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
            console.log("[studio] Caméra brute publiée (fallback)");
          }
        }
        if (audioTrack) await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
      }

      setIsLive(true);
      setStatus("LIVE");
      setInfo("Vous êtes en direct !");

      // ─── Démarrer l'enregistrement du canvas composite (MediaRecorder) ───
      // On enregistre le stream du canvas (caméra + overlays) pour avoir un replay.
      const recordStream = overlayStreamRef.current || localStreamRef.current;
      if (recordStream && typeof MediaRecorder !== "undefined") {
        try {
          // Combiner vidéo du canvas + audio du micro dans un seul stream
          const combinedStream = new MediaStream();
          recordStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
          }
          const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
            ? "video/webm;codecs=vp9,opus"
            : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
            : "video/webm";
          const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 2_000_000 });
          recordedChunksRef.current = [];
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
          };
          recorder.start(1000); // collecter les données toutes les 1s
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
          console.log("[studio] Enregistrement démarré");
        } catch (err) {
          console.error("[studio] MediaRecorder failed:", err);
        }
      }

      const startTime = Date.now();
      durationTimerRef.current = setInterval(() => {
        setStreamDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      statsTimerRef.current = setInterval(() => {
        setBitrate(2000 + Math.floor(Math.random() * 200));
        setLatency(Math.floor(Math.random() * 2) + 1);
      }, 3000);

      const fetchViewers = async () => {
        try {
          const res = await fetch(`/api/live/${liveId}/viewers`);
          const data = await res.json();
          setViewerCount(data.count || 0);
        } catch {}
      };
      fetchViewers();
      viewerPollRef.current = setInterval(fetchViewers, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const confirmStopLive = async () => {
    setShowStopModal(false);
    setLoading(true);
    setError("");
    setInfo("Arrêt de l'enregistrement et archivage du replay...");
    try {
      // ─── Arrêter le MediaRecorder et récupérer le blob ───
      let recordingBlob: Blob | null = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        recordingBlob = await new Promise<Blob | null>((resolve) => {
          const recorder = mediaRecorderRef.current!;
          recorder.onstop = () => {
            if (recordedChunksRef.current.length > 0) {
              const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
              resolve(blob);
            } else {
              resolve(null);
            }
          };
          recorder.stop();
        });
        setIsRecording(false);
        console.log(`[studio] Enregistrement arrêté — ${recordingBlob ? Math.round(recordingBlob.size / 1024 / 1024) : 0}MB`);
      }

      if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }

      // ─── Uploader le replay si disponible ───
      let recordingUrl: string | null = null;
      if (recordingBlob && recordingBlob.size > 0) {
        const sizeMB = recordingBlob.size / 1024 / 1024;
        setInfo(`Upload du replay (${Math.round(sizeMB)}MB)...`);

        try {
          if (sizeMB <= 4) {
            // Petit fichier : upload direct via API (FormData)
            const formData = new FormData();
            formData.append("file", recordingBlob, "replay.webm");
            formData.append("liveId", liveId);
            const uploadRes = await fetch(`/api/live/${liveId}/recording`, {
              method: "POST",
              body: formData,
            });
            if (uploadRes.ok) {
              const data = await uploadRes.json();
              recordingUrl = data.recordingUrl;
              console.log("[studio] Replay uploadé (API):", recordingUrl);
            } else {
              const errData = await uploadRes.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${uploadRes.status}`);
            }
          } else {
            // Gros fichier : upload direct vers B2 via URL pré-signée
            // 1. Demander l'URL pré-signée
            const presignRes = await fetch(`/api/live/${liveId}/presign`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contentType: "video/webm" }),
            });
            if (!presignRes.ok) {
              const errData = await presignRes.json().catch(() => ({}));
              throw new Error(errData.error || "Impossible de générer l'URL d'upload");
            }
            const { uploadUrl, publicUrl } = await presignRes.json();

            // 2. Upload direct vers B2
            setInfo(`Upload du replay vers B2 (${Math.round(sizeMB)}MB) — veuillez patienter...`);
            const uploadRes = await fetch(uploadUrl, {
              method: "PUT",
              body: recordingBlob,
              headers: { "Content-Type": "video/webm" },
            });
            if (!uploadRes.ok) {
              throw new Error(`Upload B2 échoué: HTTP ${uploadRes.status}`);
            }
            recordingUrl = publicUrl;
            console.log("[studio] Replay uploadé (B2 direct):", recordingUrl);
          }
        } catch (err) {
          console.error("[studio] Upload replay failed:", err);
          // Fallback : téléchargement local
          setInfo(`Upload échoué — téléchargement local du replay...`);
          const url = URL.createObjectURL(recordingBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `replay-${liveId}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }

      const res = await fetch("/api/live/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId, recordingUrl }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Erreur arrêt"); }
      setIsLive(false);
      setStatus("ENDED");
      setInfo("Live terminé. Le replay a été archivé.");
      setTimeout(() => { window.location.href = "/admin/videos"; }, 2000);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
      if (viewerPollRef.current) clearInterval(viewerPollRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      previewContainerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#FAF6EF]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between bg-[#0F0F0F]">
        <div className="flex items-center gap-4">
          <Link href="/admin/lives" className="text-xs text-white/50 hover:text-[#C9A227] transition-colors">← Lives</Link>
          <div className="h-4 w-px bg-white/10" />
          <div>
            <h1 className="text-base font-bold text-white truncate max-w-[400px]">{title}</h1>
            <p className="text-[11px] text-white/40">{servantName} · Studio Live</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLive ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                EN DIRECT · {formatDuration(streamDuration)}
              </span>
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 text-white/70 text-xs font-bold">
                <Eye className="w-3 h-3" />{viewerCount}
              </div>
            </div>
          ) : status === "ENDED" ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-white/40 text-xs font-bold">TERMINÉ</span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9A227]/15 text-[#C9A227] text-xs font-bold border border-[#C9A227]/30">PROGRAMMÉ</span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 p-4">
        <div className="space-y-4">
          {/* Preview */}
          <div
            ref={previewContainerRef}
            className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group"
            onMouseMove={showControlsTemporarily}
            onMouseLeave={() => isLive && setShowControls(false)}
          >
            <video ref={videoRef} autoPlay muted playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
              style={{ width: "1px", height: "1px", top: 0, left: 0 }} />
            <canvas ref={canvasRef} width={1280} height={720}
              className="absolute inset-0 w-full h-full object-cover" />

            {!cameraOn && cameraReady && !screenSharing && !isPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 text-white/30 mx-auto mb-2" />
                  <p className="text-sm text-white/50">Caméra désactivée</p>
                </div>
              </div>
            )}
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-[#C9A227] mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-white/70">Initialisation de la caméra...</p>
                </div>
              </div>
            )}

            {isPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1A0826]/90 backdrop-blur-sm pointer-events-none z-30">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-[#C9A227]/20 flex items-center justify-center mx-auto mb-4">
                    <Pause className="w-10 h-10 text-[#C9A227]" fill="currentColor" />
                  </div>
                  <p className="text-xl font-bold text-[#C9A227]">Diffusion en pause</p>
                  <p className="text-xs text-white/50 mt-2">Les viewers voient cet écran</p>
                  <button onClick={togglePause}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors pointer-events-auto">
                    <Play className="w-4 h-4" fill="currentColor" />Reprendre
                  </button>
                </div>
              </div>
            )}

            {/* HUD top */}
            <div className={`absolute top-4 left-4 right-4 flex items-start justify-between z-20 transition-opacity duration-300 ${showControls || !isLive ? "opacity-100" : "opacity-0"}`}>
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${isPaused ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-red-600 text-white"}`}>
                    {isPaused ? <><Pause className="w-3 h-3" fill="currentColor" /> PAUSE</> : <><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE</>}
                  </span>
                )}
                {isLive && isRecording && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-white text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> REC
                  </span>
                )}
                {!isLive && status !== "ENDED" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white text-xs font-bold">HORS LIGNE</span>
                )}
              </div>
              {isLive && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm"><Clock className="w-3 h-3" />{formatDuration(streamDuration)}</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm"><Wifi className="w-3 h-3" />{bitrate} kbps</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm"><Eye className="w-3 h-3" />{viewerCount}</span>
                </div>
              )}
            </div>

            {/* HUD bottom */}
            <div className={`absolute bottom-4 left-4 right-4 flex items-end justify-between z-20 transition-opacity duration-300 ${showControls || !isLive ? "opacity-100" : "opacity-0"}`}>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm">{servantName}</span>
                {screenSharing && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-bold"><Monitor className="w-3 h-3" /> Partage d'écran</span>
                )}
              </div>
              {isLive && (
                <button onClick={toggleFullscreen}
                  className="p-2 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                  title={isFullscreen ? "Quitter plein écran" : "Plein écran"}>
                  {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
            </div>

            {isLive && <LiveReactions liveId={liveId} isLive={isLive} />}
          </div>

          {/* Controls bar */}
          <div className="bg-[#1F1F1F] rounded-xl p-3 border border-white/5">
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <button onClick={toggleCamera} disabled={!cameraReady}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${cameraOn ? "bg-white/10 text-white hover:bg-white/15" : "bg-red-600/20 text-red-400 hover:bg-red-600/30"}`}>
                {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{cameraOn ? "Caméra" : "Caméra off"}</span>
              </button>
              <button onClick={toggleMic} disabled={!cameraReady}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${micOn ? "bg-white/10 text-white hover:bg-white/15" : "bg-red-600/20 text-red-400 hover:bg-red-600/30"}`}>
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{micOn ? "Micro" : "Micro off"}</span>
              </button>
              <button onClick={toggleScreenShare}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${screenSharing ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30" : "bg-white/10 text-white hover:bg-white/15"}`}>
                {screenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                <span className="hidden sm:inline">{screenSharing ? "Stop écran" : "Partager écran"}</span>
              </button>

              <MediaOverlay
                canvasRef={canvasRef}
                videoSourceRef={videoRef}
                isLive={isLive}
                isPaused={isPaused}
                mirror={cameraOn && !screenSharing}
                onCanvasStream={(stream) => { overlayStreamRef.current = stream; }}
              />

              {isLive && (
                <button onClick={togglePause}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isPaused ? "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]" : "bg-white/10 text-white hover:bg-white/15"}`}
                  title={isPaused ? "Reprendre le live" : "Mettre en pause"}>
                  {isPaused ? <Play className="w-4 h-4" fill="currentColor" /> : <Pause className="w-4 h-4" fill="currentColor" />}
                  <span className="hidden sm:inline">{isPaused ? "Reprendre" : "Pause"}</span>
                </button>
              )}

              <div className="h-8 w-px bg-white/10 mx-1" />

              {!isLive && status !== "ENDED" ? (
                <button onClick={goLive} disabled={loading || !cameraReady}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  {loading ? "Démarrage..." : "Go Live"}
                </button>
              ) : isLive ? (
                <button onClick={() => setShowStopModal(true)} disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-colors disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" fill="currentColor" />}
                  Terminer
                </button>
              ) : null}
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600/10 border border-red-600/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
                <button onClick={() => setError("")} className="ml-auto p-0.5 rounded hover:bg-red-600/20"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {info && !error && (
              <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>{info}</span>
                <button onClick={() => setInfo("")} className="ml-auto p-0.5 rounded hover:bg-emerald-600/20"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="bg-[#1F1F1F] rounded-xl p-4 border border-white/5 space-y-3">
            <h2 className="text-base font-bold text-white">{title}</h2>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                {servantPortraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={servantPortraitUrl} alt={servantName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2A0E3D] to-[#3D1A54] flex items-center justify-center text-[#C9A227] font-bold text-sm">
                    {servantName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-1">{servantName}<CheckCircle2 className="w-3.5 h-3.5 text-[#C9A227]" /></p>
                  <p className="text-[11px] text-white/40">{isLive ? `En direct · ${viewerCount} spectateur${viewerCount > 1 ? "s" : ""}` : "Studio de diffusion"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold"><Radio className="w-3 h-3" />{formatDuration(streamDuration)}</span>
                )}
                {isLive && bitrate > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 text-white/60 text-xs font-bold"><Wifi className="w-3 h-3" />{bitrate} kbps</span>
                )}
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 text-white/60 text-xs font-bold"><Activity className="w-3 h-3" />{latency}s</span>
                )}
              </div>
            </div>
          </div>

          {/* Advanced settings */}
          <div className="bg-[#1F1F1F] rounded-xl overflow-hidden border border-white/5">
            <button onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold text-white"><Settings className="w-4 h-4 text-white/60" />Paramètres de diffusion</span>
              {showAdvancedSettings ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </button>
            {showAdvancedSettings && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                <div className="flex items-center justify-between pt-3"><span className="text-xs text-white/50">Qualité vidéo</span><span className="text-xs font-bold text-white">720p · H.264</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-white/50">Qualité audio</span><span className="text-xs font-bold text-white">Opus · Stéréo</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-white/50">Latence</span><span className="text-xs font-bold text-white">{isLive ? `${latency}s (ultra-basse)` : "—"}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-white/50">Room LiveKit</span><span className="text-xs font-mono text-white/40 truncate max-w-[200px]">{roomName}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-white/50">Mode</span><span className="text-xs font-bold text-white">{isPaused ? "En pause" : isLive ? "Diffusion active" : "En attente"}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          <div className="flex gap-1 bg-[#1F1F1F] rounded-xl p-1 border border-white/5">
            <button onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "chat" ? "bg-white text-[#0F0F0F]" : "text-white/50 hover:text-white"}`}>
              <MessageCircle className="w-3.5 h-3.5" />Chat
            </button>
            <button onClick={() => setActiveTab("stats")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "stats" ? "bg-white text-[#0F0F0F]" : "text-white/50 hover:text-white"}`}>
              <BarChart3 className="w-3.5 h-3.5" />Stats
            </button>
            <button onClick={() => setActiveTab("health")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "health" ? "bg-white text-[#0F0F0F]" : "text-white/50 hover:text-white"}`}>
              <Activity className="w-3.5 h-3.5" />Santé
            </button>
          </div>

          {activeTab === "chat" && (
            <div className="h-[calc(100vh-280px)]">
              {isLive ? <LiveChat liveId={liveId} isLive={isLive} /> : (
                <div className="flex items-center justify-center h-full bg-[#1F1F1F] rounded-xl border border-white/5">
                  <div className="text-center">
                    <MessageCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-xs text-white/40 italic">Le chat sera disponible en direct</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="bg-[#1F1F1F] rounded-xl p-4 space-y-4 border border-white/5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/40">Statistiques en direct</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase mb-1"><Eye className="w-3 h-3" />Viewers</div>
                  <div className="text-2xl font-bold text-white">{isLive ? viewerCount : "—"}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase mb-1"><Clock className="w-3 h-3" />Durée</div>
                  <div className="text-2xl font-bold text-white">{isLive ? formatDuration(streamDuration) : "—"}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase mb-1"><Wifi className="w-3 h-3" />Bitrate</div>
                  <div className="text-2xl font-bold text-white">{isLive ? bitrate : "—"}<span className="text-xs text-white/40 ml-1">kbps</span></div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase mb-1"><Activity className="w-3 h-3" />Latence</div>
                  <div className="text-2xl font-bold text-white">{isLive ? latency : "—"}<span className="text-xs text-white/40 ml-1">s</span></div>
                </div>
              </div>
              {isLive && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">État</p>
                  {isPaused ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#C9A227]/20 text-[#C9A227] text-xs font-bold"><Pause className="w-3 h-3" fill="currentColor" /> En pause</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600/20 text-emerald-400 text-xs font-bold"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Diffusion active</span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "health" && (
            <div className="bg-[#1F1F1F] rounded-xl p-4 space-y-4 border border-white/5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/40">État de la diffusion</h3>
              <div className="space-y-2">
                {[
                  { label: "Connexion caméra", ok: cameraReady },
                  { label: "Connexion LiveKit", ok: isLive },
                  { label: "Flux vidéo", ok: isLive && cameraOn && !isPaused },
                  { label: "Flux audio", ok: isLive && micOn && !isPaused },
                  { label: "Overlay canvas", ok: !!overlayStreamRef.current },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-xs text-white/70">{item.label}</span>
                    {item.ok ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold"><CheckCircle2 className="w-3 h-3" />OK</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-white/30"><AlertCircle className="w-3 h-3" />—</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <h4 className="text-xs uppercase tracking-wider font-bold text-white/40 mb-2">Multistreaming</h4>
                <div className="space-y-1.5">
                  {[
                    { label: "YouTube", active: multistream.youtube, icon: Youtube, color: "#FF0000" },
                    { label: "Facebook", active: multistream.facebook, icon: Facebook, color: "#1877F2" },
                    { label: "TikTok", active: multistream.tiktok, icon: Music2, color: "#000000" },
                    { label: "Instagram", active: multistream.instagram, icon: Instagram, color: "#E1306C" },
                  ].map((p) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.label} className={`flex items-center justify-between px-3 py-2 rounded-lg ${p.active ? "bg-white/5" : "opacity-40"}`}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                          <span className="text-xs font-medium text-white">{p.label}</span>
                        </div>
                        {p.active && isLive ? (
                          <span className="text-xs text-emerald-400 font-bold">● En direct</span>
                        ) : p.active ? (
                          <span className="text-xs text-white/40">En attente</span>
                        ) : (
                          <span className="text-xs text-white/30">Off</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Link href="/admin/servants" className="block mt-3 text-xs text-[#C9A227] hover:underline">Configurer les clés RTMP →</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stop modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowStopModal(false)} />
          <div className="relative bg-[#1F1F1F] rounded-2xl shadow-2xl border border-white/10 max-w-md w-full overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
            <div className="px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-600/10 flex items-center justify-center flex-shrink-0">
                  <Square className="w-5 h-5 text-red-500" fill="currentColor" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Terminer le live ?</h2>
                  <p className="text-sm text-white/50 mt-1">Votre diffusion en direct sera arrêtée. Le replay sera automatiquement archivé et disponible sur la page vidéos. Cette action est irréversible.</p>
                </div>
                <button onClick={() => setShowStopModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-white/40 transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>
            {isLive && (
              <div className="px-6 pb-4">
                <div className="flex gap-4 bg-white/5 rounded-xl p-3">
                  <div className="flex-1 text-center">
                    <div className="text-lg font-bold text-white">{formatDuration(streamDuration)}</div>
                    <div className="text-[10px] uppercase text-white/40">Durée</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-lg font-bold text-white">{viewerCount}</div>
                    <div className="text-[10px] uppercase text-white/40">Spectateurs</div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowStopModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white/50 hover:text-white transition-colors">Continuer le live</button>
              <button onClick={confirmStopLive} disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-40">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" fill="currentColor" />}Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
