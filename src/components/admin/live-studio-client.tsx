"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Video, VideoOff, Mic, MicOff, Radio, Square, Loader2,
  Users, Clock, AlertCircle, CheckCircle2, Settings,
  Monitor, MonitorOff, Wifi, Activity, Heart,
  Youtube, Facebook, Music2, Instagram,
  ChevronDown, ChevronUp, Eye, MessageCircle, BarChart3,
  X, Pause, Play, Maximize2, Cast, Copy, Camera, RotateCcw,
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
  thumbnailUrl?: string | null;
  status: string;
  // ⭐ V2.6.2 — État persisté du live (restauration à la reconnexion)
  initialIsPaused?: boolean;
  initialStartedAt?: string | null;
  initialPausedAt?: string | null;
  multistream: {
    enabled: boolean;
    youtube: boolean;
    facebook: boolean;
    tiktok: boolean;
    instagram: boolean;
  };
}

// ⭐ V3.27 — Traduit un échec getUserMedia en diagnostic ACTIONNABLE.
// Cause n°1 constatée du « voyant caméra jamais allumé alors que les
// permissions du NAVIGATEUR sont accordées et que l'app Caméra Windows
// fonctionne » : Windows bloque les APPLICATIONS DE BUREAU (Chrome/Edge).
// L'app Caméra Windows est une app « Store » régie par un réglage
// DIFFÉRENT — d'où l'impression que « la caméra marche ailleurs ».
function describeGumError(err: unknown): { reason: string; hint: string } {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      reason: "accès refusé par Windows ou le navigateur",
      hint:
        "Vos permissions navigateur sont accordées, mais Windows bloque très probablement Chrome/Edge : " +
        "ouvrez Paramètres Windows → Confidentialité et sécurité → Caméra → activez « Accès à la caméra » " +
        "ET « Autoriser les applications de bureau à accéder à votre caméra » (Chrome/Edge sont des " +
        "applications de bureau ; l'app Caméra Windows fonctionne car c'est une app « Store » — c'est un " +
        "réglage DIFFÉRENT). Faites de même sous Microphone, puis revenez cliquer sur « Réessayer » — " +
        "inutile de recharger la page.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      reason: "aucune caméra détectée",
      hint: "Aucune caméra trouvée sur cette machine. Branchez/en allumez une, puis « Réessayer ».",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      reason: "caméra occupée par une autre application",
      hint: "La caméra est utilisée ailleurs (Zoom, OBS, app Caméra, Windows Hello, TeamViewer…). Fermez ces applications puis « Réessayer ».",
    };
  }
  if (name === "OverconstrainedError") {
    return {
      reason: "résolution non supportée",
      hint: "La caméra ne gère pas la résolution demandée — le repli automatique sera utilisé au prochain essai.",
    };
  }
  if (name === "TimeoutError") {
    return {
      reason: "le navigateur n'a jamais répondu",
      hint: "Une invite d'autorisation est peut-être restée ouverte ou masquée (regardez derrière la fenêtre, en haut de l'écran), ou un logiciel de sécurité retient l'accès. Cliquez sur « Réessayer ».",
    };
  }
  return {
    reason: err instanceof Error ? err.message : "erreur inconnue",
    hint: "Cliquez sur « Réessayer » ; si le problème persiste, testez la caméra dans une autre application puis revenez ici.",
  };
}

// ⭐ V3.27 — getUserMedia avec délai de garde : si le navigateur ne répond
// JAMAIS (invite bloquée, périphérique retenu par un autre logiciel…), on
// obtient un diagnostic au lieu du spinner « Initialisation... » éternel.
async function getUserMediaWithTimeout(constraints: MediaStreamConstraints, ms = 10_000): Promise<MediaStream> {
  let timedOut = false;
  const p = navigator.mediaDevices.getUserMedia(constraints);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timedOut = true;
      reject(new DOMException("getUserMedia sans réponse", "TimeoutError"));
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } catch (err) {
    if (timedOut) {
      // La permission peut arriver TARD (invite enfin cliquée) : refermer
      // les périphériques pour ne pas laisser un voyant allumé sans flux.
      p.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
    }
    throw err;
  }
}

export function LiveStudioClient({
  liveId, roomName, title, servantName, servantPortraitUrl, thumbnailUrl,
  status: initialStatus, multistream,
  initialIsPaused = false, initialStartedAt = null, initialPausedAt = null,
}: LiveStudioClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isLive, setIsLive] = useState(initialStatus === "LIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  // ⭐ V3.27 — Diagnostic caméra affiché DANS la preview : fini le spinner
  // « Initialisation de la caméra... » ÉTERNEL quand getUserMedia échoue
  // ou ne répond jamais (voyant caméra jamais allumé).
  const [cameraDiag, setCameraDiag] = useState<{ reason: string; hint: string } | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  // ⭐ V2.9 — Les anciens états `bitrate`/`latence` (valeurs ALÉATOIRES,
  // jamais mesurées) ont été supprimés : les HUD affichent désormais les
  // vraies métriques (spectateurs, messages, likes) du poll /stats.
  // ⭐ V2.9 — Stats TEMPS RÉEL (fini les bitrates/latence aléatoires) :
  // le studio poll /api/live/[id]/stats toutes les 5 s pendant le direct.
  const [chatMessageCount, setChatMessageCount] = useState(0);
  const [reactionCount, setReactionCount] = useState(0);
  const [likesTotal, setLikesTotal] = useState(0);
  const [youtubeStats, setYoutubeStats] = useState<{ viewCount: number; likeCount: number; commentCount: number } | null>(null);
  const [youtubeConfigured, setYoutubeConfigured] = useState(true);
  const statsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "stats" | "health">("chat");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [youtubeReplayUrl, setYoutubeReplayUrl] = useState("");
  const [fetchingYoutubeReplay, setFetchingYoutubeReplay] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isPaused, setIsPaused] = useState(initialIsPaused);
  const [showControls, setShowControls] = useState(true);
  const [sourceMode, setSourceMode] = useState<"webcam" | "encoder">("webcam");
  const [ingressInfo, setIngressInfo] = useState<{ rtmpUrl: string; streamKey: string; obsInstructions: string[] } | null>(null);
  const [copiedField, setCopiedField] = useState("");
  // ⭐ V2.6.2 — Reconnexion auto d'un live déjà en cours (studio refermé puis rouvert)
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectAttemptedRef = useRef(false);

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
  // ⭐ V3.27 — Egress RTMP en tâche de fond : promise en vol (attendue au
  // stop ≤ 12 s pour couper proprement) + drapeau « live terminé » pour
  // neutraliser les retours d'egress arrivant après l'arrêt.
  const liveEndedRef = useRef(false);
  const egressInFlightRef = useRef<Promise<void> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  // ⭐ V3.22 — CHAÎNE DE DIFFUSION DU STUDIO (LiveKit → Agora → Daily) :
  // fournisseur actif + handles des replis (déconnexion propre au stop).
  const [mediaProvider, setMediaProvider] = useState<"livekit" | "agora" | "daily">("livekit");
  const mediaProviderRef = useRef<"livekit" | "agora" | "daily">("livekit");
  const agoraClientRef = useRef<{ leave: () => Promise<void> } | null>(null);
  const agoraTracksRef = useRef<Array<{ stop: () => void }>>([]);
  const dailyCallRef = useRef<{
    join: (opts: Record<string, unknown>) => Promise<void>;
    leave: () => Promise<void>;
    destroy: () => void;
  } | null>(null);

  // ⭐ V3.26 — RÉPARATION « CAMÉRA NOIRE » : attache un flux à l'élément
  // <video> source du canvas et GARANTIT qu'il joue.
  //
  // Contexte : le studio publie (et affiche) le CANVAS composite, nourri par
  // cet élément <video> masqué. React ne rend PAS l'attribut `muted` dans le
  // DOM (bug connu facebook/react#10389) — si la propriété n'est pas
  // effectivement posée AVANT play(), Chrome REFUSE l'autoplay, la vidéo
  // reste à videoWidth = 0, le canvas peint du NOIR… et TOUTE la chaîne en
  // aval (preview du studio, HLS viewers, RTMP YouTube) est noire. On force
  // donc la propriété en JS, avec reprise automatique.
  const attachStreamToVideo = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true;
    try { video.defaultMuted = true; } catch {}
    const tryPlay = () => { video.play().catch(() => {}); };
    tryPlay();
    // Reprise : certains navigateurs n'autorisent play() qu'une fois les
    // métadonnées arrivées, ou après un léger délai (policy).
    video.addEventListener("loadeddata", tryPlay, { once: true });
    setTimeout(tryPlay, 600);
    setTimeout(tryPlay, 2000);
  }, []);

  // ⭐ V3.27 — RÉPARATION « voyant caméra jamais allumé / spinner infini » :
  // VIDÉO et AUDIO sont demandés SÉPARÉMENT (un micro bloqué par Windows ne
  // doit plus noircir la vidéo, ni l'inverse), chaque demande a un délai de
  // garde (plus de « Initialisation de la caméra... » éternel), et tout
  // échec affiche un PANNEAU DE DIAGNOSTIC directement dans la preview —
  // avec la cause n°1 (Windows bloque les applications de bureau) et un
  // bouton « Réessayer » qui n'exige pas de recharger la page.
  const initCamera = useCallback(async () => {
    setError("");
    setCameraDiag(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraDiag({
        reason: "navigateur non compatible",
        hint:
          "Ce navigateur/contexte ne supporte pas getUserMedia. Le studio exige HTTPS (ou localhost) " +
          "et un navigateur récent (Chrome, Edge, Firefox).",
      });
      return;
    }
    // 1) VIDÉO seule — cascade de contraintes (720p → repli générique)
    const videoAttempts: Array<MediaStreamConstraints> = [
      { video: { width: 1280, height: 720, facingMode: "user" } },
      { video: true },
    ];
    let videoStream: MediaStream | null = null;
    let lastVideoErr: unknown = null;
    for (const constraints of videoAttempts) {
      try {
        videoStream = await getUserMediaWithTimeout(constraints);
        break;
      } catch (err) { lastVideoErr = err; }
    }
    // 2) AUDIO seul — INDÉPENDANT : si le micro est bloqué, la vidéo (et le
    //    direct) démarrent quand même, avec un avertissement sonore clair.
    let audioStream: MediaStream | null = null;
    let lastAudioErr: unknown = null;
    try {
      audioStream = await getUserMediaWithTimeout({ audio: true });
    } catch (err) { lastAudioErr = err; }

    if (!videoStream) {
      // Pas de vidéo = pas de direct : diagnostic complet dans la preview.
      setCameraDiag(describeGumError(lastVideoErr));
      return;
    }
    // 3) Fusion vidéo + audio dans le flux local du studio
    const merged = new MediaStream();
    videoStream.getVideoTracks().forEach((t) => merged.addTrack(t));
    if (audioStream) audioStream.getAudioTracks().forEach((t) => merged.addTrack(t));
    localStreamRef.current = merged;
    attachStreamToVideo(merged);
    setCameraReady(true);
    setCameraOn(true);
    setMicOn(merged.getAudioTracks().length > 0);
    if (!audioStream) {
      const d = describeGumError(lastAudioErr);
      setError(
        "⚠ Micro inaccessible — le direct sera diffusé SANS SON. " +
        `Cause probable : ${d.reason}. ${d.hint}`
      );
    }
  }, [attachStreamToVideo]);

  useEffect(() => {
    initCamera();
    return () => {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
      if (roomRef.current) roomRef.current.disconnect();
      // ⭐ V3.22 — Déconnecter AUSSI les replis (Agora/Daily).
      try { agoraClientRef.current?.leave(); } catch {}
      agoraClientRef.current = null;
      for (const t of agoraTracksRef.current) { try { t.stop(); } catch {} }
      agoraTracksRef.current = [];
      try { dailyCallRef.current?.leave(); } catch {}
      try { dailyCallRef.current?.destroy(); } catch {}
      dailyCallRef.current = null;
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
      if (viewerPollRef.current) clearInterval(viewerPollRef.current);
      // ⭐ V2.9 — Poll de stats temps réel
      if (statsPollRef.current) clearInterval(statsPollRef.current);
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
    // Arrêter le minuteur en pause, le reprendre en play
    if (newPaused) {
      if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
    } else {
      const elapsed = streamDuration;
      const resumeTime = Date.now() - elapsed * 1000;
      durationTimerRef.current = setInterval(() => {
        setStreamDuration(Math.floor((Date.now() - resumeTime) / 1000));
      }, 1000);
    }
    // Notifier les viewers via DataChannel LiveKit (viewers LiveKit uniquement)
    if (roomRef.current) {
      try {
        const msg = JSON.stringify({ action: newPaused ? "pause" : "resume" });
        const encoder = new TextEncoder();
        roomRef.current.localParticipant.publishData(encoder.encode(msg), {
          reliable: true,
          topic: "live-control",
        });
      } catch (err) {
        console.error("[studio] Failed to send pause/resume signal:", err);
      }
    }
    // (YT-pause) Persister l'état de pause en base pour les viewers YouTube
    // (qui ne reçoivent pas le DataChannel LiveKit). Best-effort : on ne
    // bloque pas l'UI si l'API échoue — le signal LiveKit a déjà été envoyé.
    apiFetch(`/api/live/${liveId}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: newPaused }),
    }).catch((err) => {
      console.error("[studio] Failed to persist pause state for YouTube viewers:", err);
    });
  };

  // ─── Mode encodeur externe (OBS) ───
  const fetchIngressInfo = async () => {
    try {
      const res = await apiFetch(`/api/live/${liveId}/ingress`);
      if (res.ok) {
        const data = await res.json();
        setIngressInfo(data);
      }
    } catch (err) {
      console.error("[studio] Failed to fetch ingress:", err);
    }
  };

  const handleSourceModeChange = (mode: "webcam" | "encoder") => {
    setSourceMode(mode);
    if (mode === "encoder" && !ingressInfo) {
      fetchIngressInfo();
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(""), 2000);
    });
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      // ⭐ V3.26 — reprise garantie du flux caméra après le partage d'écran
      // (même mécanique que initCamera : muted + play avec retries).
      if (localStreamRef.current) {
        attachStreamToVideo(localStreamRef.current);
      }
      setScreenSharing(false);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = displayStream;
        // ⭐ V3.26 — attacher avec la même garantie de lecture.
        attachStreamToVideo(displayStream);
        setScreenSharing(true);
        displayStream.getVideoTracks()[0].onended = () => {
          if (localStreamRef.current) {
            attachStreamToVideo(localStreamRef.current);
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

  // ═══════════════════════════════════════════════════════════════════
  //  ⭐ V3.22 — CONNEXION DU STUDIO À LA CHAÎNE DE DIFFUSION
  //  (LiveKit source de vérité → Agora → Daily, arbitrage serveur).
  //
  //  1. POST /api/live/[id]/stream {role:"publisher"} → le SERVEUR choisit
  //     le fournisseur (chaîne + santé partagée avec les appels Yeshua).
  //  2. Connexion + publication selon le fournisseur (canvas overlay sinon
  //     caméra brute + micro — les MÊMES tracks locales pour les 3).
  //  3. Échec → action « failover » : le serveur fait AVANCER la chaîne et
  //     le studio réessaie immédiatement sur le suivant. Les VIEWERS suivent
  //     tous automatiquement via le polling GET /stream (≤ 12 s).
  // ═══════════════════════════════════════════════════════════════════
  const disconnectAltProviders = () => {
    try { agoraClientRef.current?.leave(); } catch {}
    agoraClientRef.current = null;
    for (const t of agoraTracksRef.current) { try { t.stop(); } catch {} }
    agoraTracksRef.current = [];
    try { dailyCallRef.current?.leave(); } catch {}
    try { dailyCallRef.current?.destroy(); } catch {}
    dailyCallRef.current = null;
  };

  const connectPublisherWithFailover = useCallback(async (opts: { applyPause: boolean }): Promise<"livekit" | "agora" | "daily"> => {
    let lastError = "erreur inconnue";
    for (let attempt = 0; attempt < 3; attempt++) {
      // 1. Bundle serveur (fournisseur arbitré, tokens 100 % serveur)
      const res = await apiFetch(`/api/live/${liveId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "publisher" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Bundle de diffusion indisponible (HTTP ${res.status})`);
      }
      const bundle = await res.json();
      const provider = (bundle.provider || "livekit") as "livekit" | "agora" | "daily";

      try {
        // ─── LIVEKIT (source de vérité) : chemin historique, inchangé ───
        if (provider === "livekit" && bundle.livekit) {
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: { resolution: { width: 1280, height: 720 } },
            publishDefaults: { videoCodec: "h264" },
          });
          roomRef.current = room;
          await room.connect(bundle.livekit.url, bundle.livekit.token);

          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            // (V2.6.2) reconnexion : respecter l'état de pause AVANT publish
            if (opts.applyPause) {
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              if (videoTrack) videoTrack.enabled = !isPaused && cameraOn;
              if (audioTrack) audioTrack.enabled = !isPaused && micOn;
            }

            // Publier le canvas composite (overlay) sinon la caméra brute
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
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              if (videoTrack) {
                await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
                console.log("[studio] Caméra brute publiée (fallback)");
              }
            }
            if (audioTrack) await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
          }
          mediaProviderRef.current = "livekit";
          setMediaProvider("livekit");
          return "livekit";
        }

        // ─── AGORA (1ᵉʳ repli) : host + MÊMES tracks locales (custom) ───
        if (provider === "agora" && bundle.agora) {
          const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
          const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
          await client.setClientRole("host");
          await client.join(bundle.agora.appId, bundle.agora.channel, bundle.agora.token, bundle.agora.uid);
          const published: Array<{ stop: () => void }> = [];
          try {
            const micRaw = localStreamRef.current?.getAudioTracks()[0];
            const audioTrack = micRaw
              ? AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: micRaw })
              : await AgoraRTC.createMicrophoneAudioTrack();
            published.push(audioTrack);
            const videoRaw = overlayStreamRef.current?.getVideoTracks()[0]
              ?? localStreamRef.current?.getVideoTracks()[0];
            const videoTrack = videoRaw
              ? AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: videoRaw })
              : await AgoraRTC.createCameraVideoTrack();
            published.push(videoTrack);
            if (opts.applyPause) {
              if (micRaw) micRaw.enabled = !isPaused && micOn;
              const camRaw = localStreamRef.current?.getVideoTracks()[0];
              if (camRaw) camRaw.enabled = !isPaused && cameraOn;
            }
            await client.publish([audioTrack, videoTrack]);
          } catch (publishErr) {
            for (const t of published) { try { t.stop(); } catch {} }
            throw publishErr;
          }
          agoraClientRef.current = client;
          agoraTracksRef.current = published;
          mediaProviderRef.current = "agora";
          setMediaProvider("agora");
          console.log("[studio] Diffusion via Agora (canvas + micro)");
          return "agora";
        }

        // ─── DAILY (dernier repli) ───
        if (provider === "daily" && bundle.daily) {
          const Daily = (await import("@daily-co/daily-js")) as unknown as {
            createCallObject(): NonNullable<typeof dailyCallRef.current>;
          };
          const call = Daily.createCallObject();
          const videoRaw = overlayStreamRef.current?.getVideoTracks()[0]
            ?? localStreamRef.current?.getVideoTracks()[0];
          const audioRaw = localStreamRef.current?.getAudioTracks()[0];
          if (opts.applyPause) {
            if (audioRaw) audioRaw.enabled = !isPaused && micOn;
            const camRaw = localStreamRef.current?.getVideoTracks()[0];
            if (camRaw) camRaw.enabled = !isPaused && cameraOn;
          }
          await call.join({
            url: bundle.daily.url,
            token: bundle.daily.token,
            userName: servantName,
            ...(videoRaw ? { videoSource: videoRaw } : {}),
            ...(audioRaw ? { audioSource: audioRaw } : {}),
          });
          dailyCallRef.current = call;
          mediaProviderRef.current = "daily";
          setMediaProvider("daily");
          console.log("[studio] Diffusion via Daily");
          return "daily";
        }

        throw new Error(`Bundle ${provider} incomplet`);
      } catch (err) {
        lastError = err instanceof Error ? err.message : "erreur";
        console.error(`[studio] Connexion ${provider} échouée:`, lastError);
        // Nettoyer l'état du fournisseur qui vient d'échouer
        try { roomRef.current?.disconnect(); } catch {}
        roomRef.current = null;
        disconnectAltProviders();
        // ⭐ 2. FAILOVER serveur : avancer la chaîne (LiveKit → Agora → Daily)
        try {
          const failoverRes = await apiFetch(`/api/live/${liveId}/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "failover", from: provider }),
          });
          const data = await failoverRes.json().catch(() => ({}));
          if (!data.provider) break; // chaîne épuisée → OBS
          setInfo(`Bascule automatique : ${provider === "livekit" ? "LiveKit" : provider} → ${data.provider === "agora" ? "Agora" : data.provider}...`);
        } catch {
          break;
        }
      }
    }
    throw new Error(
      `Tous les serveurs de diffusion ont échoué (${lastError}). ` +
      "Utilisez le mode « Encodeur externe (OBS) » pour diffuser maintenant, " +
      "puis réessayez plus tard.",
    );
  }, [liveId, servantName, isPaused, cameraOn, micOn]);

  const goLive = async () => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      // ═══ ⭐ V3.26 — ORDRE DES ÉTAPES CORRIGÉ (anomalie « la minuterie
      // démarre avant la stabilisation du bouton Terminer ») ═══
      // AVANT : /api/live/start (statut LIVE en base) → connexion →
      // « EN DIRECT » + minuterie qui court PENDANT que le multistreaming
      // RTMP était encore en configuration → le bouton « Terminer » et la
      // minuterie n'étaient pas stabilisés.
      // NOUVEL ORDRE : (1) connexion au serveur de diffusion → (2) egress
      // HLS → (3) enregistrement local → (4) multistreaming RTMP →
      // (5) /api/live/start (statut LIVE + startedAt = le VRAI début du
      // direct) → (6) SEULEMENT ALORS « EN DIRECT » + minuterie + stats.
      // La minuterie démarre donc une fois la chaîne STABILISÉE, et
      // startedAt (côté viewer) correspond au vrai passage à l'antenne.

      // ─── 1. Connexion au serveur de diffusion (⭐ V3.22 : chaîne
      //     LiveKit → Agora → Daily avec bascule AUTOMATIQUE serveur) ───
      // ⭐ V3.26 : AVANT tout changement d'état — si cette étape échoue,
      // rien n'a été démarré (ni statut DB, ni minuterie) : il n'y a
      // donc PLUS RIEN à annuler (l'ancien code appelait /api/live/stop
      // en compensation d'un /start déjà fait — inutile désormais).
      setInfo("Connexion au serveur de diffusion...");
      const provider = await connectPublisherWithFailover({ applyPause: false });
      setInfo(
        provider === "livekit"
          ? "Connecté à LiveKit — publication du flux..."
          : `Connecté (repli ${provider === "agora" ? "Agora" : "Daily"} — LiveKit indisponible)`,
      );

      // ─── 2. ⭐ V3.22 — MODE YOUTUBE : démarrer l'egress HLS dès
      //     maintenant pour que la playlist soit prête AVANT l'arrivée
      //     des viewers. Best effort — les viewers retombent proprement
      //     en WebRTC si l'egress échoue (quota/plan). ───
      if (provider === "livekit") {
        apiFetch(`/api/live/${liveId}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "hls-start" }),
        }).then((r) => r.json().catch(() => ({}))).then((data: { success?: boolean; reason?: string }) => {
          if (data?.success) {
            console.log("[studio] Egress HLS démarré (mode YouTube — viewers non comptés)");
          } else if (data?.reason) {
            console.warn("[studio] HLS indisponible :", data.reason);
          }
        }).catch(() => {});
      }

      // ─── 3. Enregistrement local du replay (dès la connexion, AVANT
      //     l'egress : le replay ne perd rien du direct) ───
      const recordStream = overlayStreamRef.current || localStreamRef.current;
      if (recordStream && typeof MediaRecorder !== "undefined" && !mediaRecorderRef.current) {
        try {
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
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
          console.log("[studio] Enregistrement démarré");
        } catch (err) {
          console.error("[studio] MediaRecorder failed:", err);
        }
      }

      // ─── 4. Démarrer le live côté DB (statut LIVE + startedAt + Tier C
      //     broadcast YouTube) — ⭐ V3.27 : dès la connexion + publication
      //     réussies (la chaîne est prête à diffuser), AVANT l'egress RTMP
      //     qui tourne désormais EN ARRIÈRE-PLAN. La configuration
      //     YouTube/Facebook prend plusieurs secondes : elle ne doit plus
      //     geler le bouton « Go Live » (anomalie « ça prend trop de temps
      //     avant que le live ne démarre ») ni la minuterie.
      //     startedAt (renvoyé par la route) reste l'ancre de la minuterie :
      //     elle démarre au VRAI passage à l'antenne, chaîne stabilisée.
      //     Best effort : le studio continue même si la DB est momentanément
      //     indisponible. ───
      let startedAtIso: string | null = null;
      try {
        const startRes = await apiFetch("/api/live/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveId }),
        });
        // ⭐ V3.26 — startedAt renvoyé par la route (ancrage minuterie).
        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok) {
          // « Le live est déjà en cours » = reprise (studio rouvert) :
          // PAS une erreur bloquante — startedAt est déjà en base.
          if (!/déjà en cours/i.test(String(startData.error || ""))) {
            throw new Error(startData.error || "Erreur démarrage");
          }
        }
        if (startData.youtubeBroadcast?.url) {
          setInfo(`✓ Broadcast YouTube pré-créé: ${startData.youtubeBroadcast.url}`);
          console.log("[studio] Broadcast YouTube pré-créé:", startData.youtubeBroadcast);
        }
        if (startData.startedAt) startedAtIso = startData.startedAt;
      } catch (err) {
        console.error("[studio] /api/live/start failed (continuing anyway):", err);
        setError("Attention: l'API start a échoué, mais le studio continue.");
      }

      // ─── 5. STABILISATION FINALE (⭐ V3.26) : maintenant (et seulement
      //     maintenant) on passe « EN DIRECT » — minuterie ancrée sur le
      //     startedAt réel de la base, bouton « Terminer » stable.
      //     ⭐ V3.27 : le multistreaming se configure en arrière-plan — le
      //     direct démarre immédiatement sur le site (WebRTC), YouTube/
      //     Facebook partent quelques secondes plus tard. ───
      setIsLive(true);
      liveEndedRef.current = false;
      setStatus("LIVE");
      setInfo(
        (provider === "livekit" ? "Vous êtes en direct !" : `Vous êtes en direct via ${provider === "agora" ? "Agora" : "Daily"} (repli automatique).`) +
          (multistream.enabled && mediaProviderRef.current === "livekit"
            ? " Multistreaming en cours de configuration (vous pouvez déjà parler)…"
            : multistream.enabled && mediaProviderRef.current !== "livekit"
            ? " Multistreaming indisponible en mode repli (visible sur le site uniquement)."
            : ""),
      );

      const anchor = startedAtIso ? new Date(startedAtIso).getTime() : Date.now();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setStreamDuration(Math.max(0, Math.floor((Date.now() - anchor) / 1000)));
      durationTimerRef.current = setInterval(() => {
        setStreamDuration(Math.max(0, Math.floor((Date.now() - anchor) / 1000)));
      }, 1000);

      // ⭐ V2.9 — Stats RÉELLES : plus de bitrate/latence aléatoires —
      // on interroge /stats (viewers, chat, likes, YouTube) toutes
      // les 5 s. (Remplace AUSSI l'ancien poll /viewers séparé.)
      if (statsPollRef.current) clearInterval(statsPollRef.current);
      const pollStats = async () => {
        try {
          const res = await apiFetch(`/api/live/${liveId}/stats`);
          if (!res.ok) return;
          const data = await res.json();
          setViewerCount(data.viewerCount || 0);
          setChatMessageCount(data.chatMessageCount || 0);
          setReactionCount(data.reactionCount || 0);
          setLikesTotal(data.likesTotal || 0);
          setYoutubeStats(data.youtube || null);
          setYoutubeConfigured(!!data.youtubeConfigured);
        } catch {}
      };
      pollStats();
      statsPollRef.current = setInterval(pollStats, 5000);

      // ─── 6. ⭐ V3.27 — MULTISTREAMING RTMP EN TÂCHE DE FOND ───
      // La configuration egress (listEgress + création par destination +
      // poignée de main YouTube/Facebook) prend de 3 à 10 s : elle GELAIT
      // le « Go Live ». Elle s'exécute désormais en parallèle et rapporte
      // son résultat dans le bandeau d'info. Le « Terminer » reste
      // utilisable pendant la configuration : l'arrêt attend l'egress en
      // vol (≤ 12 s) pour couper proprement.
      if (multistream.enabled && mediaProviderRef.current === "livekit") {
        const egressTask = (async () => {
          try {
            const egressRes = await apiFetch(`/api/live/${liveId}/egress`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            const egressData = await egressRes.json().catch(() => ({}));
            console.log("[studio] Egress RTMP response:", egressData);
            if (liveEndedRef.current) return; // arrêté entre-temps : ne pas écraser les bandeaux
            if (egressRes.ok && egressData.totalStarted > 0) {
              const reused = (egressData.results || []).some((r: { reused?: boolean }) => r.reused);
              setInfo(`✓ Multistreaming actif (${egressData.totalStarted} destination(s))${reused ? " — egress réutilisé" : ""}`);
            } else if (egressRes.ok && egressData.totalFailed > 0) {
              const failed = egressData.results?.filter((r: { egressId: string | null }) => !r.egressId).map((r: { name: string; error?: string }) => `${r.name}: ${r.error || "échec"}`).join(", ");
              setInfo(`⚠ Multistreaming: ${egressData.totalFailed} échec(s) — ${failed}`);
              setError(`RTMP échoué: ${failed}`);
            } else if (!egressRes.ok) {
              const errMsg = egressData.error || `HTTP ${egressRes.status}`;
              const diag = egressData.diagnostic ? `\n${egressData.diagnostic.join("\n")}` : "";
              setInfo(`⚠ Multistreaming échoué: ${errMsg}${diag}`);
              setError(`Multistreaming: ${errMsg}${diag}`);
            }
          } catch (err) {
            console.error("[studio] Failed to start RTMP egress:", err);
            if (!liveEndedRef.current) setError(`RTMP egress: ${err instanceof Error ? err.message : "erreur"}`);
          }
        })();
        egressInFlightRef.current = egressTask.then(
          () => { egressInFlightRef.current = null; },
          () => { egressInFlightRef.current = null; },
        );
      }

    } catch (err) {
      // La connexion de diffusion a échoué : ⭐ V3.26 — le statut DB
      // n'étant plus modifié avant la connexion, il n'y a RIEN à annuler.
      const errMsg = err instanceof Error ? err.message : "erreur inconnue";
      console.error("[studio] Connexion de diffusion échouée:", errMsg);
      setError(`Diffusion impossible: ${errMsg}. Les viewers ne pourront pas voir le flux.`);
      setInfo("⚠ Tous les serveurs de diffusion sont indisponibles — passez en mode « Encodeur externe (OBS) ».");
      // Nettoyer ce qui a pu démarrer localement (recorder) :
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaRecorderRef.current = null;
      setIsRecording(false);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  ⭐ V2.6.2 — RECONNEXION AUTOMATIQUE D'UN LIVE DÉJÀ EN COURS
  // ═══════════════════════════════════════════════════════════════════
  // Scénario corrigé : l'admin met le live en pause, SORT du module, puis
  // REVIENT. Avant : le studio affichait « en lecture » avec des tracks
  // locaux non publiés (room déconnectée) et une durée repartie de zéro.
  // Maintenant : on se RECONNECTE à la room LiveKit, on republie les tracks
  // (en respectant l'état de pause persisté), on restaure la durée réelle
  // depuis startedAt et on réutilise l'egress RTMP existant (zéro doublon).
  // ═══════════════════════════════════════════════════════════════════
  const reconnectLive = useCallback(async () => {
    if (roomRef.current || agoraClientRef.current || dailyCallRef.current) return; // déjà connecté
    setReconnecting(true);
    setInfo("Reconnexion à la diffusion en cours...");
    try {
      // 1. (⭐ V3.22) Connexion au fournisseur arbitré (chaîne LiveKit →
      //    Agora → Daily avec bascule serveur) — PAS d'appel à
      //    /api/live/start (le live est déjà LIVE en base ; re-démarrer
      //    remettrait startedAt à zéro, d'où l'ancien bug « ça reprend à
      //    zéro »). applyPause=true : tracks désactivées si isPaused.
      await connectPublisherWithFailover({ applyPause: true });

      // ⭐ V3.22 — Anticiper l'egress HLS après reconnexion (mode YouTube).
      if (mediaProviderRef.current === "livekit") {
        apiFetch(`/api/live/${liveId}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "hls-start" }),
        }).then((r) => r.json().catch(() => ({}))).then((data: { success?: boolean }) => {
          if (data?.success) console.log("[studio/reconnect] Egress HLS actif (mode YouTube)");
        }).catch(() => {});
      }

      // 3. Restaurer la durée RÉELLE depuis la base (startedAt) :
      //    - en pause → minuterie gelée à (pausedAt - startedAt)
      //    - sinon    → minuterie live (now - startedAt)
      if (initialStartedAt) {
        const started = new Date(initialStartedAt).getTime();
        if (isPaused && initialPausedAt) {
          setStreamDuration(Math.max(0, Math.floor((new Date(initialPausedAt).getTime() - started) / 1000)));
        } else if (!isPaused) {
          setStreamDuration(Math.max(0, Math.floor((Date.now() - started) / 1000)));
          if (durationTimerRef.current) clearInterval(durationTimerRef.current);
          const anchor = started;
          durationTimerRef.current = setInterval(() => {
            setStreamDuration(Math.max(0, Math.floor((Date.now() - anchor) / 1000)));
          }, 1000);
        }
      }

      // 4. ⭐ V2.9 — Stats RÉELLES (reconnexion) : même poll /stats que
      // goLive — plus de valeurs aléatoires.
      if (statsPollRef.current) clearInterval(statsPollRef.current);
      const pollStatsReconnect = async () => {
        try {
          const res = await apiFetch(`/api/live/${liveId}/stats`);
          if (!res.ok) return;
          const data = await res.json();
          setViewerCount(data.viewerCount || 0);
          setChatMessageCount(data.chatMessageCount || 0);
          setReactionCount(data.reactionCount || 0);
          setLikesTotal(data.likesTotal || 0);
          setYoutubeStats(data.youtube || null);
          setYoutubeConfigured(!!data.youtubeConfigured);
        } catch {}
      };
      pollStatsReconnect();
      statsPollRef.current = setInterval(pollStatsReconnect, 5000);

      // 5. Redémarrer l'enregistrement local (replay de la session courante)
      const recordStream = overlayStreamRef.current || localStreamRef.current;
      if (recordStream && typeof MediaRecorder !== "undefined" && !mediaRecorderRef.current) {
        try {
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
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
        } catch (err) {
          console.error("[studio/reconnect] MediaRecorder failed:", err);
        }
      }

      // 6. Egress RTMP : la route est idempotente (V2.6.2) — elle RÉUTILISE
      //    l'egress actif pour cette room au lieu d'en démarrer un doublon.
      //    (⭐ V3.22 : LiveKit uniquement — l'egress RTMP lit la room.)
      if (multistream.enabled && mediaProviderRef.current === "livekit") {
        try {
          const egressRes = await apiFetch(`/api/live/${liveId}/egress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const egressData = await egressRes.json().catch(() => ({}));
          if (egressRes.ok && egressData.totalStarted > 0) {
            const reused = (egressData.results || []).some((r: { reused?: boolean }) => r.reused);
            setInfo(
              isPaused
                ? `✓ Reconnecté — diffusion en pause${reused ? " (egress réutilisé)" : ""}`
                : `✓ Reconnecté à la diffusion${reused ? " (egress réutilisé)" : ""}`
            );
          } else {
            const failed = (egressData.results || [])
              .filter((r: { egressId: string | null }) => !r.egressId)
              .map((r: { name: string; error?: string }) => `${r.name}: ${r.error || "échec"}`)
              .join(", ");
            if (failed) setInfo(`⚠ Multistreaming: ${failed}`);
          }
        } catch (err) {
          console.error("[studio/reconnect] Egress failed:", err);
        }
      } else {
        setInfo(isPaused ? "Reconnecté — diffusion en pause" : "Reconnecté à la diffusion");
      }
    } catch (err) {
      console.error("[studio/reconnect] Failed:", err);
      setError(
        `Reconnexion impossible : ${err instanceof Error ? err.message : "erreur"}. ` +
        "Le live continue côté YouTube avec la dernière image publiée."
      );
    } finally {
      setReconnecting(false);
    }
  }, [liveId, servantName, multistream.enabled, isPaused, cameraOn, micOn, initialStartedAt, initialPausedAt, connectPublisherWithFailover]);

  // Déclencher la reconnexion une seule fois, quand on arrive sur un live
  // déjà LIVE ET que la caméra est prête (les tracks existent avant publish).
  useEffect(() => {
    if (
      initialStatus === "LIVE" &&
      cameraReady &&
      !reconnectAttemptedRef.current &&
      !roomRef.current
    ) {
      reconnectAttemptedRef.current = true;
      reconnectLive();
    }
  }, [cameraReady, initialStatus, reconnectLive]);

  // ─── Récupérer l'URL YouTube du replay (auto ou manuel) ───
  const handleFetchYoutubeReplay = async () => {
    setFetchingYoutubeReplay(true);
    try {
      const res = await apiFetch(`/api/live/${liveId}/youtube-replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(youtubeReplayUrl ? { youtubeUrl: youtubeReplayUrl } : {}),
      });
      const data = await res.json();
      if (res.ok && data.youtubeUrl) {
        setYoutubeReplayUrl(data.youtubeUrl);
        setInfo(`✓ URL YouTube récupérée: ${data.source === "manual" ? "saisie manuelle" : data.source === "oauth" ? "API YouTube" : "recherche"}`);
      } else {
        setError(data.error || "Impossible de récupérer l'URL YouTube");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setFetchingYoutubeReplay(false);
    }
  };

  const confirmStopLive = async () => {
    // ─── Si l'admin a collé une URL YouTube, la persister avant le stop ───
    if (youtubeReplayUrl.trim()) {
      try {
        await apiFetch(`/api/live/${liveId}/youtube-replay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeUrl: youtubeReplayUrl.trim() }),
        });
      } catch {}
    }
    setShowStopModal(false);
    setLoading(true);
    setError("");
    setInfo("Arrêt de l'enregistrement et archivage du replay...");
    try {
      // ⭐ V3.27 — Si l'egress RTMP est encore en configuration en
      // arrière-plan (Go Live rapide), attendre qu'il se termine (≤ 12 s)
      // AVANT le démontage serveur : /stop coupe alors l'egress proprement.
      // Sans cela, un egress « fantôme » démarré après le /stop continuerait
      // de diffuser vers YouTube (fenêtre de course restante de l'anomalie
      // « YouTube continuait après l'arrêt », déjà corrigée côté serveur).
      if (egressInFlightRef.current) {
        try {
          await Promise.race([
            egressInFlightRef.current,
            new Promise((resolve) => setTimeout(resolve, 12_000)),
          ]);
        } catch {}
      }
      liveEndedRef.current = true;

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
      // ⭐ V3.22 — Déconnecter AUSSI les replis (Agora/Daily) : le stop
      // doit couper TOUTES les formes de diffusion, comme pour LiveKit.
      disconnectAltProviders();

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
            const uploadRes = await apiFetch(`/api/live/${liveId}/recording`, {
              method: "POST",
              body: formData,
            });
            if (uploadRes.ok) {
              const data = await uploadRes.json();
              recordingUrl = data.recordingUrl;
              console.log("[studio] Replay uploadé (API):", recordingUrl);
              setInfo(`✓ Replay uploadé (${data.storage || 'DB'})`);
            } else {
              const errData = await uploadRes.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${uploadRes.status}`);
            }
          } else {
            // Gros fichier : upload direct vers R2 via URL pré-signée
            const presignRes = await apiFetch(`/api/live/${liveId}/presign`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contentType: "video/webm" }),
            });
            if (!presignRes.ok) {
              const errData = await presignRes.json().catch(() => ({}));
              throw new Error(errData.error || "Impossible de générer l'URL d'upload R2");
            }
            const { uploadUrl, publicUrl } = await presignRes.json();

            // Upload direct vers R2
            // ⭐ V3.26 — RETRY + diagnostic : « Failed to fetch » sur ce PUT
            // = échec réseau OU CORS du bucket R2. Le serveur applique
            // désormais les règles CORS AVANT de délivrer l'URL
            // (ensureR2CorsConfig dans /api/live/[id]/presign) ; on garde
            // un retry pour survivre à une coupure réseau brève.
            setInfo(`Upload du replay vers R2 (${Math.round(sizeMB)}MB) — patientez...`);
            let uploadOk = false;
            let uploadErrMsg = "";
            for (let attempt = 1; attempt <= 2 && !uploadOk; attempt++) {
              try {
                const uploadRes = await fetch(uploadUrl, {
                  method: "PUT",
                  body: recordingBlob,
                  headers: { "Content-Type": "video/webm" },
                });
                if (uploadRes.ok) { uploadOk = true; break; }
                uploadErrMsg = `HTTP ${uploadRes.status}`;
              } catch (err) {
                uploadErrMsg =
                  err instanceof TypeError
                    ? "Failed to fetch (réseau ou CORS du bucket R2 — exécutez /admin/r2-test pour le diagnostic exact)"
                    : err instanceof Error ? err.message : "erreur réseau";
              }
              if (attempt < 2) {
                console.warn(`[studio] Upload R2 tentative ${attempt} échouée (${uploadErrMsg}) — nouvelle tentative...`);
                await new Promise((r) => setTimeout(r, 1500));
              }
            }
            if (!uploadOk) {
              throw new Error(`Upload R2 échoué: ${uploadErrMsg}`);
            }
            recordingUrl = publicUrl;
            console.log("[studio] Replay uploadé (R2 direct):", recordingUrl);
            setInfo(`✓ Replay uploadé vers R2 (${Math.round(sizeMB)}MB)`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "erreur inconnue";
          console.error("[studio] Upload replay failed:", errMsg);
          setError(`Upload replay échoué: ${errMsg}`);
          setInfo(`Upload échoué — téléchargement local du replay...`);
          // Téléchargement local en fallback
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

      const res = await apiFetch("/api/live/stop", {
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
      // ⭐ V2.9 — Poll de stats temps réel
      if (statsPollRef.current) clearInterval(statsPollRef.current);
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
    <div className="min-h-screen bg-[#FAF6EF] text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="border-b border-[#8A8378]/15 px-6 py-3 flex items-center justify-between bg-[#FAF6EF]">
        <div className="flex items-center gap-4">
          <Link href="/admin/lives" className="text-xs text-[#1E0F2B]/50 hover:text-[#C9A227] transition-colors">← Lives</Link>
          <div className="h-4 w-px bg-[#2A0E3D]/5" />
          <div>
            <h1 className="text-base font-bold text-[#1E0F2B] truncate max-w-[400px]">{title}</h1>
            <p className="text-[11px] text-[#1E0F2B]/40">{servantName} · Studio Live</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLive ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-[#1E0F2B] text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                EN DIRECT · {formatDuration(streamDuration)}
              </span>
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#2A0E3D]/5 text-[#1E0F2B]/70 text-xs font-bold">
                <Eye className="w-3 h-3" />{viewerCount}
              </div>
            </div>
          ) : status === "ENDED" ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2A0E3D]/5 text-[#1E0F2B]/40 text-xs font-bold">TERMINÉ</span>
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
            {/* Vidéo source — invisible mais ACTIVE (opacity:0.01 empêche Chrome de geler les frames) */}
            {/* Le canvas est au-dessus (zIndex:1) et masque visuellement la vidéo (zIndex:0) */}
            <video ref={videoRef} autoPlay muted playsInline
              className="absolute inset-0 w-full h-full object-contain"
              style={{ opacity: 0.01, pointerEvents: "none", zIndex: 0 }} />
            <canvas ref={canvasRef} width={1280} height={720}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ zIndex: 1 }} />

            {!cameraOn && cameraReady && !screenSharing && !isPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 text-[#1E0F2B]/30 mx-auto mb-2" />
                  <p className="text-sm text-[#1E0F2B]/50">Caméra désactivée</p>
                </div>
              </div>
            )}
            {!cameraReady && !cameraDiag && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                {/* ⭐ V3.27 — miniature du live en fond pendant l'init (fini
                    le « noir » à l'entrée du module) */}
                {thumbnailUrl && (
                   
                  <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />
                )}
                <div className="relative text-center">
                  <Loader2 className="w-10 h-10 text-[#C9A227] mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-[#FAF6EF]/80">Initialisation de la caméra...</p>
                </div>
              </div>
            )}
            {cameraDiag && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1A0826]/95 z-10 overflow-y-auto">
                {thumbnailUrl && (
                   
                  <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 blur-sm pointer-events-none" />
                )}
                <div className="relative max-w-xl mx-4 text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-lg font-bold text-[#FAF6EF]">Caméra inaccessible</p>
                  <p className="text-sm font-semibold text-[#C9A227] mt-1">{cameraDiag.reason}</p>
                  <p className="text-sm text-[#FAF6EF]/75 mt-3 text-left leading-relaxed">{cameraDiag.hint}</p>
                  <button onClick={() => initCamera()}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#0F0F0F] font-bold text-sm hover:bg-[#DDBE55] transition-colors">
                    <RotateCcw className="w-4 h-4" />Réessayer
                  </button>
                  <p className="text-[11px] text-[#FAF6EF]/40 mt-3">« Réessayer » relance la caméra sans recharger la page — utilisez-le après avoir modifié les autorisations.</p>
                </div>
              </div>
            )}

            {isPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1A0826]/90 backdrop-blur-sm pointer-events-none z-30">
                {/* Miniature du live en fond si disponible */}
                {thumbnailUrl && (
                   
                  <img src={thumbnailUrl} alt="Miniature" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-20 h-20 rounded-full bg-[#C9A227]/20 flex items-center justify-center mx-auto mb-4">
                    <Pause className="w-10 h-10 text-[#C9A227]" fill="currentColor" />
                  </div>
                  <p className="text-xl font-bold text-[#C9A227]">Diffusion en pause</p>
                  <p className="text-xs text-[#1E0F2B]/50 mt-2">Les viewers voient la miniature du live</p>
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
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${isPaused ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-red-600 text-[#1E0F2B]"}`}>
                    {isPaused ? <><Pause className="w-3 h-3" fill="currentColor" /> PAUSE</> : <><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE</>}
                  </span>
                )}
                {isLive && isRecording && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#2A0E3D]/5 text-[#1E0F2B] text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> REC
                  </span>
                )}
                {!isLive && status !== "ENDED" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2A0E3D]/5 text-[#1E0F2B] text-xs font-bold">HORS LIGNE</span>
                )}
              </div>
              {isLive && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2A0E3D]/80 text-white text-xs font-bold backdrop-blur-sm"><Clock className="w-3 h-3" />{formatDuration(streamDuration)}</span>
                  {/* ⭐ V2.9 — Vraies métriques dans le HUD (fini le bitrate
                      aléatoire) : spectateurs + messages de chat. */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2A0E3D]/80 text-white text-xs font-bold backdrop-blur-sm"><Eye className="w-3 h-3" />{viewerCount} <span className="font-normal opacity-70">spec.</span></span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2A0E3D]/80 text-white text-xs font-bold backdrop-blur-sm"><MessageCircle className="w-3 h-3" />{chatMessageCount}</span>
                </div>
              )}
            </div>

            {/* HUD bottom */}
            <div className={`absolute bottom-4 left-4 right-4 flex items-end justify-between z-20 transition-opacity duration-300 ${showControls || !isLive ? "opacity-100" : "opacity-0"}`}>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2A0E3D]/80 text-white text-xs font-bold backdrop-blur-sm">{servantName}</span>
                {screenSharing && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-[#1E0F2B] text-xs font-bold"><Monitor className="w-3 h-3" /> Partage d'écran</span>
                )}
              </div>
              {isLive && (
                <button onClick={toggleFullscreen}
                  className="p-2 rounded-md bg-[#2A0E3D]/80 text-white hover:bg-[#2A0E3D] transition-colors backdrop-blur-sm"
                  title={isFullscreen ? "Quitter plein écran" : "Plein écran"}>
                  {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
            </div>

            {isLive && <LiveReactions liveId={liveId} isLive={isLive} />}
          </div>

          {/* Source mode selector — Webcam vs Encodeur externe (OBS) */}
          <div className="bg-white rounded-xl p-3 border border-[#8A8378]/15">
            <div className="flex items-center gap-2 mb-2">
              <Cast className="w-4 h-4 text-[#C9A227]" />
              <span className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider">Source vidéo</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSourceModeChange("webcam")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${sourceMode === "webcam" ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10"}`}
              >
                <Video className="w-4 h-4" />
                Webcam
              </button>
              <button
                onClick={() => handleSourceModeChange("encoder")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${sourceMode === "encoder" ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10"}`}
              >
                <Cast className="w-4 h-4" />
                Encodeur externe (OBS)
              </button>
            </div>

            {/* Encoder info panel */}
            {sourceMode === "encoder" && ingressInfo && (
              <div className="mt-3 space-y-2 p-3 rounded-lg bg-[#FAF6EF] border border-[#8A8378]/15">
                <p className="text-xs font-bold text-[#C9A227] uppercase tracking-wider mb-2">
                  Configuration OBS Studio
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-[#1E0F2B]/50 uppercase">URL du serveur RTMP</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={ingressInfo.rtmpUrl}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white text-xs text-[#1E0F2B] font-mono border border-[#8A8378]/15"
                      />
                      <button
                        onClick={() => copyToClipboard(ingressInfo.rtmpUrl, "rtmpUrl")}
                        className="p-1.5 rounded-lg bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10"
                      >
                        {copiedField === "rtmpUrl" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#1E0F2B]/50 uppercase">Clé de stream</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={ingressInfo.streamKey}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white text-xs text-[#1E0F2B] font-mono border border-[#8A8378]/15"
                      />
                      <button
                        onClick={() => copyToClipboard(ingressInfo.streamKey, "streamKey")}
                        className="p-1.5 rounded-lg bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10"
                      >
                        {copiedField === "streamKey" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[#8A8378]/15">
                  <ol className="space-y-1">
                    {ingressInfo.obsInstructions.map((step, i) => (
                      <li key={i} className="text-[10px] text-[#1E0F2B]/60">{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
            {sourceMode === "encoder" && !ingressInfo && (
              <div className="mt-3 flex items-center justify-center py-3">
                <Loader2 className="w-5 h-5 text-[#C9A227] animate-spin" />
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="bg-white rounded-xl p-3 border border-[#8A8378]/15">
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <button onClick={toggleCamera} disabled={!cameraReady}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${cameraOn ? "bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10" : "bg-red-600/20 text-red-400 hover:bg-red-600/30"}`}>
                {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{cameraOn ? "Caméra" : "Caméra off"}</span>
              </button>
              <button onClick={toggleMic} disabled={!cameraReady}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${micOn ? "bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10" : "bg-red-600/20 text-red-400 hover:bg-red-600/30"}`}>
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{micOn ? "Micro" : "Micro off"}</span>
              </button>
              <button onClick={toggleScreenShare}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${screenSharing ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30" : "bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10"}`}>
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
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isPaused ? "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]" : "bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10"}`}
                  title={isPaused ? "Reprendre le live" : "Mettre en pause"}>
                  {isPaused ? <Play className="w-4 h-4" fill="currentColor" /> : <Pause className="w-4 h-4" fill="currentColor" />}
                  <span className="hidden sm:inline">{isPaused ? "Reprendre" : "Pause"}</span>
                </button>
              )}

              <div className="h-8 w-px bg-[#2A0E3D]/5 mx-1" />

              {!isLive && status !== "ENDED" ? (
                <button onClick={goLive} disabled={loading || !cameraReady}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 text-[#1E0F2B] font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  {loading ? "Démarrage..." : "Go Live"}
                </button>
              ) : isLive ? (
                <button onClick={() => setShowStopModal(true)} disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#2A0E3D]/5 text-[#1E0F2B] font-bold text-sm hover:bg-[#2A0E3D]/10 transition-colors disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" fill="currentColor" />}
                  Terminer
                </button>
              ) : null}
            </div>

            {reconnecting && (
              <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#8B6914] text-sm">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>Reconnexion à la diffusion en cours… (l'état de pause et la durée réelle sont restaurés)</span>
              </div>
            )}
            {error && (
              <div className="mt-3 flex items-start gap-2 px-4 py-2.5 rounded-lg bg-red-600/10 border border-red-600/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="min-w-0">{error}</span>
                <button onClick={() => setError("")} className="ml-auto p-0.5 rounded hover:bg-red-600/20 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
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
          <div className="bg-white rounded-xl p-4 border border-[#8A8378]/15 space-y-3">
            <h2 className="text-base font-bold text-[#1E0F2B]">{title}</h2>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                {servantPortraitUrl ? (
                   
                  <img src={servantPortraitUrl} alt={servantName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2A0E3D] to-[#3D1A54] flex items-center justify-center text-[#C9A227] font-bold text-sm">
                    {servantName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-[#1E0F2B] flex items-center gap-1">{servantName}<CheckCircle2 className="w-3.5 h-3.5 text-[#C9A227]" /></p>
                  <p className="text-[11px] text-[#1E0F2B]/40">{isLive ? `En direct · ${viewerCount} spectateur${viewerCount > 1 ? "s" : ""}` : "Studio de diffusion"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-[#1E0F2B] text-xs font-bold"><Radio className="w-3 h-3" />{formatDuration(streamDuration)}</span>
                )}
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#2A0E3D]/5 text-[#1E0F2B]/60 text-xs font-bold"><Eye className="w-3 h-3" />{viewerCount} spectateurs</span>
                )}
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#2A0E3D]/5 text-[#1E0F2B]/60 text-xs font-bold"><Heart className="w-3 h-3" />{likesTotal}</span>
                )}
              </div>
            </div>
          </div>

          {/* Advanced settings */}
          <div className="bg-white rounded-xl overflow-hidden border border-[#8A8378]/15">
            <button onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#2A0E3D]/5 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold text-[#1E0F2B]"><Settings className="w-4 h-4 text-[#1E0F2B]/60" />Paramètres de diffusion</span>
              {showAdvancedSettings ? <ChevronUp className="w-4 h-4 text-[#1E0F2B]/40" /> : <ChevronDown className="w-4 h-4 text-[#1E0F2B]/40" />}
            </button>
            {showAdvancedSettings && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#8A8378]/15">
                <div className="flex items-center justify-between pt-3"><span className="text-xs text-[#1E0F2B]/50">Qualité vidéo</span><span className="text-xs font-bold text-[#1E0F2B]">720p · H.264</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#1E0F2B]/50">Qualité audio</span><span className="text-xs font-bold text-[#1E0F2B]">Opus · Stéréo</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#1E0F2B]/50">Spectateurs</span><span className="text-xs font-bold text-[#1E0F2B]">{isLive ? String(viewerCount) : "—"}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#1E0F2B]/50">Room LiveKit</span><span className="text-xs font-mono text-[#1E0F2B]/40 truncate max-w-[200px]">{roomName}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#1E0F2B]/50">Réseau de diffusion</span><span className="text-xs font-bold text-[#1E0F2B]">{mediaProvider === "livekit" ? "LiveKit (source de vérité)" : mediaProvider === "agora" ? "Agora (repli)" : "Daily (repli)"}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#1E0F2B]/50">Mode viewers</span><span className="text-xs font-bold text-[#1E0F2B]">{mediaProvider === "livekit" ? "YouTube (HLS, 0 participant)" : "Spectateurs (repli)"}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#1E0F2B]/50">Mode</span><span className="text-xs font-bold text-[#1E0F2B]">{isPaused ? "En pause" : isLive ? "Diffusion active" : "En attente"}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#8A8378]/15">
            <button onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "chat" ? "bg-[#2A0E3D] text-white" : "text-[#1E0F2B]/50 hover:text-[#1E0F2B]"}`}>
              <MessageCircle className="w-3.5 h-3.5" />Chat
            </button>
            <button onClick={() => setActiveTab("stats")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "stats" ? "bg-[#2A0E3D] text-white" : "text-[#1E0F2B]/50 hover:text-[#1E0F2B]"}`}>
              <BarChart3 className="w-3.5 h-3.5" />Stats
            </button>
            <button onClick={() => setActiveTab("health")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "health" ? "bg-[#2A0E3D] text-white" : "text-[#1E0F2B]/50 hover:text-[#1E0F2B]"}`}>
              <Activity className="w-3.5 h-3.5" />Santé
            </button>
          </div>

          {activeTab === "chat" && (
            <div className="h-[calc(100vh-280px)]">
              {isLive ? <LiveChat liveId={liveId} isLive={isLive} /> : (
                <div className="flex items-center justify-center h-full bg-white rounded-xl border border-[#8A8378]/15">
                  <div className="text-center">
                    <MessageCircle className="w-8 h-8 text-[#1E0F2B]/20 mx-auto mb-2" />
                    <p className="text-xs text-[#1E0F2B]/40 italic">Le chat sera disponible en direct</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="bg-white rounded-xl p-4 space-y-4 border border-[#8A8378]/15">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider font-bold text-[#1E0F2B]/40">Statistiques en direct</h3>
                {/* ⭐ V2.9 — Indicateur de fraîcheur : les stats sont réellement
                    rafraîchies toutes les 5 s pendant la diffusion. */}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isLive ? "Temps réel · 5 s" : "En pause"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#2A0E3D]/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-[#1E0F2B]/40 uppercase mb-1"><Eye className="w-3 h-3" />Spectateurs (site)</div>
                  <div className="text-2xl font-bold text-[#1E0F2B]">{isLive ? viewerCount : "—"}</div>
                </div>
                <div className="bg-[#2A0E3D]/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-[#1E0F2B]/40 uppercase mb-1"><Clock className="w-3 h-3" />Durée</div>
                  <div className="text-2xl font-bold text-[#1E0F2B]">{isLive ? formatDuration(streamDuration) : "—"}</div>
                </div>
                <div className="bg-[#2A0E3D]/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-[#1E0F2B]/40 uppercase mb-1"><MessageCircle className="w-3 h-3" />Messages chat</div>
                  <div className="text-2xl font-bold text-[#1E0F2B]">{isLive ? chatMessageCount : "—"}</div>
                </div>
                <div className="bg-[#2A0E3D]/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-[10px] text-[#1E0F2B]/40 uppercase mb-1"><Heart className="w-3 h-3" />J&apos;aime (site)</div>
                  <div className="text-2xl font-bold text-[#1E0F2B]">{isLive ? likesTotal : "—"}</div>
                </div>
              </div>

              {/* ⭐ V2.9 — Stats YouTube RÉELLES (si OAuth configuré) : vues et
                  likes du direct YouTube, rafraîchis toutes les 5 s —
                  avant : toujours zéro (aucun appel n'existait côté studio). */}
              <div className="pt-3 border-t border-[#8A8378]/15">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-[#1E0F2B]/40 uppercase tracking-wider flex items-center gap-1.5">
                    <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />YouTube
                  </p>
                  {!youtubeConfigured && (
                    <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      OAuth YouTube non configuré
                    </span>
                  )}
                </div>
                {youtubeStats ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#FF0000]/5 rounded-lg p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-[#1E0F2B]/40 uppercase mb-0.5"><Eye className="w-3 h-3" />Vues</div>
                      <div className="text-xl font-bold text-[#1E0F2B]">{youtubeStats.viewCount.toLocaleString("fr-FR")}</div>
                    </div>
                    <div className="bg-[#FF0000]/5 rounded-lg p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-[#1E0F2B]/40 uppercase mb-0.5"><Heart className="w-3 h-3" />J&apos;aime</div>
                      <div className="text-xl font-bold text-[#1E0F2B]">{youtubeStats.likeCount.toLocaleString("fr-FR")}</div>
                    </div>
                    <div className="bg-[#FF0000]/5 rounded-lg p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-[#1E0F2B]/40 uppercase mb-0.5"><MessageCircle className="w-3 h-3" />Comm.</div>
                      <div className="text-xl font-bold text-[#1E0F2B]">{youtubeStats.commentCount.toLocaleString("fr-FR")}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#1E0F2B]/40 italic">
                    {youtubeConfigured
                      ? "Aucune donnée YouTube (URL manquante ou direct non démarré côté YouTube)."
                      : "Configurez YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN sur Vercel pour les stats YouTube en direct."}
                  </p>
                )}
              </div>

              {isLive && (
                <div className="pt-3 border-t border-[#8A8378]/15">
                  <p className="text-[10px] text-[#1E0F2B]/40 uppercase tracking-wider mb-2">État</p>
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
            <div className="bg-white rounded-xl p-4 space-y-4 border border-[#8A8378]/15">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[#1E0F2B]/40">État de la diffusion</h3>
              <div className="space-y-2">
                {[
                  { label: "Connexion caméra", ok: cameraReady },
                  { label: "Connexion LiveKit", ok: isLive },
                  { label: "Flux vidéo", ok: isLive && cameraOn && !isPaused },
                  { label: "Flux audio", ok: isLive && micOn && !isPaused },
                  { label: "Overlay canvas", ok: !!overlayStreamRef.current },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-[#8A8378]/15">
                    <span className="text-xs text-[#1E0F2B]/70">{item.label}</span>
                    {item.ok ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold"><CheckCircle2 className="w-3 h-3" />OK</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-[#1E0F2B]/30"><AlertCircle className="w-3 h-3" />—</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <h4 className="text-xs uppercase tracking-wider font-bold text-[#1E0F2B]/40 mb-2">Multistreaming</h4>
                <div className="space-y-1.5">
                  {[
                    { label: "YouTube", active: multistream.youtube, icon: Youtube, color: "#FF0000" },
                    { label: "Facebook", active: multistream.facebook, icon: Facebook, color: "#1877F2" },
                    { label: "TikTok", active: multistream.tiktok, icon: Music2, color: "#000000" },
                    { label: "Instagram", active: multistream.instagram, icon: Instagram, color: "#E1306C" },
                  ].map((p) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.label} className={`flex items-center justify-between px-3 py-2 rounded-lg ${p.active ? "bg-[#2A0E3D]/5" : "opacity-40"}`}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                          <span className="text-xs font-medium text-[#1E0F2B]">{p.label}</span>
                        </div>
                        {p.active && isLive ? (
                          <span className="text-xs text-emerald-400 font-bold">● En direct</span>
                        ) : p.active ? (
                          <span className="text-xs text-[#1E0F2B]/40">En attente</span>
                        ) : (
                          <span className="text-xs text-[#1E0F2B]/30">Off</span>
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

      {/* Stop modal — design personnalisé façon studio */}
      {showStopModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1A0826]/80 backdrop-blur-md" onClick={() => !loading && setShowStopModal(false)} />

          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl border border-[#C9A227]/20">
            {/* Bandeau dégradé */}
            <div className="relative h-32 bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#1A0826] overflow-hidden">
              {/* Halo doré */}
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#C9A227]/20 blur-3xl" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-red-600/10 blur-3xl" />

              {/* Icône stop pulsante */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-red-600/30 animate-ping" />
                  <div className="relative w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-xl">
                    <Square className="w-7 h-7 text-white" fill="currentColor" />
                  </div>
                </div>
              </div>

              {/* Bouton fermer */}
              {!loading && (
                <button
                  onClick={() => setShowStopModal(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Corps */}
            <div className="bg-[#FAF6EF] px-7 py-6">
              {/* Titre */}
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  Terminer la diffusion ?
                </h2>
                <p className="text-sm text-[#1E0F2B]/60 mt-2 leading-relaxed">
                  Votre live sera arrêté et archivé en replay automatiquement.
                  <br />
                  <span className="text-[#8A8378] text-xs">Cette action est irréversible.</span>
                </p>
              </div>

              {/* Stats du live */}
              {isLive && (
                <div className="grid grid-cols-3 gap-2 mb-5">
                  <div className="bg-white rounded-xl p-3 text-center border border-[#8A8378]/10">
                    <Clock className="w-4 h-4 text-[#C9A227] mx-auto mb-1" />
                    <div className="text-base font-bold text-[#1E0F2B]">{formatDuration(streamDuration)}</div>
                    <div className="text-[9px] uppercase tracking-wider text-[#8A8378]">Durée</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-[#8A8378]/10">
                    <Users className="w-4 h-4 text-[#C9A227] mx-auto mb-1" />
                    <div className="text-base font-bold text-[#1E0F2B]">{viewerCount}</div>
                    <div className="text-[9px] uppercase tracking-wider text-[#8A8378]">Spectateurs</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-[#8A8378]/10">
                    <Radio className="w-4 h-4 text-[#C9A227] mx-auto mb-1" />
                    <div className="text-base font-bold text-[#1E0F2B]">{isRecording ? "OUI" : "—"}</div>
                    <div className="text-[9px] uppercase tracking-wider text-[#8A8378]">Enregistrement</div>
                  </div>
                </div>
              )}

              {/* Avertissement */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#C9A227]/5 border border-[#C9A227]/15 mb-4">
                <AlertCircle className="w-4 h-4 text-[#C9A227] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#1E0F2B]/70 leading-relaxed">
                  Le replay sera généré et publié sur la page Vidéos.
                  {multistream.youtube
                    ? " Une copie YouTube sera aussi disponible comme source de secours."
                    : ""}
                </p>
              </div>

              {/* URL YouTube du replay (si multistream YouTube) */}
              {multistream.youtube && (
                <div className="mb-4 px-3 py-3 rounded-xl bg-[#2A0E3D]/5 border border-[#8A8378]/15">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Youtube className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-xs font-bold text-[#1E0F2B]">URL YouTube du replay</span>
                    <span className="text-[10px] text-[#8A8378]">(optionnel — économise le stockage R2)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeReplayUrl}
                      onChange={(e) => setYoutubeReplayUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 px-2.5 py-2 rounded-lg border border-[#8A8378]/20 bg-white text-xs focus:outline-none focus:border-[#C9A227]"
                    />
                    <button
                      onClick={handleFetchYoutubeReplay}
                      disabled={fetchingYoutubeReplay}
                      className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-40 whitespace-nowrap flex items-center gap-1"
                    >
                      {fetchingYoutubeReplay ? <Loader2 className="w-3 h-3 animate-spin" /> : <Youtube className="w-3 h-3" />}
                      Auto
                    </button>
                  </div>
                  <p className="text-[10px] text-[#8A8378] mt-1.5 leading-relaxed">
                    Collez l'URL YouTube ou cliquez "Auto" pour la récupérer via l'API.
                    Si vide, le replay utilisera l'enregistrement R2 (si disponible).
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowStopModal(false)}
                  disabled={loading}
                  className="flex-1 px-5 py-3 rounded-xl text-sm font-bold text-[#1E0F2B]/60 hover:text-[#1E0F2B] hover:bg-[#2A0E3D]/5 transition-colors disabled:opacity-40"
                >
                  Continuer le live
                </button>
                <button
                  onClick={confirmStopLive}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-40 shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Arrêt en cours...
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" fill="currentColor" />
                      Terminer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
