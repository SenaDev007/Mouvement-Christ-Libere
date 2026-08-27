"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageCircle, Users, Heart } from "lucide-react";

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

const CHAT_POLL_INTERVAL = 2000; // 2 secondes

export function LiveChat({ liveId, isLive }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger le nom depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem("live-chat-username");
    if (saved) {
      setUserName(saved);
      setShowNamePrompt(false);
    }
  }, []);

  // Polling des messages
  const fetchMessages = useCallback(async () => {
    try {
      const since = lastTimestampRef.current;
      const url = since
        ? `/api/live/${liveId}/chat?since=${encodeURIComponent(since)}`
        : `/api/live/${liveId}/chat`;

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => {
          const all = [...prev, ...data.messages];
          // Garder seulement les 100 derniers messages
          return all.slice(-100);
        });
        // Mettre à jour le timestamp du dernier message
        const lastMsg = data.messages[data.messages.length - 1];
        if (lastMsg) {
          lastTimestampRef.current = lastMsg.createdAt;
        }
      }
    } catch {
      // silent
    }
  }, [liveId]);

  useEffect(() => {
    if (!isLive) return;

    // Fetch initial
    fetchMessages();

    // Polling
    const interval = setInterval(fetchMessages, CHAT_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isLive, fetchMessages]);

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Simuler un compteur de viewers (sera remplacé par vraie donnée plus tard)
  useEffect(() => {
    if (!isLive) return;
    setViewerCount(Math.floor(Math.random() * 50) + 10);
    const interval = setInterval(() => {
      setViewerCount((prev) => Math.max(5, prev + Math.floor(Math.random() * 5) - 2));
    }, 5000);
    return () => clearInterval(interval);
  }, [isLive]);

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
        body: JSON.stringify({
          userName,
          content: input.trim(),
          type: "message",
        }),
      });

      if (res.ok) {
        setInput("");
        // Fetch immédiat pour afficher le message
        fetchMessages();
      }
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  if (!isLive) {
    return (
      <div className="flex flex-col h-full bg-[#1A0826] rounded-2xl border border-[#FAF6EF]/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#FAF6EF]/10 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#C9A227]" />
          <span className="text-sm font-bold text-[#FAF6EF]">Chat</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-[#FAF6EF]/40 text-center italic">
            Le chat sera disponible lorsque le live commencera.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1A0826] rounded-2xl border border-[#FAF6EF]/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#FAF6EF]/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#C9A227]" />
          <span className="text-sm font-bold text-[#FAF6EF]">Chat en direct</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#FAF6EF]/50">
          <Users className="w-3 h-3" />
          {viewerCount}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-[200px] max-h-[400px]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-[#FAF6EF]/30 italic">
              Soyez le premier à écrire dans le chat...
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-2 text-xs hover:bg-[#FAF6EF]/5 px-2 py-1 rounded-lg transition-colors"
            >
              <span className="font-bold text-[#C9A227] flex-shrink-0">
                {msg.userName}:
              </span>
              <span className="text-[#FAF6EF]/90 break-words">{msg.content}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#FAF6EF]/10 p-3 flex-shrink-0">
        {showNamePrompt ? (
          <div className="space-y-2">
            <p className="text-xs text-[#FAF6EF]/60 mb-2">
              Choisissez votre nom pour participer au chat :
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetName()}
                placeholder="Votre nom"
                maxLength={30}
                autoFocus
                className="flex-1 px-3 py-2 rounded-lg bg-[#FAF6EF]/10 text-[#FAF6EF] text-sm placeholder:text-[#FAF6EF]/30 focus:outline-none focus:bg-[#FAF6EF]/15 border border-[#FAF6EF]/10"
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
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez un message..."
              maxLength={500}
              className="flex-1 px-3 py-2 rounded-lg bg-[#FAF6EF]/10 text-[#FAF6EF] text-sm placeholder:text-[#FAF6EF]/30 focus:outline-none focus:bg-[#FAF6EF]/15 border border-[#FAF6EF]/10"
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
    </div>
  );
}
