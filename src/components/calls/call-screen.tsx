"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant } from "livekit-client";
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CallScreen — Full-screen call interface (audio + video) using LiveKit.
 *
 * Props:
 *   roomName: string — the LiveKit room to join
 *   callType: "AUDIO" | "VIDEO"
 *   onEnd: () => void — callback when the call ends
 *
 * Features:
 *   - WebRTC audio/video via LiveKit SFU
 *   - Mute/unmute microphone
 *   - Enable/disable camera
 *   - Hangup button
 *   - Call duration timer
 *   - Picture-in-picture (local video)
 */

interface CallScreenProps {
  roomName: string;
  callType: "AUDIO" | "VIDEO";
  onEnd: () => void;
}

export function CallScreen({ roomName, callType, onEnd }: CallScreenProps) {
  const [status, setStatus] = useState<"connecting" | "active" | "ended">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(callType === "VIDEO");
  const [duration, setDuration] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Join the call
  useEffect(() => {
    async function joinCall() {
      try {
        // 1. Get token from backend
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName }),
        });

        if (!res.ok) {
          const data = await res.json();
          if (data.dndActive) {
            setError("Le destinataire est en mode Ne pas déranger");
          } else {
            setError("Impossible de rejoindre l'appel");
          }
          setStatus("ended");
          return;
        }

        const { token, url } = await res.json();

        // 2. Create LiveKit room
        const room = new Room();
        roomRef.current = room;

        // 3. Setup event listeners
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
          } else if (track.kind === Track.Kind.Audio) {
            track.attach();
          }
        });

        room.on(RoomEvent.ParticipantConnected, () => {
          setStatus("active");
          startTimer();
        });

        // 4. Connect
        await room.connect(url, token);

        // 5. Publish local tracks
        await room.localParticipant.setMicrophoneEnabled(micEnabled);
        if (callType === "VIDEO") {
          await room.localParticipant.setCameraEnabled(true);
          // Attach local video
          const localTrack = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (localTrack?.track && localVideoRef.current) {
            localTrack.track.attach(localVideoRef.current);
          }
        }

        // If no other participant, wait for them
        const participants = Array.from(room.remoteParticipants.values());
        if (participants.length > 0) {
          setStatus("active");
          startTimer();
        }
      } catch (e: any) {
        setError(e.message || "Erreur de connexion");
        setStatus("ended");
      }
    }

    joinCall();

    return () => {
      cleanup();
    };
  }, [roomName, callType]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  };

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
  }, []);

  const handleHangup = useCallback(() => {
    cleanup();
    setStatus("ended");
    onEnd();
  }, [cleanup, onEnd]);

  const toggleMic = async () => {
    if (!roomRef.current) return;
    const newState = !micEnabled;
    await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
    setMicEnabled(newState);
  };

  const toggleCamera = async () => {
    if (!roomRef.current) return;
    const newState = !cameraEnabled;
    await roomRef.current.localParticipant.setCameraEnabled(newState);
    setCameraEnabled(newState);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#2A0E3D] z-[60] flex flex-col items-center justify-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <p className="text-[#FAF6EF] text-lg font-semibold mb-2">{error}</p>
        <button onClick={onEnd} className="mt-4 px-6 py-2 bg-red-500 text-white rounded-xl">
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0A2A5E] via-[#2A0E3D] to-[#1A0826] z-[60] flex flex-col items-center justify-between p-8">
      {/* Top: status */}
      <div className="pt-8 text-center">
        <p className="text-sm text-[#C9A227] font-medium tracking-wider uppercase">
          {status === "connecting" ? "Connexion en cours..." : "Appel en cours"}
        </p>
        {status === "active" && (
          <p className="text-[#FAF6EF] text-2xl font-bold mt-2">
            {formatDuration(duration)}
          </p>
        )}
      </div>

      {/* Center: video / avatar */}
      <div className="flex-1 flex items-center justify-center">
        {callType === "VIDEO" && cameraEnabled ? (
          <>
            {/* Remote video (full screen) */}
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            {/* Local video (PiP) */}
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-32 right-8 w-32 h-48 rounded-2xl object-cover border-2 border-[#C9A227]/40 z-20" />
          </>
        ) : (
          <div className="text-center">
            <div className="w-32 h-32 rounded-full bg-[#C9A227]/20 border-4 border-[#C9A227]/40 flex items-center justify-center mx-auto mb-4">
              <Phone className="w-12 h-12 text-[#C9A227]" />
            </div>
            <p className="text-[#FAF6EF] text-xl font-semibold">
              {callType === "VIDEO" ? "Appel vidéo" : "Appel audio"}
            </p>
          </div>
        )}
      </div>

      {/* Bottom: controls */}
      <div className="flex justify-center gap-6 pb-10">
        <button
          onClick={toggleMic}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            micEnabled ? "bg-white/10 text-[#FAF6EF]" : "bg-red-500 text-white"
          )}
          title={micEnabled ? "Couper le micro" : "Activer le micro"}
        >
          {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>

        {callType === "VIDEO" && (
          <button
            onClick={toggleCamera}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
              cameraEnabled ? "bg-white/10 text-[#FAF6EF]" : "bg-red-500 text-white"
            )}
            title={cameraEnabled ? "Couper la vidéo" : "Activer la vidéo"}
          >
            {cameraEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={handleHangup}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg"
          title="Raccrocher"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}
