/**
 * Intégration Matrix — Mouvement Christ Libère (V2)
 *
 * Cette couche abstrait la connexion au serveur Matrix Synapse.
 *
 * En production : un serveur Matrix Synapse doit être déployé et configuré
 * via les variables d'environnement :
 *   - NEXT_PUBLIC_MATRIX_HOMESERVER_URL (ex: https://matrix.mouvementchristlibere.org)
 *   - MATRIX_ADMIN_USER (bot de modération)
 *   - MATRIX_ADMIN_PASSWORD
 *
 * En développement (sans serveur Matrix) : l'interface fonctionne en mode "démo"
 * — les messages sont simulés localement, aucun chiffrement E2E réel.
 *
 * Documentation déploiement Matrix Synapse : docs/MATRIX-DEPLOYMENT.md
 */

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";

export interface MatrixConfig {
  homeserverUrl: string;
  userId: string;
  accessToken: string;
  deviceId: string;
}

export interface MatrixMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  isEncrypted: boolean;
  type: "text" | "audio" | "image" | "file";
  replyTo?: string;
}

export interface MatrixChannel {
  id: string;
  name: string;
  description: string;
  type: "text" | "voice" | "video" | "announcement" | "restricted";
  isEncrypted: boolean;
  memberCount: number;
  lastMessage?: MatrixMessage;
}

/**
 * Vérifie si Matrix est configuré.
 */
export function isMatrixConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL;
}

/**
 * Récupère l'URL du homeserver Matrix.
 */
export function getMatrixHomeserverUrl(): string | null {
  return process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL || null;
}

/**
 * Crée un client Matrix.
 * Note : en production, l'accessToken doit être obtenu via le login NextAuth
 * + SSO Matrix (OIDC). En démo, on ne crée pas de vrai client.
 */
export async function createMatrixClient(config: MatrixConfig): Promise<MatrixClient> {
  const sdk = await import("matrix-js-sdk");

  const client = sdk.createClient({
    baseUrl: config.homeserverUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,
  });

  // Démarrer le client (le chiffrement E2E est géré automatiquement par le SDK v42+)
  await client.startClient();

  return client as unknown as MatrixClient;
}

/**
 * Écoute les nouveaux messages d'une room.
 */
export function onMessage(
  client: MatrixClient,
  roomId: string,
  callback: (message: MatrixMessage) => void
): () => void {
  const handler = (event: MatrixEvent) => {
    if (event.getRoomId() !== roomId) return;
    if (event.getType() !== "m.room.message") return;

    const content = event.getContent();
    const sender = event.getSender() || "";

    callback({
      id: event.getId() || "",
      sender,
      senderName: sender.split(":")[0].replace("@", ""),
      content: content.body || "",
      timestamp: event.getTs() || Date.now(),
      isEncrypted: event.isEncrypted(),
      type: (content.msgtype === "m.audio" ? "audio" : content.msgtype === "m.image" ? "image" : "text"),
    });
  };

  client.on("Room.timeline" as never, handler as never);

  return () => {
    client.removeListener("Room.timeline" as never, handler as never);
  };
}

/**
 * Envoie un message texte dans une room.
 */
export async function sendMessage(
  client: MatrixClient,
  roomId: string,
  text: string,
  replyTo?: string
): Promise<void> {
  await client.sendMessage(roomId, {
    msgtype: "m.text",
    body: text,
    "m.relates_to": replyTo
      ? {
          "m.in_reply_to": {
            event_id: replyTo,
          },
        }
      : undefined,
  } as never);
}

/**
 * Liste les rooms auxquelles l'utilisateur appartient.
 */
export async function getUserRooms(client: MatrixClient): Promise<MatrixChannel[]> {
  const rooms = client.getRooms();

  return rooms.map((room: Room) => {
    const members = room.getMembers();
    const lastEvent = room.timeline[room.timeline.length - 1];

    return {
      id: room.roomId,
      name: room.name || room.roomId,
      description: room.getMyMembership() === "join" ? "Canal rejoint" : "Invitation",
      type: "text",
      isEncrypted: (room as unknown as { hasEncryptionState?: () => boolean }).hasEncryptionState?.() || false,
      memberCount: members.length,
      lastMessage: lastEvent
        ? {
            id: lastEvent.getId() || "",
            sender: lastEvent.getSender() || "",
            senderName: (lastEvent.getSender() || "").split(":")[0].replace("@", ""),
            content: lastEvent.getContent()?.body || "",
            timestamp: lastEvent.getTs() || Date.now(),
            isEncrypted: lastEvent.isEncrypted(),
            type: "text",
          }
        : undefined,
    };
  });
}

/**
 * Rejoint une room Matrix.
 */
export async function joinRoom(client: MatrixClient, roomId: string): Promise<void> {
  await client.joinRoom(roomId);
}

/**
 * Quitte une room Matrix.
 */
export async function leaveRoom(client: MatrixClient, roomId: string): Promise<void> {
  await client.leave(roomId);
}
