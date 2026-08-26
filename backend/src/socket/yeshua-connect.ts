/**
 * Socket.io server for Yeshua Connect — real-time messaging.
 *
 * Mounts on the Express server at /yeshua-connect namespace.
 *
 * Features:
 *   - Real-time message delivery (message:send → message:new)
 *   - Typing indicators (typing:start / typing:stop)
 *   - Presence (user:online / user:offline)
 *   - Read receipts (message:read)
 *   - Message edits/deletes broadcast
 *   - WebRTC call signaling (offer/answer/ice/reject/hangup)
 *   - Screen share signaling
 *   - Conversation rooms (join/leave)
 */

import { Server as SocketServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";

interface AuthData {
  token?: string;
  userId?: string;
}

// Track online users: userId → Set<socketId>
const userSockets = new Map<string, Set<string>>();
const socketToUser = new Map<string, string>();

export function initSocketServer(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
    },
    path: "/socket.io",
  });

  const yeshuaNs = io.of("/yeshua-connect");

  yeshuaNs.use((socket: Socket, next) => {
    const auth = socket.handshake.auth as AuthData;
    if (!auth.userId) {
      return next(new Error("Authentication required: userId missing"));
    }
    (socket as any).userId = auth.userId;
    next();
  });

  yeshuaNs.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    console.log(`[Socket.io] User ${userId} connected (${socket.id})`);

    // Track socket
    socketToUser.set(socket.id, userId);
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    // Notify others that user is online
    socket.broadcast.emit("user:online", { userId });

    // ═══ CONVERSATION ROOMS ═══
    socket.on("conversation:join", ({ conversationId }: { conversationId: string }) => {
      socket.join(`conv:${conversationId}`);
      console.log(`[Socket.io] User ${userId} joined conv:${conversationId}`);
    });

    socket.on("conversation:leave", ({ conversationId }: { conversationId: string }) => {
      socket.leave(`conv:${conversationId}`);
    });

    // ═══ MESSAGES ═══
    socket.on("message:send", async (data: { conversationId: string; content: string; replyToId?: string }) => {
      // The actual DB save is done via REST API. Socket just broadcasts.
      // This event is for real-time delivery — the client also calls the REST API.
      // The server broadcasts to all participants.
      socket.to(`conv:${data.conversationId}`).emit("message:new", {
        conversationId: data.conversationId,
        message: {
          id: `temp-${Date.now()}`,
          conversationId: data.conversationId,
          senderId: userId,
          content: data.content,
          replyToId: data.replyToId,
          createdAt: new Date().toISOString(),
          reactions: [],
        },
      });

      // Also send inbox notification to offline users
      // (in a real app, we'd check which users are in the conversation)
    });

    socket.on("message:edited", (data: { conversationId: string; messageId: string; content: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("message:edited", data);
    });

    socket.on("message:deleted", (data: { conversationId: string; messageId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("message:deleted", data);
    });

    // ═══ TYPING ═══
    socket.on("typing:start", ({ conversationId }: { conversationId: string }) => {
      socket.to(`conv:${conversationId}`).emit("typing:start", { conversationId, userId });
    });

    socket.on("typing:stop", ({ conversationId }: { conversationId: string }) => {
      socket.to(`conv:${conversationId}`).emit("typing:stop", { conversationId, userId });
    });

    // ═══ READ RECEIPTS ═══
    socket.on("message:read", (data: { conversationId: string; messageIds: string[] }) => {
      socket.to(`conv:${data.conversationId}`).emit("message:read", {
        conversationId: data.conversationId,
        userId,
        messageIds: data.messageIds,
      });
    });

    // ═══ PRESENCE ═══
    socket.on("user:check-online", ({ userId: targetUserId }: { userId: string }, ack?: (data: any) => void) => {
      const isOnline = userSockets.has(targetUserId);
      if (ack) ack({ userId: targetUserId, isOnline });
    });

    // ═══ WEBRTC CALL SIGNALING ═══
    socket.on("call:offer", (data: { toUserId: string; callId: string; callType: string; offer: any; callerName?: string; callerAvatarUrl?: string }) => {
      socket.to(`user:${data.toUserId}`).emit("call:offer", {
        fromUserId: userId,
        ...data,
      });
      // Also join a call room
      socket.join(`call:${data.callId}`);
    });

    socket.on("call:answer", (data: { toUserId: string; callId: string; answer: any }) => {
      socket.to(`user:${data.toUserId}`).emit("call:answer", {
        fromUserId: userId,
        ...data,
      });
      socket.join(`call:${data.callId}`);
    });

    socket.on("call:ice-candidate", (data: { toUserId: string; callId: string; candidate: any }) => {
      socket.to(`user:${data.toUserId}`).emit("call:ice-candidate", {
        fromUserId: userId,
        ...data,
      });
    });

    socket.on("call:reject", (data: { toUserId: string; callId: string }) => {
      socket.to(`user:${data.toUserId}`).emit("call:reject", {
        fromUserId: userId,
        ...data,
      });
    });

    socket.on("call:hangup", (data: { toUserId: string; callId: string }) => {
      socket.to(`user:${data.toUserId}`).emit("call:hangup", {
        fromUserId: userId,
        ...data,
      });
      socket.leave(`call:${data.callId}`);
    });

    // ═══ GROUP CALLS ═══
    socket.on("group-call:invite", (data: { toUserIds: string[]; callId: string; callType: string; conversationId: string }) => {
      for (const toUserId of data.toUserIds) {
        socket.to(`user:${toUserId}`).emit("group-call:invite", {
          fromUserId: userId,
          ...data,
        });
      }
      socket.join(`call:${data.callId}`);
    });

    socket.on("group-call:leave", (data: { toUserIds: string[]; callId: string }) => {
      for (const toUserId of data.toUserIds) {
        socket.to(`user:${toUserId}`).emit("group-call:leave", {
          fromUserId: userId,
          ...data,
        });
      }
      socket.leave(`call:${data.callId}`);
    });

    // ═══ SCREEN SHARE ═══
    socket.on("screen:share:start", (data: { conversationId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("screen:share:start", {
        conversationId: data.conversationId,
        userId,
      });
    });

    socket.on("screen:share:stop", (data: { conversationId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("screen:share:stop", {
        conversationId: data.conversationId,
        userId,
      });
    });

    // ═══ DISCONNECT ═══
    socket.on("disconnect", () => {
      console.log(`[Socket.io] User ${userId} disconnected (${socket.id})`);

      socketToUser.delete(socket.id);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          // User is now offline
          socket.broadcast.emit("user:offline", { userId });
        }
      }
    });

    // Join personal room for direct notifications
    socket.join(`user:${userId}`);
  });

  console.log("[Socket.io] Server initialized at /yeshua-connect");
  return io;
}
