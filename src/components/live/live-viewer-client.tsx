"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useRef } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useSession } from "next-auth/react";
import {
  Radio, Eye, Calendar, AlertCircle,
  Heart, Bookmark, MoreHorizontal,
  CheckCircle2, ChevronDown, ChevronUp, Clock, Users, X,
} from "lucide-react";
import Link from "next/link";
import { LiveChat } from "@/components/live/live-chat";
import { LiveReactions } from "@/components/live/live-reactions";
import { VideoPlayerPro } from "@/components/live/video-player-pro";
import { LiveJoinModal } from "@/components/live/live-join-modal";
import { ShareButton } from "@/components/live/share-button";

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
  const { data: session, status } = useSession();
  const [countdown, setCountdown] = useState("");
  const [isLive, setIsLive] = useState(live.status === "LIVE");
  // ⭐ V2.9 — Le direct vient d'être arrêté pendant qu'on le regardait :
  // l'écran « coupe » (écran de fin + déconnexion), plutôt que de rester
  // sur un lecteur figé « en attente ».
  const [liveEnded, setLiveEnded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [waitingForStream, setWaitingForStream] = useState(false);
  const [streamReceived, setStreamReceived] = useState(false);
  const [liveDuration, setLiveDuration] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [liked, setLiked] = useState(false);
  const [viewerPaused, setViewerPaused] = useState(false);
  // (YT-pause) pausedAt côté viewer — quand le live est en pause, on gèle la
  // minuterie sur (pausedAt - startedAt) au lieu de continuer à compter.
  const [livePausedAt, setLivePausedAt] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [hasJoined, setHasJoined] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [viewerFirstName, setViewerFirstName] = useState<string>("");
  const [checkingMember, setCheckingMember] = useState(true);
  // (C6) startedAt fraîche récupérée via le poll /api/live/next.
  // La prop SSR live.startedAt est stale dès que le live démarre après le
  // rendu initial (elle reste null si la page a été chargée en SCHEDULED).
  const [liveStartedAt, setLiveStartedAt] = useState<string | null>(live.startedAt);

  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const streamReceivedRef = useRef(false);
  // (C1) Refs pour éviter les reconnexions LiveKit inutiles
  const hasConnectedRef = useRef(false);
  const viewerFirstNameRef = useRef(viewerFirstName);
  useEffect(() => {
    viewerFirstNameRef.current = viewerFirstName;
  }, [viewerFirstName]);

  // ─── Auto-join pour utilisateurs NextAuth connectés ───
  useEffect(() => {
    if (status === "loading") return; // Attendre que la session soit résolue

    if (status === "authenticated" && session?.user) {
      // Utilisateur connecté via NextAuth → auto-join (pas de modal)
      setMemberId(session.user.id || null);
      setViewerFirstName(session.user.name || "Membre");
      setHasJoined(true);
      setCheckingMember(false);

      // Créer/mettre à jour le LiveMember si pas déjà fait
      const sessionId = localStorage.getItem("live-session-id");
      if (sessionId) {
        apiFetch("/api/live-members/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            firstName: session.user.name || "Membre",
          }),
        }).catch(() => {});
      }
      return;
    }

    // Utilisateur non connecté → vérifier le LiveMember en localStorage
    const sid = localStorage.getItem("live-session-id");
    if (!sid) {
      setCheckingMember(false);
      return;
    }

    const checkMember = async () => {
      try {
        const res = await apiFetch(`/api/live-members/me?sessionId=${sid}`);
        const data = await res.json();
        if (data.member) {
          setMemberId(data.member.id);
          setViewerFirstName(data.member.firstName);
          localStorage.setItem("live-chat-username", data.member.firstName);
          setHasJoined(true);
        }
      } catch {}
      setCheckingMember(false);
    };

    checkMember();
  }, [status, session]);

  // Compte à rebours
  useEffect(() => {
    if (live.status !== "SCHEDULED") return;
    const update = () => {
      const target = new Date(live.scheduledAt).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("Le live commence maintenant..."); return; }
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
  // (YT-pause) Pour les lives YouTube, on continue à poller même après le
  // démarrage du live, pour récupérer l'état de pause (isPaused / pausedAt)
  // côté serveur — les viewers YouTube ne reçoivent pas le DataChannel LiveKit.
  // Pour les lives LiveKit purs, on arrête de poller une fois qu'on a startedAt
  // (le signal de pause arrive via DataChannel, pas besoin de polling).
  // ⭐ V2.9 — ARRÊT DU DIRECT : on poll TOUJOURS pendant le direct (10 s).
  // Quand le statut passe à ENDED (stop depuis le back-office, quick-action
  // ou webhook), l'écran du viewer COUPE : « Direct terminé » + déconnexion
  // de la room LiveKit — « lorsque le direct est arrêté, l'écran de tout le
  // monde doit couper ».
  useEffect(() => {
    const isYoutubeLive = !!live.youtubeUrl;
    // Poller tant que :
    //  - le live est SCHEDULED (attente du démarrage), OU
    //  - le live est LIVE mais startedAt n'est pas encore connu, OU
    //  - le live est LIVE via YouTube (pause), OU
    //  - ⭐ V2.9 : le live est LIVE, point final (détection d'arrêt).
    if (live.status !== "SCHEDULED" && !(isLive && !liveStartedAt) && !isLive) return;
    const checkStatus = async () => {
      try {
        const res = await apiFetch("/api/live/next");
        const data = await res.json();
        if (data.live?.id === live.id) {
          if (data.live.status === "LIVE") {
            setIsLive(true);
          }
          // ⭐ V2.9 — Le direct vient d'être ARRÊTÉ côté back-office :
          // couper l'écran du viewer.
          else if (data.live.status === "ENDED" || data.live.status === "CANCELLED") {
            if (isLive) {
              setLiveEnded(true);
              setIsLive(false);
              // Déconnecter la room LiveKit (arrête la lecture/les pistes).
              try { roomRef.current?.disconnect(); roomRef.current = null; } catch {}
            }
            return;
          }
          // (C6) Récupérer startedAt fraîche depuis l'API
          if (data.live.startedAt) {
            setLiveStartedAt(data.live.startedAt);
          }
          // (YT-pause) Sync pause state depuis l'API (pour les viewers YouTube)
          if (isYoutubeLive) {
            const paused = !!data.live.isPaused;
            setViewerPaused(paused);
            setLivePausedAt(data.live.pausedAt || null);
          }
        } else if (data.live?.id && data.live.id !== live.id && isLive) {
          // Un AUTRE live est passé devant (le nôtre est terminé/enterré)
          setLiveEnded(true);
          setIsLive(false);
          try { roomRef.current?.disconnect(); roomRef.current = null; } catch {}
        }
      } catch {}
    };
    checkStatus();
    // ⭐ V2.9 : 10 s pendant le direct (arrêt détecté en < 10 s), 3 s pour
    // les lives YouTube (pause), 30 s en attente de démarrage.
    const intervalMs = isLive ? (isYoutubeLive ? 3000 : 10000) : 30000;
    const interval = setInterval(checkStatus, intervalMs);
    return () => clearInterval(interval);
  }, [live.status, live.id, live.youtubeUrl, isLive, liveStartedAt]);

  // Compteur viewers réel depuis l'API
  useEffect(() => {
    if (!isLive) return;
    const fetchViewers = async () => {
      try {
        const res = await apiFetch(`/api/live/${live.id}/viewers`);
        const data = await res.json();
        setViewerCount(data.count || 0);
      } catch {}
    };
    fetchViewers();
    const interval = setInterval(fetchViewers, 5000);
    return () => clearInterval(interval);
  }, [isLive, live.id]);

  // Durée du live (affichée côté viewer) — s'arrête en pause
  // (YT-pause) Pour les viewers YouTube, on gèle la minuterie sur
  // (pausedAt - startedAt) pendant la pause, plutôt que de juste cacher
  // l'overlay. Ainsi le badge PAUSE affiche une durée figée cohérente
  // avec ce que voit le studio.
  useEffect(() => {
    if (!isLive || !liveStartedAt) return;
    // Si en pause ET qu'on a un pausedAt côté serveur → afficher la durée
    // figée (pausedAt - startedAt) et ne pas faire tourner le setInterval.
    if (viewerPaused && livePausedAt) {
      const elapsed = Math.floor((new Date(livePausedAt).getTime() - new Date(liveStartedAt).getTime()) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      setLiveDuration(h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`);
      return;
    }
    // Si en pause sans pausedAt (cas LiveKit DataChannel) → geler
    if (viewerPaused) return;
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(liveStartedAt).getTime()) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      setLiveDuration(h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isLive, liveStartedAt, viewerPaused, livePausedAt]);

  // ═══════════════════════════════════════════════════════════════════
  // (C1) Effet 1 : Enregistrement viewer en DB (POST /viewers)
  // Séparé de la connexion LiveKit pour éviter les reconnexions quand
  // memberId/viewerFirstName changent après le join.
  // ⭐ V2.9 :
  //   - HEARTBEAT toutes les 25 s (le compteur GET ne compte que les
  //     sessions vues il y a < 90 s — corrige « nombre de spectateurs
  //     toujours à zéro / pas mis à jour ») ;
  //   - sendBeacon corrigé (?leave=1, corps vide toléré par la route —
  //     avant, req.json() sur corps vide → 500 → départ jamais enregistré) ;
  //   - les utilisateurs connectés envoient leur User.id : la route le
  //     résout automatiquement en LiveMember (V2.9).
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLive || !hasJoined || !memberId) return;

    // Enregistrer la présence du viewer côté serveur
    const postPresence = () => {
      apiFetch(`/api/live/${live.id}/viewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      }).catch(() => {});
    };
    postPresence();
    // ⭐ V2.9 — Heartbeat de présence (25 s < fenêtre serveur de 90 s)
    const heartbeat = setInterval(postPresence, 25000);

    // Déconnexion à la fermeture de la page (sendBeacon)
    const handleBeforeUnload = () => {
      navigator.sendBeacon(`/api/live/${live.id}/viewers?memberId=${encodeURIComponent(memberId)}&leave=1`, "");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Marquer comme inactif (leave)
      apiFetch(`/api/live/${live.id}/viewers?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" }).catch(() => {});
    };
  }, [isLive, hasJoined, memberId, live.id]);

  // ═══════════════════════════════════════════════════════════════════
  // (C1) Effet 2 : Connexion LiveKit subscriber — deps MINIMALES
  // [isLive, live.livekitRoomName, live.youtubeUrl, hasJoined]
  // memberId et viewerFirstName sont retirés des deps (lus via refs)
  // pour éviter déconnexion/reconnexion rapide → track détaché.
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLive || !live.livekitRoomName || live.youtubeUrl) return;
    if (!hasJoined) return; // Ne se connecte que si le viewer a rejoint
    // (C1) Éviter les reconnexions inutiles si l'effet se ré-exécute
    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;

    let cancelled = false;
    // (H1) Éléments <audio> attachés au DOM (Safari/iOS exige qu'ils soient
    // dans le document pour pouvoir les jouer). Nettoyés au unmount/déconnexion.
    const attachedAudioEls: HTMLAudioElement[] = [];

    streamReceivedRef.current = false;

    const connectToRoom = async () => {
      setConnecting(true);
      setConnectionError("");
      setStreamReceived(false);
      setWaitingForStream(false);
      try {
        const tokenRes = await apiFetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: live.livekitRoomName,
            role: "subscriber",
            participantName: viewerFirstNameRef.current || "Visiteur",
          }),
        });
        if (!tokenRes.ok) {
          const data = await tokenRes.json();
          throw new Error(data.error || "Token LiveKit indisponible");
        }
        const { token, url } = await tokenRes.json();

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        // (C1) Afficher "Connexion perdue" si la room se déconnecte
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) {
            setConnectionError("Connexion perdue — tentative de reconnexion...");
          }
        });

        await room.connect(url, token);

        // (S5) Démarrer le timer d'attente : si aucun track reçu après 4s,
        // afficher l'overlay "En attente du diffuseur". Le studio peut avoir
        // démarré le live côté API sans être encore connecté à LiveKit, ou
        // le flux RTMP vers YouTube n'est pas encore actif.
        const waitTimer = setTimeout(() => {
          if (!cancelled && !streamReceivedRef.current) {
            setWaitingForStream(true);
          }
        }, 4000);

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            streamReceivedRef.current = true;
            setStreamReceived(true);
            setWaitingForStream(false);
            clearTimeout(waitTimer);
            track.attach(videoRef.current);
            videoRef.current.muted = true;
            videoRef.current.play().catch((err) => {
              console.warn("[viewer] Video play failed:", err);
            });
          } else if (track.kind === Track.Kind.Audio) {
            const audioEl = document.createElement("audio");
            audioEl.autoplay = true;
            track.attach(audioEl);
            document.body.appendChild(audioEl);
            attachedAudioEls.push(audioEl);
            audioEl.play().catch(() => {});
          }
        });

        // Écouter les messages DataChannel (pause/play du studio)
        room.on(RoomEvent.DataReceived, (_payload, _participant, _kind, topic) => {
          if (!cancelled && topic === "live-control") {
            try {
              const decoder = new TextDecoder();
              const msg = JSON.parse(decoder.decode(_payload));
              if (msg.action === "pause") setViewerPaused(true);
              else if (msg.action === "resume") setViewerPaused(false);
            } catch {}
          }
        });

        // (H1) Nettoyer l'élément audio quand le track est désabonné
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio) return;
          for (let i = attachedAudioEls.length - 1; i >= 0; i--) {
            const el = attachedAudioEls[i];
            try {
              track.detach(el);
            } catch {}
            try {
              el.pause();
            } catch {}
            el.remove();
            attachedAudioEls.splice(i, 1);
          }
        });

        room.remoteParticipants.forEach((participant) => {
          participant.getTrackPublications().forEach((pub) => {
            if (pub.track && pub.track.kind === Track.Kind.Video && videoRef.current) {
              streamReceivedRef.current = true;
              setStreamReceived(true);
              setWaitingForStream(false);
              clearTimeout(waitTimer);
              pub.track.attach(videoRef.current);
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
            } else if (pub.track && pub.track.kind === Track.Kind.Audio) {
              const audioEl = document.createElement("audio");
              audioEl.autoplay = true;
              pub.track.attach(audioEl);
              // (H1) Attacher au DOM pour Safari/iOS
              document.body.appendChild(audioEl);
              attachedAudioEls.push(audioEl);
              audioEl.play().catch(() => {});
            }
          });
        });

        if (!cancelled) {
          setConnecting(false);
          setConnectionError(""); // Effacer l'éventuel message "Connexion perdue"
        }
      } catch (err) {
        if (!cancelled) {
          setConnectionError(err instanceof Error ? err.message : "Erreur de connexion");
          setConnecting(false);
          // Autoriser une nouvelle tentative si l'effet se ré-exécute
          hasConnectedRef.current = false;
        }
      }
    };

    connectToRoom();

    return () => {
      cancelled = true;
      // (H1) Retirer tous les éléments <audio> du DOM au nettoyage
      for (const el of attachedAudioEls) {
        try {
          el.pause();
        } catch {}
        el.remove();
      }
      attachedAudioEls.length = 0;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      // Réinitialiser pour permettre une reconnexion future si l'effet re-démarre
      hasConnectedRef.current = false;
    };
  }, [isLive, live.livekitRoomName, live.youtubeUrl, hasJoined]);

  const accentColor = live.servantCode === "pam" ? "#C9A227" : "#8C5FA8";
  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : url;
  };

  const handleLike = () => {
    if (liked) { setLiked(false); setLikeCount((c) => Math.max(0, c - 1)); }
    else { setLiked(true); setLikeCount((c) => c + 1); }
  };

  const [showAccountPrompt, setShowAccountPrompt] = useState(false);

  const handleRegistered = (member: { id: string; firstName: string; isAnonymous: boolean }) => {
    setMemberId(member.id);
    setViewerFirstName(member.firstName);
    setHasJoined(true);
    setShowJoinModal(false);

    // Si join anonyme, afficher la notification "Créez un compte" après 3s
    if (member.isAnonymous) {
      setTimeout(() => setShowAccountPrompt(true), 3000);
    }
  };

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* Modal d'inscription unique */}
      <LiveJoinModal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onRegistered={handleRegistered}
        liveTitle={live.title}
      />

      {/* Notification "Créez un compte" (façon YouTube) */}
      {showAccountPrompt && (
        <div className="fixed bottom-6 right-6 z-[90] max-w-sm animate-slideIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#C9A227]/30 p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C9A227]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#C9A227]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1E0F2B] mb-1">
                Bonjour {viewerFirstName} ! 👋
              </p>
              <p className="text-xs text-[#8A8378] leading-relaxed mb-3">
                Créez un compte gratuit pour suivre tous les lives, gagner de l'XP
                et participer à la communauté à tout moment.
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href="/register"
                  className="px-3 py-1.5 rounded-lg bg-[#C9A227] text-[#1E0F2B] text-xs font-bold hover:bg-[#DDBE55] transition-colors"
                >
                  Créer un compte
                </Link>
                <button
                  onClick={() => setShowAccountPrompt(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#8A8378] hover:text-[#1E0F2B] transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowAccountPrompt(false)}
              className="p-0.5 rounded hover:bg-[#8A8378]/10 text-[#8A8378] flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto px-2 md:px-4 py-4">
        <div className="grid lg:grid-cols-[1fr_380px] gap-4">
          {/* ═══ Colonne gauche ═══ */}
          <div className="space-y-3">
            {/* Conteneur vidéo */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
              {/* ⭐ V2.9 — ÉCRAN « DIRECT TERMINÉ » : quand le diffuseur arrête
                  depuis le back-office, l'écran de CHAQUE viewer coupe
                  (demande explicite) — plus de lecteur figé indéfiniment. */}
              {liveEnded && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-[#2A0E3D] to-[#1A0826]">
                  <div className="text-center text-[#FAF6EF] p-8 relative z-10">
                    <div className="w-16 h-16 rounded-full bg-[#8A8378]/20 border-2 border-[#8A8378]/40 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-[#C9A227]" />
                    </div>
                    <p className="text-lg font-bold mb-1">Direct terminé</p>
                    <p className="text-sm text-[#FAF6EF]/60 mb-5 max-w-xs mx-auto">
                      Merci d&apos;avoir rejoint ce direct avec nous. Le replay
                      sera publié prochainement sur la page Vidéos.
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Link href="/videos" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-xs hover:bg-[#DDBE55] transition-colors">
                        Voir les rediffusions
                      </Link>
                      <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#FAF6EF]/30 text-[#FAF6EF] font-medium text-xs hover:bg-white/10 transition-colors">
                        Retour à l&apos;accueil
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              {isLive && live.youtubeUrl && hasJoined && !viewerPaused && (
                <iframe src={getYouTubeEmbedUrl(live.youtubeUrl)} className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              )}
              {isLive && !live.youtubeUrl && hasJoined && (
                <VideoPlayerPro
                  videoRef={videoRef}
                  isLive={isLive}
                  viewerCount={viewerCount}
                  connecting={connecting}
                  connectionError={connectionError}
                  onRetry={() => window.location.reload()}
                />
              )}

              {/* (S5) Overlay "En attente du diffuseur" — quand connecté à LiveKit
                  mais qu'aucun track vidéo n'est reçu (le studio n'est pas encore
                  connecté, ou le flux RTMP vers YouTube n'est pas encore actif). */}
              {isLive && !live.youtubeUrl && hasJoined && waitingForStream && !streamReceived && !connecting && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#1A0826]">
                  {/* Miniature en fond si disponible */}
                  {live.thumbnailUrl && (
                    <img
                      src={live.thumbnailUrl}
                      alt={live.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-20"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#1A0826]/60 to-[#1A0826]" />
                  <div className="relative z-10 text-center px-6">
                    <div className="relative inline-flex mb-5">
                      {/* Halo pulsé */}
                      <div className="absolute inset-0 rounded-full bg-[#C9A227]/20 animate-ping" />
                      <div className="relative w-16 h-16 rounded-full bg-[#C9A227]/10 border-2 border-[#C9A227]/30 flex items-center justify-center">
                        <Radio className="w-7 h-7 text-[#C9A227] animate-pulse" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-[#FAF6EF] mb-2">
                      En attente du diffuseur
                    </h3>
                    <p className="text-sm text-[#FAF6EF]/60 max-w-xs mx-auto leading-relaxed">
                      Le live va commencer dans un instant. La vidéo apparaîtra
                      automatiquement dès que le flux sera actif.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Écran "Rejoindre le live" si pas encore inscrit */}
              {isLive && !hasJoined && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2A0E3D] to-[#1A0826]">
                  {/* Miniature du live en fond si disponible */}
                  {live.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={live.thumbnailUrl} alt={live.title} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2A0E3D] via-[#2A0E3D]/70 to-[#2A0E3D]/50" />
                  <div className="text-center text-[#FAF6EF] p-8 relative z-10">
                    <Radio className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
                    <p className="text-lg font-bold mb-2">Le live est en cours</p>
                    <p className="text-sm text-[#FAF6EF]/60 mb-6">Rejoignez la diffusion pour regarder et participer au chat</p>
                    <button
                      onClick={() => setShowJoinModal(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors shadow-lg"
                    >
                      <Radio className="w-4 h-4" />
                      Rejoindre le live
                    </button>
                  </div>
                </div>
              )}

              {/* Live programmé */}
              {live.status === "SCHEDULED" && !isLive && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2A0E3D] to-[#1A0826]">
                  {/* Miniature en fond si disponible */}
                  {live.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={live.thumbnailUrl} alt={live.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2A0E3D] via-[#2A0E3D]/60 to-[#2A0E3D]/40" />
                  <div className="text-center text-[#FAF6EF] p-8 relative z-10">
                    <Calendar className="w-12 h-12 text-[#C9A227] mx-auto mb-4" />
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227] mb-2">Live programmé</p>
                    <p className="text-xl md:text-2xl font-bold mb-4">{new Date(live.scheduledAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
                    {countdown && (
                      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold">
                        <Clock className="w-4 h-4" />{countdown}
                      </div>
                    )}
                    {/* Bouton pré-inscription */}
                    <div className="mt-4">
                      <button
                        onClick={() => setShowJoinModal(true)}
                        className="text-xs text-[#C9A227] hover:underline"
                      >
                        Pré-inscription →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live terminé */}
              {live.status === "ENDED" && !isLive && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#2A0E3D]">
                  <div className="text-center text-[#FAF6EF] p-8">
                    <AlertCircle className="w-12 h-12 text-[#FAF6EF]/30 mx-auto mb-4" />
                    <p className="text-lg font-bold mb-2">Ce live est terminé</p>
                    <p className="text-sm text-[#FAF6EF]/50">Le replay sera disponible prochainement</p>
                  </div>
                </div>
              )}

              {/* Réactions */}
              {/* Durée du live (overlay) — masqué en pause */}
              {isLive && hasJoined && liveDuration && !viewerPaused && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-600 text-white text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    EN DIRECT · {liveDuration}
                  </span>
                </div>
              )}

              {/* Badge PAUSE côté viewer */}
              {isLive && hasJoined && viewerPaused && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#C9A227] text-[#1E0F2B] text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#1E0F2B]" />
                    PAUSE · {liveDuration}
                  </span>
                </div>
              )}

              {/* Miniature en fond pendant la pause */}
              {isLive && hasJoined && viewerPaused && live.thumbnailUrl && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={live.thumbnailUrl} alt={live.title} className="w-full h-full object-cover opacity-30" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-[#C9A227]/20 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-[#C9A227]" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                      </div>
                      <p className="text-lg font-bold text-[#C9A227]">Diffusion en pause</p>
                      <p className="text-xs text-white/50 mt-1">Le diffuseur reprendra bientôt</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Réactions flottantes */}
              {isLive && hasJoined && <LiveReactions liveId={live.id} isLive={isLive} />}
            </div>

            {/* Titre */}
            <h1 className="text-lg md:text-xl font-bold text-[#1E0F2B] leading-snug" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              {live.title}
            </h1>

            {/* Barre chaîne + actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#8A8378]/15">
              <div className="flex items-center gap-3">
                {live.servantPortraitUrl ? (
                  <img src={live.servantPortraitUrl} alt={live.servantName} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: accentColor }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: accentColor }}>
                    {live.servantName.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-[#1E0F2B]">{live.servantName}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A227]" />
                  </div>
                  <p className="text-xs text-[#8A8378] flex items-center gap-1">
                    {isLive && <><Users className="w-3 h-3" />{viewerCount} spectateur{viewerCount > 1 ? "s" : ""} en direct</>}
                    {!isLive && "Diffusion à venir"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Bouton cœur rouge */}
                <button onClick={handleLike}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#2A0E3D]/5 rounded-full hover:bg-[#2A0E3D]/10 transition-colors">
                  <Heart className={`w-4 h-4 ${liked ? "text-red-500 fill-red-500" : "text-[#1E0F2B]"}`} />
                  {likeCount > 0 && <span className="text-xs font-medium text-[#1E0F2B]">{likeCount}</span>}
                </button>

                {/* Partager avec icônes officielles */}
                <ShareButton url={currentUrl} title={live.title} />

                {/* Enregistrer */}
                <button onClick={() => setSaved(!saved)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#2A0E3D]/5 rounded-full hover:bg-[#2A0E3D]/10 transition-colors">
                  <Bookmark className={`w-4 h-4 ${saved ? "text-[#C9A227] fill-[#C9A227]" : "text-[#1E0F2B]"}`} />
                  <span className="text-xs font-medium text-[#1E0F2B] hidden sm:inline">Enregistrer</span>
                </button>

                <button className="p-2 bg-[#2A0E3D]/5 rounded-full hover:bg-[#2A0E3D]/10 transition-colors">
                  <MoreHorizontal className="w-4 h-4 text-[#1E0F2B]" />
                </button>
              </div>
            </div>

            {/* Description repliable */}
            <div className="bg-white rounded-xl p-3 border border-[#8A8378]/15 cursor-pointer" onClick={() => setShowDescription(!showDescription)}>
              <div className="flex items-center gap-2 text-xs mb-1">
                {isLive && (
                  <span className="font-bold text-[#1E0F2B] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    {viewerCount} spectateur{viewerCount > 1 ? "s" : ""} en direct
                  </span>
                )}
                <span className="text-[#8A8378]">
                  Diffusée le {new Date(live.startedAt || live.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              {live.description && (
                <div className="text-sm text-[#1E0F2B]/80">
                  <p className={`leading-relaxed ${showDescription ? "" : "line-clamp-2"}`}>{live.description}</p>
                  <button className="text-xs text-[#C9A227] font-medium mt-1 flex items-center gap-1">
                    {showDescription ? <><ChevronUp className="w-3 h-3" />Afficher moins</> : <><ChevronDown className="w-3 h-3" />...afficher plus</>}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#8A8378]/10">
                <span className="text-xs text-[#8A8378]">Regarder sur :</span>
                {live.youtubeUrl && <a href={live.youtubeUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-red-600/10 text-red-600 text-xs font-bold hover:bg-red-600/20 transition-colors">YouTube</a>}
                {live.facebookUrl && <a href={live.facebookUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-blue-600/10 text-blue-600 text-xs font-bold hover:bg-blue-600/20 transition-colors">Facebook</a>}
                {live.tiktokUrl && <a href={live.tiktokUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-[#1E0F2B]/10 text-[#1E0F2B] text-xs font-bold hover:bg-[#1E0F2B]/20 transition-colors">TikTok</a>}
              </div>
            </div>
          </div>

          {/* ═══ Colonne droite : Chat ═══ */}
          <div className="h-[calc(100vh-180px)] lg:h-auto lg:max-h-[calc(100vh-140px)]">
            {hasJoined ? (
              <LiveChat liveId={live.id} isLive={isLive} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border border-[#8A8378]/15 p-8">
                <p className="text-sm text-[#8A8378] text-center mb-4">
                  Le chat est disponible après avoir rejoint le live
                </p>
                {isLive && (
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors"
                  >
                    Rejoindre le live
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
