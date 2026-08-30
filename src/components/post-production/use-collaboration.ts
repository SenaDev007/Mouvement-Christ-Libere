"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import { apiFetch } from "@/lib/api-client";
import type { CollaborationUser, CollaborationEvent } from "./types";

interface UseCollaborationOptions {
  videoId: string;
  userName: string;
  enabled: boolean;
  onStateUpdate?: (state: unknown, userId: string) => void;
}

interface UseCollaborationReturn {
  collaborators: CollaborationUser[];
  isConnected: boolean;
  sendCursor: (x: number, y: number) => void;
  sendStateUpdate: (state: unknown) => void;
  sendChat: (message: string) => void;
  chatMessages: { userId: string; userName: string; message: string; timestamp: number }[];
}

const USER_COLORS = [
  "#C9A227", "#8C5FA8", "#2A0E3D", "#16a34a",
  "#dc2626", "#0891b2", "#ea580c", "#7c3aed",
];

/**
 * useCollaboration — Hook de collaboration temps réel via LiveKit DataChannel.
 *
 * Fonctionnement :
 * 1. Connecte une room LiveKit "collab-{videoId}" (uniquement si enabled)
 * 2. Track la présence (participants connectés)
 * 3. Broadcast les événements via DataChannel topic "collab-event"
 *    - user-join / user-leave (présence)
 *    - user-cursor (position souris sur l'éditeur)
 *    - state-update (quand un utilisateur modifie le projet)
 *    - chat (messages de chat)
 * 4. Reçoit les événements des autres et appelle les callbacks
 *
 * Pas de vidéo/audio — uniquement des messages de données (léger, ~1KB/event).
 */
export function useCollaboration({
  videoId,
  userName,
  enabled,
  onStateUpdate,
}: UseCollaborationOptions): UseCollaborationReturn {
  const [collaborators, setCollaborators] = useState<CollaborationUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { userId: string; userName: string; message: string; timestamp: number }[]
  >([]);
  const roomRef = useRef<Room | null>(null);
  const myColorRef = useRef(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);
  const myIdRef = useRef<string>("");
  const onStateUpdateRef = useRef(onStateUpdate);

  useEffect(() => {
    onStateUpdateRef.current = onStateUpdate;
  }, [onStateUpdate]);

  useEffect(() => {
    if (!enabled || !videoId || !userName) return;

    let cancelled = false;
    const roomName = `collab-${videoId}`;

    const connect = async () => {
      try {
        const res = await apiFetch("/api/collaboration/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName, participantName: userName }),
        });

        if (!res.ok) {
          console.warn("[collab] Token non disponible, mode solo");
          return;
        }

        const { token, url } = await res.json();
        myIdRef.current = `${userName}-${Date.now()}`;

        const room = new Room();
        roomRef.current = room;

        // Recevoir les messages DataChannel
        room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
          if (topic !== "collab-event") return;
          try {
            const decoder = new TextDecoder();
            const event: CollaborationEvent = JSON.parse(decoder.decode(payload));
            handleEvent(event, participant?.identity || "unknown");
          } catch {}
        });

        // Track présence
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          if (cancelled) return;
          const user: CollaborationUser = {
            id: participant.identity,
            name: participant.name || participant.identity,
            color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
          };
          setCollaborators((prev) =>
            prev.find((u) => u.id === user.id) ? prev : [...prev, user]
          );
          // Annoncer notre présence
          sendEvent({
            type: "user-join",
            userId: myIdRef.current,
            userName,
            timestamp: Date.now(),
          });
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (cancelled) return;
          setCollaborators((prev) => prev.filter((u) => u.id !== participant.identity));
        });

        await room.connect(url, token);

        // S'ajouter soi-même
        const me: CollaborationUser = {
          id: myIdRef.current,
          name: userName,
          color: myColorRef.current,
        };
        setCollaborators([me]);

        // Annoncer notre présence
        sendEvent({
          type: "user-join",
          userId: myIdRef.current,
          userName,
          timestamp: Date.now(),
        });

        if (!cancelled) setIsConnected(true);
      } catch (err) {
        console.error("[collab] Connection failed:", err);
      }
    };

    const sendEvent = (event: CollaborationEvent) => {
      const room = roomRef.current;
      if (!room) return;
      try {
        const encoder = new TextEncoder();
        room.localParticipant.publishData(encoder.encode(JSON.stringify(event)), {
          reliable: true,
          topic: "collab-event",
        });
      } catch {}
    };

    const handleEvent = (event: CollaborationEvent, fromId: string) => {
      switch (event.type) {
        case "user-join":
          setCollaborators((prev) => {
            const exists = prev.find((u) => u.id === event.userId);
            if (exists) return prev;
            return [
              ...prev,
              {
                id: event.userId,
                name: event.userName,
                color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
              },
            ];
          });
          break;
        case "user-leave":
          setCollaborators((prev) => prev.filter((u) => u.id !== event.userId));
          break;
        case "user-cursor":
          setCollaborators((prev) =>
            prev.map((u) =>
              u.id === event.userId
                ? { ...u, cursor: event.data as { x: number; y: number } }
                : u
            )
          );
          break;
        case "state-update":
          if (event.userId !== myIdRef.current && onStateUpdateRef.current) {
            onStateUpdateRef.current(event.data, event.userId);
          }
          break;
        case "chat":
          setChatMessages((prev) => [
            ...prev,
            {
              userId: event.userId,
              userName: event.userName,
              message: event.data as string,
              timestamp: event.timestamp,
            },
          ]);
          break;
      }
      void fromId;
    };

    // Exposer sendEvent pour les callbacks
    (connect as unknown as { _sendEvent?: (e: CollaborationEvent) => void })._sendEvent = sendEvent;

    connect();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch {}
        roomRef.current = null;
      }
      setIsConnected(false);
      setCollaborators([]);
    };
  }, [enabled, videoId, userName]);

  const sendCursor = useCallback((x: number, y: number) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const encoder = new TextEncoder();
      room.localParticipant.publishData(
        encoder.encode(
          JSON.stringify({
            type: "user-cursor",
            userId: myIdRef.current,
            userName,
            timestamp: Date.now(),
            data: { x, y },
          })
        ),
        { reliable: false, topic: "collab-event" }
      );
    } catch {}
  }, [userName]);

  const sendStateUpdate = useCallback(
    (state: unknown) => {
      const room = roomRef.current;
      if (!room) return;
      try {
        const encoder = new TextEncoder();
        room.localParticipant.publishData(
          encoder.encode(
            JSON.stringify({
              type: "state-update",
              userId: myIdRef.current,
              userName,
              timestamp: Date.now(),
              data: state,
            })
          ),
          { reliable: true, topic: "collab-event" }
        );
      } catch {}
    },
    [userName]
  );

  const sendChat = useCallback(
    (message: string) => {
      const room = roomRef.current;
      if (!room) return;
      try {
        const encoder = new TextEncoder();
        room.localParticipant.publishData(
          encoder.encode(
            JSON.stringify({
              type: "chat",
              userId: myIdRef.current,
              userName,
              timestamp: Date.now(),
              data: message,
            })
          ),
          { reliable: true, topic: "collab-event" }
        );
        // Ajouter notre propre message
        setChatMessages((prev) => [
          ...prev,
          { userId: myIdRef.current, userName, message, timestamp: Date.now() },
        ]);
      } catch {}
    },
    [userName]
  );

  return {
    collaborators,
    isConnected,
    sendCursor,
    sendStateUpdate,
    sendChat,
    chatMessages,
  };
}
