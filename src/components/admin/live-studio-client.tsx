"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Track, VideoPresets } from "livekit-client";
import {
  Video, VideoOff, Mic, MicOff, Radio, Square, Loader2,
  Users, Clock, AlertCircle, CheckCircle2, Settings,
} from "lucide-react";
import Link from "next/link";

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
  liveId,
  roomName,
  title,
  servantName,
  status: initialStatus,
  multistream,
}: LiveStudioClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isLive, setIsLive] = useState(initialStatus === "LIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Media state
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Init camera preview ───
  const initCamera = useCallback(async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
      setCameraOn(true);
      setMicOn(true);
    } catch (err) {
      console.error("[studio] Camera init error:", err);
      setError(
        "Impossible d'accéder à la caméra/micro. Vérifiez les permissions du navigateur."
      );
    }
  }, []);

  useEffect(() => {
    initCamera();
    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [initCamera]);

  // ─── Toggle camera ───
  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  // ─── Toggle mic ───
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  // ─── Go Live ───
  const goLive = async () => {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      // 1. Démarrer le live côté DB (status → LIVE)
      const startRes = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId }),
      });
      if (!startRes.ok) {
        const data = await startRes.json();
        throw new Error(data.error || "Erreur démarrage");
      }

      // 2. Récupérer le token LiveKit publisher
      const tokenRes = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          role: "publisher",
          participantName: servantName,
          liveId,
        }),
      });
      if (!tokenRes.ok) {
        const data = await tokenRes.json();
        throw new Error(data.error || "Erreur token LiveKit");
      }
      const { token, url } = await tokenRes.json();

      // 3. Connecter la room LiveKit et publier le stream
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 },
        },
        publishDefaults: {
          videoCodec: "h264",
          videoBitrate: 2_000_000,
          audioBitrate: 128_000,
        },
      });
      roomRef.current = room;

      await room.connect(url, token);
      setInfo("Connecté à LiveKit — publication du flux...");

      // Publier les tracks locales
      if (localStreamRef.current) {
        await room.localParticipant.publishStream(localStreamRef.current, {
          videoCodec: "h264",
        });
      }

      setIsLive(true);
      setStatus("LIVE");
      setInfo("Vous êtes en direct !");

      // Démarrer le compteur de durée
      const startTime = Date.now();
      durationTimerRef.current = setInterval(() => {
        setStreamDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // ─── Stop Live ───
  const stopLive = async () => {
    if (!confirm("Terminer le live ?")) return;
    setLoading(true);
    setError("");

    try {
      // Déconnecter la room LiveKit
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }

      // Arrêter le live côté DB
      const res = await fetch("/api/live/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur arrêt");
      }

      setIsLive(false);
      setStatus("ENDED");
      setInfo("Live terminé. Le replay sera archivé automatiquement.");

      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Format duration
  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/admin/lives"
            className="text-xs text-[#8A8378] hover:text-[#C9A227] mb-2 inline-block"
          >
            ← Retour aux lives
          </Link>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#1E0F2B]"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
          >
            Studio Live
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse">
              <Radio className="w-3 h-3" />
              EN DIRECT
            </span>
          ) : status === "ENDED" ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">
              TERMINÉ
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9A227]/15 text-[#A3821C] text-xs font-bold border border-[#C9A227]/30">
              PROGRAMMÉ
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* ─── Preview vidéo ─── */}
        <div className="space-y-4">
          <div className="relative aspect-video bg-[#1A0826] rounded-2xl overflow-hidden shadow-2xl border-2 border-[#8A8378]/20">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: cameraOn ? "scaleX(-1)" : "none" }}
            />

            {/* Overlay quand caméra off */}
            {!cameraOn && cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1A0826]/80">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 text-[#FAF6EF]/30 mx-auto mb-2" />
                  <p className="text-sm text-[#FAF6EF]/50">Caméra désactivée</p>
                </div>
              </div>
            )}

            {/* Overlay quand caméra pas prête */}
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-[#C9A227] mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-[#FAF6EF]/70">Initialisation de la caméra...</p>
                </div>
              </div>
            )}

            {/* Badge LIVE en haut à gauche */}
            {isLive && (
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold animate-pulse">
                  <Radio className="w-3 h-3" />
                  LIVE
                </span>
              </div>
            )}

            {/* Durée en haut à droite */}
            {isLive && (
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm">
                  <Clock className="w-3 h-3" />
                  {formatDuration(streamDuration)}
                </span>
              </div>
            )}

            {/* Info serviteur en bas */}
            <div className="absolute bottom-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-bold backdrop-blur-sm">
                {servantName}
              </span>
            </div>
          </div>

          {/* Contrôles média */}
          <div className="flex items-center justify-center gap-3 p-4 bg-white rounded-2xl border border-[#8A8378]/15">
            <button
              type="button"
              onClick={toggleCamera}
              disabled={!cameraReady}
              className={`p-3 rounded-xl transition-colors disabled:opacity-40 ${
                cameraOn
                  ? "bg-[#2A0E3D] text-[#FAF6EF] hover:bg-[#3D1A54]"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
              title={cameraOn ? "Couper la caméra" : "Activer la caméra"}
            >
              {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={toggleMic}
              disabled={!cameraReady}
              className={`p-3 rounded-xl transition-colors disabled:opacity-40 ${
                micOn
                  ? "bg-[#2A0E3D] text-[#FAF6EF] hover:bg-[#3D1A54]"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
              title={micOn ? "Couper le micro" : "Activer le micro"}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            {/* Bouton Go Live / Stop */}
            <div className="w-px h-8 bg-[#8A8378]/20 mx-2" />

            {!isLive && status !== "ENDED" ? (
              <button
                type="button"
                onClick={goLive}
                disabled={loading || !cameraReady}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Radio className="w-4 h-4" />
                )}
                {loading ? "Démarrage..." : "Go Live"}
              </button>
            ) : isLive ? (
              <button
                type="button"
                onClick={stopLive}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-50 shadow-lg"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {loading ? "Arrêt..." : "Terminer le live"}
              </button>
            ) : null}
          </div>

          {/* Messages */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && !error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{info}</span>
            </div>
          )}
        </div>

        {/* ─── Sidebar : infos + multistream ─── */}
        <div className="space-y-4">
          {/* Statut multistream */}
          <div className="bg-white rounded-2xl border border-[#8A8378]/15 p-5">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#8A8378] mb-3">
              Multistreaming
            </h3>
            {multistream.enabled ? (
              <div className="space-y-2">
                {[
                  { label: "YouTube", active: multistream.youtube, color: "bg-red-500" },
                  { label: "Facebook", active: multistream.facebook, color: "bg-blue-600" },
                  { label: "TikTok", active: multistream.tiktok, color: "bg-black" },
                  { label: "Odysee", active: multistream.odysee, color: "bg-pink-600" },
                ].map((p) => (
                  <div
                    key={p.label}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      p.active ? "bg-[#FAF6EF]" : "bg-gray-50 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${p.color}`} />
                      <span className="text-sm font-medium text-[#1E0F2B]">{p.label}</span>
                    </div>
                    {p.active ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="text-[10px] text-[#8A8378]">Désactivé</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#8A8378] italic">
                Multistreaming désactivé. Le live sera diffusé uniquement sur le site Christ Libère.
              </p>
            )}
          </div>

          {/* Configuration RTMP */}
          <div className="bg-white rounded-2xl border border-[#8A8378]/15 p-5">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#8A8378] mb-3 flex items-center gap-2">
              <Settings className="w-3 h-3" />
              Configuration
            </h3>
            <p className="text-xs text-[#8A8378] leading-relaxed mb-3">
              Pour activer le multistreaming, configurez les clés RTMP du serviteur.
            </p>
            <Link
              href="/admin/servants"
              className="text-xs font-semibold text-[#C9A227] hover:underline"
            >
              Configurer les clés RTMP →
            </Link>
          </div>

          {/* Stats en direct */}
          {isLive && (
            <div className="bg-white rounded-2xl border border-[#8A8378]/15 p-5">
              <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#8A8378] mb-3">
                Statistiques
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8A8378] flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Durée
                  </span>
                  <span className="text-sm font-bold text-[#1E0F2B]">
                    {formatDuration(streamDuration)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8A8378] flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Spectateurs
                  </span>
                  <span className="text-sm font-bold text-[#1E0F2B]">
                    —
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Aide */}
          <div className="bg-[#2A0E3D]/5 rounded-2xl border border-[#2A0E3D]/10 p-5">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#2A0E3D] mb-2">
              Aide
            </h3>
            <ul className="text-xs text-[#8A8378] space-y-1.5 leading-relaxed">
              <li>• Autorisez l'accès caméra/micro quand le navigateur le demande</li>
              <li>• Vérifiez votre connexion internet (min 5 Mbps upload)</li>
              <li>• Utilisez un endroit bien éclairé</li>
              <li>• Cliquez sur "Go Live" quand vous êtes prêt</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
