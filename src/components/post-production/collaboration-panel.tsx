"use client";

import { useState, useRef, useEffect } from "react";
import { Users, MessageCircle, Send, X } from "lucide-react";
import type { CollaborationUser } from "./types";

interface CollaborationPanelProps {
  collaborators: CollaborationUser[];
  isConnected: boolean;
  chatMessages: { userId: string; userName: string; message: string; timestamp: number }[];
  onSendChat: (message: string) => void;
  onClose: () => void;
}

/**
 * CollaborationPanel — Panneau de collaboration temps réel.
 *
 * Affiche :
 * - La liste des utilisateurs connectés (avec leur couleur)
 * - Le chat de collaboration
 * - Le statut de connexion
 */
export function CollaborationPanel({
  collaborators,
  isConnected,
  chatMessages,
  onSendChat,
  onClose,
}: CollaborationPanelProps) {
  const [message, setMessage] = useState("");
  const [showChat, setShowChat] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendChat(message.trim());
    setMessage("");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-[#8A8378]/15 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#2A0E3D] text-white">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#C9A227]" />
          <span className="text-xs font-bold">Collaboration</span>
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
        </div>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Online users */}
      <div className="px-4 py-2 border-b border-[#8A8378]/10">
        <p className="text-[10px] text-[#8A8378] uppercase font-bold mb-1.5">
          En ligne ({collaborators.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {collaborators.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ backgroundColor: `${user.color}20` }}
              title={user.name}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-[10px] font-bold" style={{ color: user.color }}>
                {user.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      {showChat && (
        <div className="flex flex-col h-48">
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {chatMessages.length === 0 ? (
              <p className="text-[10px] text-[#8A8378] text-center py-4">
                Aucun message. Commencez la conversation !
              </p>
            ) : (
              chatMessages.map((msg, i) => {
                const user = collaborators.find((u) => u.id === msg.userId);
                return (
                  <div key={i} className="flex gap-1.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: user?.color || "#8A8378" }}
                    >
                      {msg.userName.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold" style={{ color: user?.color || "#8A8378" }}>
                        {msg.userName}
                      </p>
                      <p className="text-xs text-[#1E0F2B] break-words">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex gap-1 px-2 py-2 border-t border-[#8A8378]/10">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message..."
              maxLength={200}
              className="flex-1 px-2 py-1.5 rounded-lg border border-[#8A8378]/20 bg-[#FAF6EF] text-xs focus:outline-none focus:border-[#C9A227]"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className="p-1.5 rounded-lg bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors disabled:opacity-30"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-[#8A8378] hover:bg-[#2A0E3D]/5 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Afficher le chat
        </button>
      )}
    </div>
  );
}

/**
 * CollaboratorCursors — Affiche les curseurs des autres utilisateurs sur l'éditeur.
 */
export function CollaboratorCursors({ collaborators }: { collaborators: CollaborationUser[] }) {
  return (
    <>
      {collaborators
        .filter((u) => u.cursor)
        .map((user) => (
          <div
            key={user.id}
            className="absolute pointer-events-none z-50 transition-all duration-150"
            style={{
              left: `${user.cursor!.x}%`,
              top: `${user.cursor!.y}%`,
              transform: "translate(-2px, -2px)",
            }}
          >
            {/* Curseur SVG */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 3L17 10L10 12L8 18L3 3Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Nom */}
            <span
              className="absolute left-4 top-4 px-1.5 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </span>
          </div>
        ))}
    </>
  );
}
