"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Send, Paperclip, Mic, Lock, Hash, Volume2, Users,
  BookOpen, Reply, Plus, Loader2, MessageSquare, Users2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  QUICK_REACTIONS,
  type ChatConversation, type ChatMessage,
} from "@/lib/yeshua-connect/types";

export function MessagingView() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Load conversations from API ───────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/yeshua-connect/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data: ChatConversation[] = await res.json();
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        setActiveConvId(data[0].id);
      }
    } catch (e) {
      console.error("loadConversations:", e);
    } finally {
      setLoadingConvs(false);
    }
  }, [activeConvId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ─── Load messages when active conversation changes ─────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/yeshua-connect/conversations/${convId}/messages?limit=50`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load messages");
      const data: ChatMessage[] = await res.json();
      setMessages(prev => ({ ...prev, [convId]: data }));
    } catch (e) {
      console.error("loadMessages:", e);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    }
  }, [activeConvId, loadMessages]);

  // ─── Auto-scroll to bottom on new messages ──────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConvId]);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeMessages = activeConvId ? (messages[activeConvId] || []) : [];

  // ─── Send message ───────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim() || !activeConvId || !activeConv) return;
    setSending(true);
    const content = inputText;
    setInputText("");
    const replyId = replyTo?.id;
    setReplyTo(null);

    try {
      const res = await fetch(`/api/yeshua-connect/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "current", // TODO: remplacer par l'ID utilisateur réel (session)
          content,
          type: "TEXT",
          replyToId: replyId,
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const newMsg: ChatMessage = await res.json();
      setMessages(prev => ({
        ...prev,
        [activeConvId]: [...(prev[activeConvId] || []), newMsg],
      }));
    } catch (e) {
      console.error("handleSend:", e);
      // Restaurer le texte en cas d'échec
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  // ─── Reaction toggle (local for now — TODO: API) ────────────────────
  const handleReaction = (msgId: string, emoji: string) => {
    if (!activeConvId) return;
    setMessages(prev => ({
      ...prev,
      [activeConvId]: (prev[activeConvId] || []).map(m =>
        m.id === msgId
          ? { ...m, reactions: [...m.reactions, { emoji, userId: "me", userName: "Vous" }] }
          : m
      ),
    }));
    setShowReactions(null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#FAF6EF] overflow-hidden">
      {/* ═════ Sidebar — Conversations + Community Link ═════ */}
      <div className="w-80 border-r border-stone-200 flex flex-col flex-shrink-0 bg-white hidden md:flex">
        {/* Search */}
        <div className="p-4 border-b border-stone-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              placeholder="Rechercher une conversation..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#C9A227]/20"
            />
          </div>
        </div>

        {/* ⭐ Link to Community page */}
        <Link
          href="/communaute"
          className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 hover:bg-[#C9A227]/5 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#C9A227]/15 border border-[#C9A227]/30 flex items-center justify-center">
            <Users2 className="w-5 h-5 text-[#C9A227]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1E0F2B]">Communauté</p>
            <p className="text-xs text-stone-500 truncate">Canaux, groupes et membres</p>
          </div>
          <Plus className="w-4 h-4 text-stone-400 group-hover:text-[#C9A227]" />
        </Link>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-stone-300 mb-2" />
              <p className="text-sm font-medium text-stone-700">Aucune conversation</p>
              <p className="text-xs text-stone-500 mt-1">
                Les canaux de la communauté apparaîtront ici
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={cn(
                    "w-full p-4 flex items-start gap-3 hover:bg-stone-50 transition-all text-left border-b border-stone-50",
                    isActive && "bg-[#C9A227]/5"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm",
                      conv.type === "CHANNEL" ? "bg-[#C9A227]" :
                      conv.type === "GROUP" ? "bg-[#8C5FA8]" :
                      conv.type === "PASTORS" ? "bg-[#5B21B6]" :
                      "bg-[#2A0E3D]"
                    )}>
                      {conv.name.charAt(0)}
                    </div>
                    {conv.isEncrypted && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#C9A227] rounded-full flex items-center justify-center">
                        <Lock className="w-2 h-2 text-[#1E0F2B]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#1E0F2B] truncate">{conv.name}</p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A227] text-[#1E0F2B] flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">{conv.lastMessagePreview || conv.description || ""}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {conv.type === "CHANNEL" && <Hash className="w-3 h-3 text-stone-400" />}
                      {conv.type === "GROUP" && <Users className="w-3 h-3 text-stone-400" />}
                      {conv.type === "PASTORS" && <Users className="w-3 h-3 text-[#5B21B6]" />}
                      {conv.isEncrypted && <span className="text-[10px] text-[#C9A227] font-semibold">E2E</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ═════ Chat zone ═════ */}
      <div className="flex-1 flex flex-col bg-stone-50/30">
        {/* Chat header */}
        {activeConv ? (
          <div className="p-4 border-b border-stone-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm",
                activeConv.type === "CHANNEL" ? "bg-[#C9A227]" :
                activeConv.type === "GROUP" ? "bg-[#8C5FA8]" :
                activeConv.type === "PASTORS" ? "bg-[#5B21B6]" :
                "bg-[#2A0E3D]"
              )}>
                {activeConv.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-[#1E0F2B] text-sm">{activeConv.name}</h3>
                <p className="text-xs text-stone-400">
                  {activeConv.isEncrypted && "🔒 Chiffré E2E · "}
                  {activeConv.participants.length} membres
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Appel audio">
                <Volume2 className="w-4 h-4" />
              </button>
              <Link href="/bible" className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Bible">
                <BookOpen className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-stone-100 bg-white">
            <p className="text-sm text-stone-400">Sélectionnez une conversation</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {loadingMsgs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-stone-300 mb-2" />
              <p className="text-sm text-stone-500">Aucun message dans ce canal</p>
              <p className="text-xs text-stone-400 mt-1">Soyez le premier à écrire !</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {activeMessages.map((msg) => {
                const isMine = msg.senderId === "me" || msg.senderId === "current";
                return (
                  <div key={msg.id} className={cn("group relative flex", isMine ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm",
                      isMine
                        ? "bg-[#C9A227] text-[#1E0F2B]"
                        : "bg-white border border-stone-200 text-[#1E0F2B]"
                    )}>
                      {/* Reply quote */}
                      {msg.replyTo && (
                        <div className={cn(
                          "mb-1.5 px-2 py-1 rounded-lg text-xs border-l-2",
                          isMine ? "bg-[#1E0F2B]/10 border-[#1E0F2B]" : "bg-stone-50 border-[#C9A227]"
                        )}>
                          <p className="font-semibold opacity-70">{msg.replyTo.senderName}</p>
                          <p className="opacity-60 truncate">{msg.replyTo.content}</p>
                        </div>
                      )}
                      {/* Sender name (for group chats) */}
                      {!isMine && activeConv?.type !== "DIRECT" && (
                        <p className="text-xs font-bold text-[#8C5FA8] mb-0.5">{msg.senderName}</p>
                      )}
                      {/* Content */}
                      {msg.type === "VERSE" && msg.verseRef ? (
                        <div className={cn(
                          "px-3 py-2 rounded-xl border-l-4 my-1",
                          isMine ? "bg-[#1E0F2B]/10 border-[#1E0F2B]" : "bg-[#C9A227]/5 border-[#C9A227]"
                        )}>
                          <p className="text-xs font-bold opacity-80">{msg.verseRef}</p>
                          <p className="text-sm italic mt-0.5">{msg.verseText}</p>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {/* Timestamp */}
                      <div className={cn(
                        "flex items-center gap-1 mt-0.5",
                        isMine ? "justify-end text-[#1E0F2B]/50" : "justify-end text-stone-400"
                      )}>
                        <span className="text-[10px]">
                          {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {/* Reactions */}
                      {msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {msg.reactions.reduce((acc, r) => {
                            const existing = acc.find(e => e.emoji === r.emoji);
                            if (existing) existing.count++;
                            else acc.push({ emoji: r.emoji, count: 1 });
                            return acc;
                          }, [] as { emoji: string; count: number }[]).map(r => (
                            <span key={r.emoji} className="px-1.5 py-0.5 rounded-full bg-[#1E0F2B]/10 text-xs">
                              {r.emoji} {r.count > 1 && r.count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Quick reactions (on hover) */}
                    <div className={cn(
                      "absolute -top-8 flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-stone-200 px-1 py-0.5 transition-opacity",
                      showReactions === msg.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      {QUICK_REACTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="text-sm hover:scale-125 transition-transform p-0.5"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        {activeConv && (
          <div className="p-4 border-t border-stone-100 bg-white">
            {replyTo && (
              <div className="mb-2 px-3 py-2 bg-stone-50 rounded-lg border-l-2 border-[#C9A227] flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#8C5FA8]">{replyTo.senderName}</p>
                  <p className="text-xs text-stone-500 truncate">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-stone-400 hover:text-stone-600 ml-2">
                  ✕
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Joindre un fichier">
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Écrivez votre message..."
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20"
                disabled={sending}
              />
              <button className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Message vocal">
                <Mic className="w-4 h-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="p-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Envoyer"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
