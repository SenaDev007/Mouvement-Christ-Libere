"use client";

import { useState, useRef, useCallback } from "react";
import { ScreenShare, Square, Loader2 } from "lucide-react";
import { emitSocket } from "@/lib/chat/socket-client";

/**
 * useScreenShare — Hook pour le partage d'écran via WebRTC getDisplayMedia.
 *
 * - Démarre/arrête le partage d'écran
 * - Émet les events Socket.io screen:share:start / screen:share:stop
 * - Fournit le stream vidéo pour l'afficher dans la conversation
 */

export function useScreenShare(conversationId: string) {
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startShare = useCallback(async () => {
    try {
      setError(null);
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      streamRef.current = displayStream;
      setStream(displayStream);
      setIsSharing(true);

      // Notify others
      emitSocket("screen:share:start", { conversationId });

      // Handle user stopping via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        stopShare();
      };
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        setError("Partage d'écran refusé");
      } else {
        setError(e.message || "Erreur lors du partage d'écran");
      }
    }
  }, [conversationId]);

  const stopShare = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsSharing(false);
    emitSocket("screen:share:stop", { conversationId });
  }, [conversationId]);

  return {
    isSharing,
    stream,
    error,
    startShare,
    stopShare,
  };
}

/**
 * ScreenShareButton — Bouton pour démarrer/arrêter le partage d'écran.
 */
export function ScreenShareButton({ conversationId }: { conversationId: string }) {
  const { isSharing, startShare, stopShare, error } = useScreenShare(conversationId);

  if (error) {
    return <span className="text-[10px] text-red-500">{error}</span>;
  }

  return (
    <button
      onClick={isSharing ? stopShare : startShare}
      className={`p-2 rounded-lg transition-colors ${
        isSharing
          ? "bg-red-500 text-white hover:bg-red-600"
          : "hover:bg-[#8A8378]/10 text-[#8A8378] hover:text-[#1E0F2B]"
      }`}
      title={isSharing ? "Arrêter le partage" : "Partager mon écran"}
    >
      {isSharing ? <Square className="w-4 h-4" /> : <ScreenShare className="w-4 h-4" />}
    </button>
  );
}
