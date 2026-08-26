/**
 * Intégration LiveKit — Mouvement Christ Libère (V2)
 *
 * Cette couche abstrait la connexion au serveur LiveKit.
 * En production : un serveur LiveKit (Cloud ou self-hosted) doit être configuré
 * via les variables d'environnement LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
 *
 * En développement (sans serveur LiveKit) : l'interface fonctionne en mode "démo"
 * — l'utilisateur peut naviguer dans l'UI d'appel, mais la connexion réelle
 * nécessite un serveur LiveKit actif.
 */

import { Room, RoomEvent, Track, Participant, RemoteParticipant } from "livekit-client";
import { api } from "@/lib/api-client";

export interface LiveKitConfig {
  wsUrl: string;
  token: string;
}

export interface CallParticipant {
  identity: string;
  name: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

/**
 * Vérifie si LiveKit est configuré (variables d'env présentes).
 */
export function isLiveKitConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_LIVEKIT_URL);
}

/**
 * Récupère l'URL du serveur LiveKit (exposée au client).
 */
export function getLiveKitUrl(): string | null {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL || null;
}

/**
 * Crée une instance de Room LiveKit.
 */
export function createRoom(): Room {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: {
        width: 1280,
        height: 720,
      },
    },
  });
}

/**
 * Événements écoutés sur une Room.
 */
export const ROOM_EVENTS = RoomEvent;

/**
 * Types de tracks LiveKit.
 */
export const TRACK_KIND = Track;

/**
 * Génère un token pour rejoindre une room.
 * Côté client, on appelle l'API route /api/livekit/token qui génère le token
 * côté serveur (sécurité : la clé API n'est jamais exposée).
 */
export async function fetchLiveKitToken(
  roomName: string,
  participantName: string,
  isModerator = false
): Promise<string | null> {
  try {
    const res = await fetch(api.url("/api/livekit/token"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName, participantName, isModerator }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

/**
 * Formate la durée d'un appel en secondes vers un format lisible.
 */
export function formatCallDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
