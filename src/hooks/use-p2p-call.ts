"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

/**
 * ⭐ V3.19 — useP2PCall : APPELS P2P DE SECOURS (Plan C).
 * ============================================================================
 * Si LiveKit (Cloud OU auto-hébergé — Plan B) est indisponible, les appels
 * DIRECT 1-1 de Yeshua Connect basculent en WebRTC peer-to-peer : le média
 * (audio/vidéo) voyage DIRECTEMENT entre les deux navigateurs, sans serveur
 * multimédia ni clé d'API — la seule infrastructure requise est la
 * signalisation HTTP (polling des routes Next.js existantes) + STUN/TURN
 * publics gratuits.
 *
 * Flot (la sonnerie CallSignal V3.1 est inchangée — l'offre P2P n'est lue
 * qu'après l'échec LiveKit) :
 *
 *   APPELANT (startCall → joinCallRoom échoue → fallback)
 *     1. getUserMedia (micro + caméra si appel vidéo)
 *     2. RTCPeerConnection + createOffer → POST /calls/webrtc { offer }
 *     3. polling : « answer » → setRemoteDescription ; « ice » → addIceCandidate
 *
 *   DESTINATAIRE (acceptIncomingCall → une offre existe → mode P2P direct)
 *     1. lit l'offre, getUserMedia
 *     2. setRemoteDescription(offer) + createAnswer → POST { answer }
 *     3. polling : « ice » de l'appelant → addIceCandidate
 *
 * ICE : trickle des deux côtés via la même route ; les candidats arrivés
 * avant la description distante sont mis en tampon puis rejoués.
 *
 * STUN Google (gratuit) + TURN public Open Relay (gratuit — indispensable
 * derrière les CGNAT des réseaux mobiles africains) ; remplaçable par
 * NEXT_PUBLIC_TURN_URL / _USERNAME / _CREDENTIAL (ex. le TURN du kit Plan B).
 */

const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
    ],
  },
  {
    // TURN public gratuit (Open Relay Project) — relais UDP/TCP derrière NAT strict
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];
// ⭐ Override optionnel (ex. TURN auto-hébergé du kit Plan B)
if (process.env.NEXT_PUBLIC_TURN_URL) {
  ICE_SERVERS.push({
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    ...(process.env.NEXT_PUBLIC_TURN_USERNAME ? { username: process.env.NEXT_PUBLIC_TURN_USERNAME } : {}),
    ...(process.env.NEXT_PUBLIC_TURN_CREDENTIAL ? { credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL } : {}),
  });
}

/** Intervalle de polling de la signalisation (ms). */
const SIGNAL_POLL_MS = 1200;

export interface P2PSignalMessage {
  id: string;
  type: "offer" | "answer" | "ice";
  payload: { sdp?: string; type?: string; candidate?: RTCIceCandidateInit };
  createdAt: string;
}

export function useP2PCall() {
  const [active, setActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pollIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef(false);
  const isCallerRef = useRef(false);

  // ─── Transport signalisation ────────────────────────────────────────────

  const postSignal = useCallback(async (callId: string, type: string, payload: unknown) => {
    const res = await fetch(api.url("/api/yeshua-connect/calls/webrtc"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId, type, payload }),
    });
    if (!res.ok) {
      throw new Error(`Signalisation P2P : HTTP ${res.status}`);
    }
  }, []);

  const fetchSignals = useCallback(async (callId: string): Promise<P2PSignalMessage[]> => {
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/calls/webrtc?callId=${callId}`), { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.signals) ? data.signals : [];
    } catch {
      return [];
    }
  }, []);

  // ─── Création du peer + médias ──────────────────────────────────────────

  const createPeer = useCallback(async (callId: string, type: "audio" | "video") => {
    // Médias locaux AVANT la peer connection (les tracks partent dans l'offre)
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch {
      throw new Error(
        "Micro/caméra inaccessible — vérifiez les permissions du navigateur (mode P2P de secours)."
      );
    }
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    callIdRef.current = callId;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // Flux distant : le MediaStream grossit à chaque track reçu — on pose
    // l'état au PREMIER track (l'élément <video>/<audio> branché dessus
    // affichera les tracks suivants dès leur arrivée).
    remoteStreamRef.current = new MediaStream();
    pc.ontrack = (ev) => {
      const rs = remoteStreamRef.current;
      if (!rs) return;
      rs.addTrack(ev.track);
      if (rs.getTracks().length === 1) {
        setRemoteStream(rs);
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        postSignal(callId, "ice", { candidate: ev.candidate.toJSON() }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "failed") {
        setError("Connexion P2P échouée (réseau trop restrictif des deux côtés).");
      }
    };

    return pc;
  }, [postSignal]);

  // ─── Traitement des signaux entrants (polling) ─────────────────────────

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* candidat périmé */ }
    }
  }, []);

  const processSignals = useCallback(async (callId: string) => {
    const pc = pcRef.current;
    if (!pc) return;
    const signals = await fetchSignals(callId);
    for (const s of signals) {
      if (processedIdsRef.current.has(s.id)) continue;
      processedIdsRef.current.add(s.id);

      if (s.type === "answer" && isCallerRef.current) {
        if (!remoteDescriptionSetRef.current) {
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: "answer",
            sdp: s.payload.sdp || "",
          }));
          remoteDescriptionSetRef.current = true;
          await flushPendingCandidates();
        }
      } else if (s.type === "ice" && s.payload.candidate) {
        if (!remoteDescriptionSetRef.current) {
          pendingCandidatesRef.current.push(s.payload.candidate);
        } else {
          try { await pc.addIceCandidate(new RTCIceCandidate(s.payload.candidate)); } catch {}
        }
      }
      // (une « offer » ne nous concerne que si on est le destinataire —
      //  startCallee l'applique explicitement, on l'ignore au polling.)
    }
  }, [fetchSignals, flushPendingCandidates]);

  const startPolling = useCallback((callId: string) => {
    if (pollIvRef.current) clearInterval(pollIvRef.current);
    pollIvRef.current = setInterval(() => {
      processSignals(callId).catch(() => {});
    }, SIGNAL_POLL_MS);
  }, [processSignals]);

  // ─── API publique du hook ───────────────────────────────────────────────

  /** APPELANT : crée la peer, publie l'offre, démarre le polling. */
  const startCaller = useCallback(async (callId: string, type: "audio" | "video") => {
    setError(null);
    const pc = await createPeer(callId, type);
    isCallerRef.current = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await postSignal(callId, "offer", { sdp: pc.localDescription?.sdp, type: "offer" });
    setActive(true);
    startPolling(callId);
  }, [createPeer, postSignal, startPolling]);

  /** DESTINATAIRE : lit l'offre (le cas échéant) et répond. Renvoie true si
   *  une offre P2P existait (le mode P2P a été engagé), false sinon. */
  const acceptCallee = useCallback(async (callId: string, type: "audio" | "video"): Promise<boolean> => {
    const signals = await fetchSignals(callId);
    const offer = signals.find((s) => s.type === "offer");
    if (!offer || !offer.payload.sdp) return false;

    setError(null);
    const pc = await createPeer(callId, type);
    isCallerRef.current = false;
    processedIdsRef.current.add(offer.id);

    await pc.setRemoteDescription(new RTCSessionDescription({
      type: "offer",
      sdp: offer.payload.sdp,
    }));
    remoteDescriptionSetRef.current = true;

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await postSignal(callId, "answer", { sdp: pc.localDescription?.sdp, type: "answer" });

    setActive(true);
    // Traite les ICE déjà arrivés (avant notre réponse) puis continue en
    // polling (l'appelant trickle pendant toute la négociation).
    await processSignals(callId);
    startPolling(callId);
    return true;
  }, [createPeer, postSignal, processSignals, startPolling, fetchSignals]);

  /** Une offre P2P existe-t-elle déjà pour cet appel ? (décision au décrochage) */
  const hasRemoteOffer = useCallback(async (callId: string): Promise<boolean> => {
    const signals = await fetchSignals(callId);
    return signals.some((s) => s.type === "offer" && !!s.payload.sdp);
  }, [fetchSignals]);

  /** Attend une offre P2P pendant maxMs (l'appelant peut être en fallback
   *  lui aussi — ses 15 s d'attente LiveKit coulent en parallèle). */
  const waitForRemoteOffer = useCallback(async (callId: string, maxMs: number): Promise<boolean> => {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (await hasRemoteOffer(callId)) return true;
      await new Promise((r) => setTimeout(r, 800));
    }
    return false;
  }, [hasRemoteOffer]);

  /** Coupe la peer + stoppe tous les tracks locaux (idempotent). */
  const stop = useCallback(() => {
    if (pollIvRef.current) {
      clearInterval(pollIvRef.current);
      pollIvRef.current = null;
    }
    const pc = pcRef.current;
    pcRef.current = null;
    callIdRef.current = null;
    try { pc?.close(); } catch {}
    localStreamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch {} });
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    processedIdsRef.current = new Set();
    pendingCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;
    isCallerRef.current = false;
    setActive(false);
    setRemoteStream(null);
    setLocalStream(null);
    setConnectionState("new");
  }, []);

  /** Micro local on/off (mode P2P). */
  const setMicEnabled = useCallback((enabled: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = enabled; });
  }, []);

  /** Caméra locale on/off (mode P2P). */
  const setCameraEnabled = useCallback((enabled: boolean) => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = enabled; });
  }, []);

  // Nettoyage au démontage (sécurité — l'appel est normalement coupé par
  // teardownCall → p2p.stop()).
  useEffect(() => {
    return () => { stop(); };
  }, []);

  return {
    active,
    remoteStream,
    localStream,
    connectionState,
    error,
    startCaller,
    acceptCallee,
    hasRemoteOffer,
    waitForRemoteOffer,
    stop,
    setMicEnabled,
    setCameraEnabled,
  };
}
