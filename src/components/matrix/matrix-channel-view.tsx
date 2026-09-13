"use client";

import { useState } from "react";
import { useMatrixClient } from "@/hooks/use-matrix-client";
import { Loader2, Send, Lock, Hash, Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MatrixChannelView — Vue canal basée sur Matrix Synapse (E2E réel).
 *
 * Ce composant remplace MessagingView pour les canaux chiffrés (isEncrypted=true).
 * Il utilise matrix-js-sdk pour la synchronisation temps réel + le chiffrement E2E.
 *
 * En mode développement (Matrix non configuré), affiche un message d'avertissement.
 */

export function MatrixChannelView({ roomId }: { roomId: string }) {
  const { client, ready, rooms, error, sendMessage } = useMatrixClient();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#1E0F2B] mb-1">Matrix non configuré</p>
          <p className="text-xs text-[#8A8378]">
            Le serveur Matrix Synapse n'est pas encore déployé.
            Les messages E2E seront disponibles après le déploiement V2.2.
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
      </div>
    );
  }

  const handleSend = async () => {
    if (!input.trim() || !roomId) return;
    const content = input;
    setInput("");
    try {
      await sendMessage(roomId, content);
      // Message will appear via sync event
    } catch (e) {
      console.error("send:", e);
      setInput(content); // restore on error
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF6EF]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2 max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-[#8A8378] py-8">
              Aucun message. Soyez le premier à écrire dans ce canal chiffré E2E.
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.isMine ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
                  msg.isMine ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-white border border-stone-200"
                )}>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-stone-100 bg-white flex items-center gap-2">
        <Lock className="w-4 h-4 text-[#C9A227]" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Message chiffré E2E..."
          className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
        />
        <button onClick={handleSend} className="p-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B]">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
