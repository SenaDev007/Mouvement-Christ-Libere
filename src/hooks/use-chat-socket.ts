"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { getSocket, disconnectSocket, onSocket, offSocket, emitSocket } from "@/lib/chat/socket-client";

/**
 * useChatSocket — Hook qui gère la connexion Socket.io pour Yeshua Connect.
 *
 * Fournit:
 *   - isConnected: boolean (état de la connexion)
 *   - onlineUsers: Set<string> (IDs des utilisateurs en ligne)
 *   - typingUsers: Record<conversationId, Set<userId>> (qui tape dans quelle conv)
 *   - joinConversation(convId): rejoindre une room
 *   - leaveConversation(convId): quitter une room
 *   - sendMessage(convId, content, replyToId?): envoyer via socket
 *   - startTyping(convId): notifier que l'utilisateur tape
 *   - stopTyping(convId): notifier que l'utilisateur a arrêté
 *   - markRead(convId, messageIds[]): marquer comme lu
 *   - onNewMessage(cb): callback nouveau message
 *   - onTypingStart(cb): callback typing
 *   - onTypingStop(cb): callback typing stop
 *   - onUserOnline(cb): callback user online
 *   - onUserOffline(cb): callback user offline
 *   - onReadReceipt(cb): callback read receipt
 */

export function useChatSocket() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Connect
  useEffect(() => {
    if (!session?.user?.id) return;

    const token = (session as any)?.accessToken || session?.user?.id;
    const socket = getSocket(token, session.user.id);

    if (!socket) return;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    onSocket("connect", onConnect);
    onSocket("disconnect", onDisconnect);

    // Presence
    onSocket("user:online", (data: { userId: string }) => {
      setOnlineUsers(prev => new Set(prev).add(data.userId));
    });
    onSocket("user:offline", (data: { userId: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    });

    // Typing
    onSocket("typing:start", (data: { conversationId: string; userId: string }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        if (!next[data.conversationId]) next[data.conversationId] = new Set();
        next[data.conversationId].add(data.userId);
        return next;
      });
      // Auto-clear after 5s
      const key = `${data.conversationId}:${data.userId}`;
      const existing = typingTimeoutRef.current.get(key);
      if (existing) clearTimeout(existing);
      typingTimeoutRef.current.set(key, setTimeout(() => {
        setTypingUsers(prev => {
          const next = { ...prev };
          if (next[data.conversationId]) {
            next[data.conversationId] = new Set(next[data.conversationId]);
            next[data.conversationId].delete(data.userId);
          }
          return next;
        });
      }, 5000));
    });

    onSocket("typing:stop", (data: { conversationId: string; userId: string }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        if (next[data.conversationId]) {
          next[data.conversationId] = new Set(next[data.conversationId]);
          next[data.conversationId].delete(data.userId);
        }
        return next;
      });
    });

    return () => {
      offSocket("connect", onConnect);
      offSocket("disconnect", onDisconnect);
      disconnectSocket();
    };
  }, [session]);

  const joinConversation = useCallback((conversationId: string) => {
    emitSocket("conversation:join", { conversationId });
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    emitSocket("conversation:leave", { conversationId });
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string, replyToId?: string) => {
    emitSocket("message:send", { conversationId, content, replyToId });
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    emitSocket("typing:start", { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    emitSocket("typing:stop", { conversationId });
  }, []);

  const markRead = useCallback((conversationId: string, messageIds: string[]) => {
    emitSocket("message:read", { conversationId, messageIds });
  }, []);

  const onNewMessage = useCallback((cb: (data: any) => void) => {
    onSocket("message:new", cb);
    return () => offSocket("message:new", cb);
  }, []);

  const onMessageEdited = useCallback((cb: (data: any) => void) => {
    onSocket("message:edited", cb);
    return () => offSocket("message:edited", cb);
  }, []);

  const onMessageDeleted = useCallback((cb: (data: any) => void) => {
    onSocket("message:deleted", cb);
    return () => offSocket("message:deleted", cb);
  }, []);

  const onReadReceipt = useCallback((cb: (data: any) => void) => {
    onSocket("message:read", cb);
    return () => offSocket("message:read", cb);
  }, []);

  const onInboxNew = useCallback((cb: (data: any) => void) => {
    onSocket("inbox:new", cb);
    return () => offSocket("inbox:new", cb);
  }, []);

  return {
    isConnected,
    onlineUsers,
    typingUsers,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onReadReceipt,
    onInboxNew,
  };
}
