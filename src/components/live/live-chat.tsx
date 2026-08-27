"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageCircle, Users, X, ChevronDown, Pin, Heart } from "lucide-react";

interface ChatMessage {
  id: string;
  userName: string;
  content: string;
  type: string;
  emoji: string | null;
  createdAt: string;
}

interface LiveChatProps {
  liveId: string;
  isLive: boolean;
}

const CHAT_POLL_INTERVAL = 2000;

// Couleurs d'avatar générées depuis le nom (façon YouTube)
const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function formatChatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function LiveChat({ liveId, isLive }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem("live-chat-username");
    if (saved) { setUserName(saved); setShowNamePrompt(false); }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const since = lastTimestampRef.current;
      const url = since ? `/api/live/${liveId}/chat?since=${encodeURIComponent(since)}` : `/api/live/${liveId}/chat`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => [...prev, ...data.messages].slice(-200));
        lastTimestampRef.current = data.messages[data.messages.length - 1].createdAt;

        // Auto-scroll si l'utilisateur est en bas
        if (isAtBottomRef.current) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        } else {
          setShowScrollDown(true);
        }
      }
    } catch {}
  }, [liveId]);

  useEffect(() => {
    if (!isLive) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, CHAT_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isLive, fetchMessages]);

  // Viewer count simulation
  useEffect(() => {
    if (!isLive) return;
    setViewerCount(Math.floor(Math.random() * 80) + 20);
    const interval = setInterval(() => {
      setViewerCount((prev) => Math.max(10, prev + Math.floor(Math.random() * 7) - 3));
    }, 5000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Détection si l'utilisateur est en bas du chat
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    isAtBottomRef.current = isBottom;
    setShowScrollDown(!isBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    isAtBottomRef.current = true;
    setShowScrollDown(false);
  };

  const handleSetName = () => {
    const trimmed = userName.trim();
    if (!trimmed) return;
    localStorage.setItem("live-chat-username", trimmed);
    setShowNamePrompt(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !userName) return;
    setSending(true);
    try {
      const res = await fetch(`/api/live/${liveId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, content: input.trim(), type: "message" }),
      });
      if (res.ok) {
        setInput("");
        fetchMessages();
      }
    } catch {} finally { setSending(false); }
  };

  if (!isLive) {
    return (
      <div className="flex flex-col h-full bg-[#0f0f0f] rounded-xl overflow-hidden border border-white/10">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#C9A227]" />
          <span className="text-sm font-bold text-white">Chat</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-white/40 text-center italic">Le chat sera disponible lorsque le live commencera.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] rounded-xl overflow-hidden border border-white/10">
      {/* Header façon YouTube */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#C9A227]" />
          <span className="text-sm font-bold text-white">Chat en direct</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-white/50">
            <Users className="w-3 h-3" />
            {viewerCount}
          </div>
          <button
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className="p-1 rounded hover:bg-white/10 text-white/50 transition-colors"
            aria-label={chatCollapsed ? "Déplier" : "Replier"}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${chatCollapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {!chatCollapsed && (
        <>
          {/* Message épinglé (façon YouTube) */}
          {pinnedMessage && (
            <div className="px-4 py-2 bg-[#C9A227]/10 border-b border-[#C9A227]/20 flex items-start gap-2">
              <Pin className="w-3 h-3 text-[#C9A227] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/90 break-words">
                  <span className="font-bold text-[#C9A227]">{pinnedMessage.userName}: </span>
                  {pinnedMessage.content}
                </p>
              </div>
              <button
                onClick={() => setPinnedMessage(null)}
                className="p-0.5 rounded hover:bg-white/10 text-white/40"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 min-h-[200px] max-h-[500px] relative"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}
          >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-white/30 italic">Soyez le premier à écrire...</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  {/* Avatar */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: getAvatarColor(msg.userName) }}
                  >
                    {getInitials(msg.userName)}
                  </div>
                  {/* Message */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-white/90 truncate max-w-[120px]">
                        {msg.userName}
                      </span>
                      <span className="text-[10px] text-white/30 flex-shrink-0">
                        {formatChatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-white/80 break-words leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                  {/* Like button (façon YouTube) */}
                  <button
                    onClick={() => {/* TODO: like message */}}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/40 hover:text-[#C9A227] transition-all flex-shrink-0"
                  >
                    <Heart className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bouton "nouveaux messages" */}
          {showScrollDown && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={scrollToBottom}
                className="px-3 py-1.5 rounded-full bg-[#C9A227] text-[#1E0F2B] text-xs font-bold shadow-lg flex items-center gap-1 hover:bg-[#DDBE55] transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
                Nouveaux messages
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/10 p-3 flex-shrink-0">
            {showNamePrompt ? (
              <div className="space-y-2">
                <p className="text-xs text-white/60 mb-2">Choisissez votre nom pour participer :</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetName()}
                    placeholder="Votre nom"
                    maxLength={30}
                    autoFocus
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:bg-white/10 border border-white/10"
                  />
                  <button
                    onClick={handleSetName}
                    disabled={!userName.trim()}
                    className="px-4 py-2 rounded-lg bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] transition-colors disabled:opacity-40"
                  >
                    OK
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Écrivez un message..."
                  maxLength={500}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:bg-white/10 border border-white/10"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="p-2 rounded-lg bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
