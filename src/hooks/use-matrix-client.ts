"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { MatrixClient, createClient } from "matrix-js-sdk";
import { api } from "@/lib/api-client";

/**
 * useMatrixClient — Hook pour initialiser et gérer le client Matrix.
 *
 * - Récupère le token Matrix depuis /api/matrix/token
 * - Crée une instance MatrixClient (matrix-js-sdk)
 * - Démarre la synchronisation (/sync)
 * - Fournit des méthodes sendMessage, joinRoom, getRooms
 *
 * Usage:
 *   const { client, ready, rooms, sendMessage } = useMatrixClient();
 */

interface MatrixRoom {
  id: string;
  name: string;
  lastMessage?: string;
  unreadCount: number;
  isEncrypted: boolean;
}

export function useMatrixClient() {
  const { data: session } = useSession();
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [ready, setReady] = useState(false);
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    let matrixClient: MatrixClient | null = null;

    async function init() {
      try {
        // 1. Get Matrix token
        const res = await fetch(api.url("/api/matrix/token"), { method: "POST" });
        if (!res.ok) {
          setError("Matrix non configuré");
          return;
        }
        const { accessToken, userId, homeserverUrl, deviceId } = await res.json();

        // 2. Create Matrix client
        matrixClient = createClient({
          baseUrl: homeserverUrl,
          accessToken,
          userId,
          deviceId,
        });

        // 3. Start sync
        await matrixClient.startClient({ initialSyncLimit: 20 });

        // 4. Listen for sync events
        matrixClient.on("sync", (state) => {
          if (state === "PREPARED") {
            setReady(true);
            updateRooms(matrixClient!);
          }
        });

        // 5. Listen for new messages
        matrixClient.on("Room.timeline", () => {
          if (matrixClient) updateRooms(matrixClient);
        });

        setClient(matrixClient);
      } catch (e: any) {
        setError(e.message);
      }
    }

    init();

    return () => {
      if (matrixClient) {
        matrixClient.stopClient();
      }
    };
  }, [session]);

  const updateRooms = (client: MatrixClient) => {
    const matrixRooms = client.getRooms();
    const formatted: MatrixRoom[] = matrixRooms.map((room) => {
      const timeline = room.getLiveTimeline();
      const events = timeline.getEvents();
      const lastEvent = events[events.length - 1];
      const lastMessage = lastEvent?.getContent()?.body || "";
      return {
        id: room.roomId,
        name: room.name || room.roomId,
        lastMessage,
        unreadCount: room.getUnreadNotificationCount(),
        isEncrypted: room.hasEncryptionStateEvent(),
      };
    });
    setRooms(formatted);
  };

  const sendMessage = useCallback(async (roomId: string, content: string) => {
    if (!client) return;
    await client.sendEvent(roomId, "m.room.message", {
      body: content,
      msgtype: "m.text",
    });
  }, [client]);

  const joinRoom = useCallback(async (roomId: string) => {
    if (!client) return;
    await client.joinRoom(roomId);
  }, [client]);

  return { client, ready, rooms, error, sendMessage, joinRoom };
}
