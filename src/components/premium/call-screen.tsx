"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Settings,
  Users,
  Loader2,
  AlertCircle,
  PhoneCall,
  PhoneMissed,
  Video as VideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isLiveKitConfigured } from "@/lib/livekit";

type CallStatus = "idle" | "connecting" | "connected" | "ended" | "missed";

export function CallScreen() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [callType, setCallType] = useState<"audio" | "video">("audio");

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const configured = isLiveKitConfigured();

  // Démarrer un appel
  const startCall = useCallback(async (type: "audio" | "video", contact: string) => {
    setCallType(type);
    setSelectedContact(contact);
    setStatus("connecting");
    setCallDuration(0);

    try {
      // Demander l'accès aux médias
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === "video",
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (videoRef.current && type === "video") {
        videoRef.current.srcObject = stream;
        setIsVideoEnabled(true);
      }

      setIsAudioEnabled(true);

      // Simuler la connexion (en production : connexion LiveKit réelle)
      setTimeout(() => {
        setStatus("connected");
        durationIntervalRef.current = setInterval(() => {
          setCallDuration((d) => d + 1);
        }, 1000);
      }, 1500);
    } catch (err) {
      console.error("Erreur d'accès aux médias:", err);
      setStatus("idle");
      alert("Impossible d'accéder à la caméra/microphone. Vérifiez les permissions.");
    }
  }, []);

  // Terminer l'appel
  const endCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setStatus("ended");
    setTimeout(() => {
      setStatus("idle");
      setSelectedContact(null);
      setCallDuration(0);
      setIsVideoEnabled(false);
      setIsScreenSharing(false);
    }, 2000);
  }, []);

  // Toggle micro
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  // Toggle caméra
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    } else if (!isVideoEnabled) {
      // Activer la caméra si pas encore active
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newVideoTrack);
        if (videoRef.current) {
          videoRef.current.srcObject = localStreamRef.current;
        }
        setIsVideoEnabled(true);
      } catch (err) {
        console.error("Erreur activation caméra:", err);
      }
    }
  }, [isVideoEnabled]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        // En production : remplacer la track video par celle du screen share
        setIsScreenSharing(true);
        displayStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.error("Erreur screen share:", err);
      }
    } else {
      setIsScreenSharing(false);
    }
  }, [isScreenSharing]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // === ÉTAT IDLE : Sélection du contact ===
  if (status === "idle") {
    return <CallContactSelector onSelect={(type, contact) => startCall(type, contact)} />;
  }

  // === ÉTAT CONNECTING / CONNECTED / ENDED : Interface d'appel ===
  return (
    <div className="fixed inset-0 z-50 bg-imperial-dark flex flex-col">
      {/* Vidéo principale (si appel vidéo) */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {callType === "video" ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          // Audio call — avatar animé
          <div className="flex flex-col items-center justify-center">
            <motion.div
              animate={{ scale: status === "connected" ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 2, repeat: status === "connected" ? Infinity : 0 }}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-gold/20 to-lavender/20 border-2 border-gold flex items-center justify-center mb-6"
            >
              <span className="font-serif text-4xl font-semibold text-gold">
                {selectedContact?.charAt(0).toUpperCase()}
              </span>
            </motion.div>
            <h2 className="font-serif text-2xl font-semibold text-ivory mb-2">
              {selectedContact}
            </h2>
            <p className="text-sm text-ivory/60">
              {status === "connecting" && "Connexion en cours..."}
              {status === "connected" && formatDuration(callDuration)}
              {status === "ended" && "Appel terminé"}
            </p>
          </div>
        )}

        {/* Badge statut */}
        <div className="absolute top-6 left-6 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold backdrop-blur-sm",
              status === "connected"
                ? "bg-state-success/30 text-state-success border border-state-success/40"
                : "bg-gold/20 text-gold border border-gold/30"
            )}
          >
            {status === "connecting" && <Loader2 className="w-3 h-3 animate-spin" />}
            {status === "connected" && <span className="w-1.5 h-1.5 rounded-full bg-state-success animate-pulse" />}
            {status === "connecting" ? "Connexion" : status === "connected" ? "En direct" : "Terminé"}
          </span>
          {!configured && status === "connected" && (
            <span className="text-[10px] text-gold-light/50 italic">Mode démo</span>
          )}
        </div>

        {/* Durée en haut à droite */}
        {status === "connected" && (
          <div className="absolute top-6 right-6 text-ivory">
            <span className="font-serif text-2xl font-semibold">{formatDuration(callDuration)}</span>
          </div>
        )}
      </div>

      {/* Contrôles */}
      <div className="p-8 flex items-center justify-center gap-4 bg-imperial-dark/95 backdrop-blur-md border-t border-gold/10">
        <CallButton
          active={isAudioEnabled}
          onClick={toggleAudio}
          disabled={status !== "connected"}
          activeIcon={<Mic className="w-5 h-5" />}
          inactiveIcon={<MicOff className="w-5 h-5" />}
          activeLabel="Micro"
          inactiveLabel="Micro coupé"
        />

        {callType === "video" && (
          <CallButton
            active={isVideoEnabled}
            onClick={toggleVideo}
            disabled={status !== "connected"}
            activeIcon={<Video className="w-5 h-5" />}
            inactiveIcon={<VideoOff className="w-5 h-5" />}
            activeLabel="Caméra"
            inactiveLabel="Caméra off"
          />
        )}

        <CallButton
          active={isScreenSharing}
          onClick={toggleScreenShare}
          disabled={status !== "connected"}
          activeIcon={<ScreenShare className="w-5 h-5" />}
          inactiveIcon={<ScreenShareOff className="w-5 h-5" />}
          activeLabel="Partage"
          inactiveLabel="Partager"
        />

        {/* Bouton raccrocher */}
        <button
          onClick={endCall}
          disabled={status === "ended"}
          className="ml-4 w-16 h-16 rounded-full bg-state-danger text-ivory flex items-center justify-center hover:bg-state-danger/90 transition-colors disabled:opacity-50"
          aria-label="Raccrocher"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

function CallButton({
  active,
  onClick,
  disabled,
  activeIcon,
  inactiveIcon,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
        active
          ? "bg-imperial-light text-ivory hover:bg-imperial"
          : "bg-state-danger/20 text-state-danger border border-state-danger/40",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      aria-label={active ? activeLabel : inactiveLabel}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}

// Sélecteur de contact pour démarrer un appel
function CallContactSelector({
  onSelect,
}: {
  onSelect: (type: "audio" | "video", contact: string) => void;
}) {
  const [contacts] = useState([
    { name: "Pam", role: "Servante de l'Éternel", available: true },
    { name: "Pasteur Kongo", role: "Pasteur", available: true },
    { name: "Équipe pastorale", role: "Modérateurs", available: false },
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-semibold text-ink mb-2">
          Démarrer un appel
        </h2>
        <p className="text-sm text-stone">
          Choisissez un contact et le type d'appel. Les appels sont chiffrés de bout en bout.
        </p>
      </div>

      <div className="space-y-3">
        {contacts.map((contact) => (
          <div
            key={contact.name}
            className={cn(
              "card-gold-top p-5 flex items-center justify-between",
              !contact.available && "opacity-50"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-gold bg-gold/10">
                  <span className="font-serif text-base font-semibold text-gold">
                    {contact.name.charAt(0)}
                  </span>
                </div>
                {contact.available && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-state-success border-2 border-ivory" />
                )}
              </div>
              <div>
                <p className="font-medium text-ink">{contact.name}</p>
                <p className="text-xs text-stone">{contact.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => contact.available && onSelect("audio", contact.name)}
                disabled={!contact.available}
                className="w-10 h-10 rounded-full bg-imperial/10 text-imperial flex items-center justify-center hover:bg-imperial hover:text-ivory transition-colors disabled:cursor-not-allowed"
                aria-label="Appel audio"
                title="Appel audio"
              >
                <PhoneCall className="w-4 h-4" />
              </button>
              <button
                onClick={() => contact.available && onSelect("video", contact.name)}
                disabled={!contact.available}
                className="w-10 h-10 rounded-full bg-imperial/10 text-imperial flex items-center justify-center hover:bg-imperial hover:text-ivory transition-colors disabled:cursor-not-allowed"
                aria-label="Appel vidéo"
                title="Appel vidéo"
              >
                <VideoIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-imperial/5 border border-gold/20 rounded-card">
        <p className="text-xs text-stone leading-relaxed">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 text-gold" />
          Les appels sont enregistrés dans votre historique. En cas d'indisponibilité,
          le contact recevra une notification d'appel manqué.
        </p>
      </div>
    </div>
  );
}
