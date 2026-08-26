"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ChevronRight, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MessageThreads — Système de threads (réponses filées) type Discord/Slack.
 *
 * Permet de créer un thread sur un message pour des discussions parallèles
 * sans encombrer le canal principal.
 *
 * - Bouton "Thread" sur chaque message (au hover)
 * - Le thread s'ouvre dans un panneau latéral (desktop) ou en overlay (mobile)
 * - Messages du thread affichés séparément
 */

export interface ThreadMessage {
  id: string;
  parentId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

interface MessageThreadsProps {
  parentMessageId: string;
  parentMessageContent: string;
  parentSenderName: string;
  threads: ThreadMessage[];
  onSend: (parentId: string, content: string) => void;
  onClose: () => void;
}

export function MessageThreads({
  parentMessageId,
  parentMessageContent,
  parentSenderName,
  threads,
  onSend,
  onClose,
}: MessageThreadsProps) {
  const [input, setInput] = useState("");
  const threadMessages = threads.filter(t => t.parentId === parentMessageId);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(parentMessageId, input);
    setInput("");
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed md:absolute inset-y-0 right-0 w-full md:w-96 bg-white border-l border-[#8A8378]/20 z-40 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[#8A8378]/10 bg-[#FAF6EF]">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#8A8378]/10 text-[#8A8378]">
          <X className="w-4 h-4" />
        </button>
        <MessageCircle className="w-4 h-4 text-[#C9A227]" />
        <span className="text-sm font-semibold text-[#1E0F2B]">Thread</span>
        <span className="text-xs text-[#8A8378] ml-auto">{threadMessages.length} réponse{threadMessages.length > 1 ? "s" : ""}</span>
      </div>

      {/* Parent message */}
      <div className="p-4 border-b border-[#8A8378]/10 bg-[#FAF6EF]/50">
        <p className="text-xs font-semibold text-[#8C5FA8] mb-1">{parentSenderName}</p>
        <p className="text-sm text-[#1E0F2B]/70 line-clamp-3">{parentMessageContent}</p>
      </div>

      {/* Thread messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {threadMessages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-2" />
            <p className="text-sm text-[#8A8378]">Aucune réponse pour l'instant</p>
            <p className="text-xs text-[#8A8378]/60 mt-1">Soyez le premier à répondre</p>
          </div>
        ) : (
          threadMessages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#2A0E3D] flex-shrink-0">
                <span className="text-[10px] font-bold text-[#C9A227]">{msg.senderName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-[#1E0F2B]">{msg.senderName}</span>
                  <span className="text-[10px] text-[#8A8378]">{new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-sm text-[#1E0F2B] mt-0.5">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#8A8378]/10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="Répondre dans le thread..."
            className="flex-1 px-4 py-2.5 rounded-full bg-[#FAF6EF] border border-[#8A8378]/20 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 rounded-full bg-[#C9A227] text-[#1E0F2B] disabled:opacity-30 hover:bg-[#DDBE55] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
