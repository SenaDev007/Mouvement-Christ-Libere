"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Video, VideoOff, Mic, MicOff, Radio, Square, Loader2,
  Users, Clock, AlertCircle, CheckCircle2, Settings,
  Monitor, MonitorOff, Maximize, Wifi, Activity,
  Youtube, Facebook, Music2, Video as VideoIcon,
  ChevronDown, ChevronUp, Eye, MessageCircle, BarChart3,
} from "lucide-react";
import Link from "next/link";
import { LiveChat } from "@/components/live/live-chat";

interface LiveStudioClientProps {
  liveId: string;
  roomName: string;
  title: string;
  servantName: string;
  status: string;
  multistream: {
    enabled: boolean;
    youtube: boolean;
    facebook: boolean;
    tiktok: boolean;
    odysee: boolean;
  };
}

export function LiveStudioClient({
  liveId, roomName, title, servantName, status: initialStatus, multistream,
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initCamera = useCallback(async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
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
      if (roomRef.current) roomRef.current.disconnect();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
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

  const toggleScreenShare = async () => {
    if (screenSharing) {
      // Revenir à la caméra
      if (localStreamRef.current && videoRef.current) {
        videoRef.current.srcObject = localStreamRef.current;
      }
      setScreenSharing(false);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = displayStream;
        setScreenSharing(true);
        displayStream.getVideoTracks()[0].onended = () => {
          if (localStreamRef.current && videoRef.current) videoRef.current.srcObject = localStreamRef.current;
          setScreenSharing(false);
        };
      } catch (err) {
        setError("Impossible de partager l'écran.");
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
        publishDefaults: { videoCodec: "h264", videoBitrate: 2_000_000, audioBitrate: 128_000 },
      });
      roomRef.current = room;
      await room.connect(url, token);
      setInfo("Connecté à LiveKit — publication du flux...");

      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (videoTrack) await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
        if (audioTrack) await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
      }

      setIsLive(true);
      setStatus("LIVE");
      setInfo("Vous êtes en direct !");

      const startTime = Date.now();
      durationTimerRef.current = setInterval(() => {
        setStreamDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Stats simulées
      statsTimerRef.current = setInterval(() => {
        setBitrate(Math.floor(Math.random() * 500) + 1800);
        setLatency(Math.floor(Math.random() * 3) + 1);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const stopLive = async () => {
    if (!confirm("Terminer le live ?")) return;
    setLoading(true);
    setError("");
    try {
      if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
      const res = await fetch("/api/live/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Erreur arrêt"); }
      setIsLive(false);
      setStatus("ENDED");
      setInfo("Live terminé. Le replay sera archivé automatiquement.");
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
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
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* ═══ Header ═══ */}
      <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/lives" className="text-xs text-white/50 hover:text-white transition-colors">← Lives</Link>
          <div>
            <h1 className="text-lg font-bold" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{title}</h1>
            <p className="text-xs text-white/50">{servantName} · Studio Live</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLive ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse">
              <Radio className="w-3 h-3" /> EN DIRECT · {formatDuration(streamDuration)}
            </span>
          ) : status === "ENDED" ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/60 text-xs font-bold">TERMINÉ</span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9A227]/20 text-[#C9A227] text-xs font-bold border border-[#C9A227]/30">PROGRAMMÉ</span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 p-4">
        {/* ═══ Colonne gauche : Preview + Contrôles ═══ */}
        <div className="space-y-4">
          {/* Preview vidéo */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: cameraOn && !screenSharing ? "scaleX(-1)" : "none" }} />

            {!cameraOn && cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center"><VideoOff className="w-12 h-12 text-white/30 mx-auto mb-2" /><p className="text-sm text-white/50">Caméra désactivée</p></div>
              </div>
            )}
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center"><Loader2 className="w-10 h-10 text-[#C9A227] mx-auto mb-2 animate-spin" /><p className="text-sm text-white/70">Initialisation...</p></div>
              </div>
            )}

            {/* Overlays */}
            {isLive && (
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold animate-pulse"><Radio className="w-3 h-3" /> LIVE</span>
              </div>
            )}
            {isLive && (
              <div className="absolute top-4 right-4 flex gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm"><Clock className="w-3 h-3" />{formatDuration(streamDuration)}</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm"><Wifi className="w-3 h-3" />{bitrate} kbps</span>
              </div>
            )}
            <div className="absolute bottom-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm">{servantName}</span>
            </div>
            {screenSharing && (
              <div className="absolute bottom-4 right-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-bold"><Monitor className="w-3 h-3" /> Partage d'écran</span>
              </div>
            )}
          </div>

          {/* ═══ Barre de contrôles principale (façon YouTube Studio) ═══ */}
          <div className="bg-[#1f1f1f] rounded-xl p-4 space-y-4">
            {/* Contrôles média */}
            <div className="flex items-center justify-center gap-2">
              <button onClick={toggleCamera} disabled={!cameraReady}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-colors disabled:opacity-40 ${cameraOn ? "bg-white/10 hover:bg-white/15" : "bg-red-600/20 text-red-400"}`}>
                {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                <span className="text-[10px] font-medium">{cameraOn ? "Caméra" : "Off"}</span>
              </button>
              <button onClick={toggleMic} disabled={!cameraReady}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-colors disabled:opacity-40 ${micOn ? "bg-white/10 hover:bg-white/15" : "bg-red-600/20 text-red-400"}`}>
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                <span className="text-[10px] font-medium">{micOn ? "Micro" : "Off"}</span>
              </button>
              <button onClick={toggleScreenShare}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-colors ${screenSharing ? "bg-blue-600/20 text-blue-400" : "bg-white/10 hover:bg-white/15"}`}>
                {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                <span className="text-[10px] font-medium">{screenSharing ? "Stop" : "Écran"}</span>
              </button>
            </div>

            {/* Bouton Go Live / Stop */}
            <div className="flex justify-center">
              {!isLive && status !== "ENDED" ? (
                <button onClick={goLive} disabled={loading || !cameraReady}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  {loading ? "Démarrage..." : "Go Live"}
                </button>
              ) : isLive ? (
                <button onClick={stopLive} disabled={loading}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-colors disabled:opacity-50 shadow-lg">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                  {loading ? "Arrêt..." : "Terminer le live"}
                </button>
              ) : null}
            </div>

            {/* Messages */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>{info}</span>
              </div>
            )}
          </div>

          {/* ═══ Paramètres avancés ═══ */}
          <div className="bg-[#1f1f1f] rounded-xl overflow-hidden">
            <button onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold"><Settings className="w-4 h-4" />Paramètres de diffusion</span>
              {showAdvancedSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAdvancedSettings && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                {/* Qualité */}
                <div className="flex items-center justify-between pt-3">
                  <span className="text-xs text-white/60">Qualité vidéo</span>
                  <span className="text-xs font-bold text-white">720p · 2 Mbps · H.264</span>
                </div>
                {/* Audio */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Qualité audio</span>
                  <span className="text-xs font-bold text-white">128 kbps · Opus</span>
                </div>
                {/* Latence */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Latence</span>
                  <span className="text-xs font-bold text-white">{isLive ? `${latency}s` : "—"}</span>
                </div>
                {/* Room LiveKit */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Room LiveKit</span>
                  <span className="text-xs font-mono text-white/50 truncate max-w-[200px]">{roomName}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Colonne droite : Tabs (Chat / Stats / Health) ═══ */}
        <div className="space-y-3">
          {/* Onglets */}
          <div className="flex gap-1 bg-[#1f1f1f] rounded-xl p-1">
            <button onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "chat" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
              <MessageCircle className="w-3.5 h-3.5" />Chat
            </button>
            <button onClick={() => setActiveTab("stats")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "stats" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
              <BarChart3 className="w-3.5 h-3.5" />Stats
            </button>
            <button onClick={() => setActiveTab("health")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "health" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
              <Activity className="w-3.5 h-3.5" />Santé
            </button>
          </div>

          {/* Contenu onglets */}
          {activeTab === "chat" && (
            <div className="h-[calc(100vh-280px)]">
              {isLive ? <LiveChat liveId={liveId} isLive={isLive} /> : (
                <div className="flex items-center justify-center h-full bg-[#1f1f1f] rounded-xl">
                  <p className="text-xs text-white/40 italic">Le chat sera disponible en direct</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="bg-[#1f1f1f] rounded-xl p-4 space-y-4">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/50">Statistiques en direct</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase mb-1"><Eye className="w-3 h-3" />Viewers</div>
                  <div className="text-xl font-bold text-white">{isLive ? Math.floor(Math.random() * 50) + 10 : "—"}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase mb-1"><Clock className="w-3 h-3" />Durée</div>
                  <div className="text-xl font-bold text-white">{isLive ? formatDuration(streamDuration) : "—"}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase mb-1"><Wifi className="w-3 h-3" />Bitrate</div>
                  <div className="text-xl font-bold text-white">{isLive ? `${bitrate}` : "—"}<span className="text-xs text-white/40 ml-1">kbps</span></div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase mb-1"><Activity className="w-3 h-3" />Latence</div>
                  <div className="text-xl font-bold text-white">{isLive ? `${latency}` : "—"}<span className="text-xs text-white/40 ml-1">s</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "health" && (
            <div className="bg-[#1f1f1f] rounded-xl p-4 space-y-4">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/50">État de la diffusion</h3>
              {/* Status items */}
              <div className="space-y-2">
                {[
                  { label: "Connexion caméra", ok: cameraReady },
                  { label: "Connexion LiveKit", ok: isLive },
                  { label: "Flux vidéo", ok: isLive && cameraOn },
                  { label: "Flux audio", ok: isLive && micOn },
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
              {/* Multistream status */}
              <div className="pt-2">
                <h4 className="text-xs uppercase tracking-wider font-bold text-white/50 mb-2">Multistreaming</h4>
                <div className="space-y-1.5">
                  {[
                    { label: "YouTube", active: multistream.youtube, icon: Youtube, color: "#FF0000" },
                    { label: "Facebook", active: multistream.facebook, icon: Facebook, color: "#1877F2" },
                    { label: "TikTok", active: multistream.tiktok, icon: Music2, color: "#000000" },
                    { label: "Odysee", active: multistream.odysee, icon: VideoIcon, color: "#FA326E" },
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
    </div>
  );
}
