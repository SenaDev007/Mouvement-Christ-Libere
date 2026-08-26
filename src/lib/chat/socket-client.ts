"use client";

import { io, Socket } from "socket.io-client";
import { api } from "@/lib/api-client";

/**
 * Socket.io client singleton for Yeshua Connect.
 * Connects to the backend at /yeshua-connect namespace.
 *
 * Events OUTGOING (client → server):
 *   conversation:join, conversation:leave, message:send,
 *   typing:start, typing:stop, message:read,
 *   call:offer, call:answer, call:ice-candidate, call:reject, call:hangup,
 *   screen:share:start, screen:share:stop
 *
 * Events INCOMING (server → client):
 *   message:new, message:edited, message:deleted,
 *   typing:start, typing:stop, message:read,
 *   user:online, user:offline, inbox:new,
 *   call:offer, call:answer, call:ice-candidate, call:reject, call:hangup,
 *   screen:share:start, screen:share:stop,
 *   connect, disconnect, connect_error
 */

let socket: Socket | null = null;
let pendingListeners: Array<{ event: string; listener: any }> = [];

export function getSocket(token?: string | null, userId?: string | null): Socket | null {
  if (typeof window === "undefined") return null;
  if (socket?.connected) return socket;
  if (!token || !userId) return null;

  const socketUrl = api.baseUrl || (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "");

  socket = io(`${socketUrl}/yeshua-connect`, {
    auth: { token, userId },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: 10,
  });

  socket.on("connect", () => console.log("[Socket.io] Connected"));
  socket.on("disconnect", () => console.log("[Socket.io] Disconnected"));
  socket.on("connect_error", (err) => console.warn("[Socket.io] Error:", err.message));

  pendingListeners.forEach(({ event, listener }) => socket?.on(event, listener));
  pendingListeners = [];

  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function onSocket(event: string, listener: any) {
  if (socket) socket.on(event, listener);
  else pendingListeners.push({ event, listener });
}

export function offSocket(event: string, listener: any) {
  if (socket) socket.off(event, listener);
  pendingListeners = pendingListeners.filter(p => !(p.event === event && p.listener === listener));
}

export function emitSocket(event: string, ...args: any[]) {
  if (socket?.connected) socket.emit(event, ...args);
}
