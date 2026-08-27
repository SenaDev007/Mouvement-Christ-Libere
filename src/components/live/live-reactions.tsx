"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ReactionData {
  id: string;
  emoji: string;
  createdAt: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  animationId: number;
}

interface LiveReactionsProps {
  liveId: string;
  isLive: boolean;
}

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "🙏", "🎉", "✨"];
const REACTION_POLL_INTERVAL = 1000; // 1 seconde
const MAX_FLOATING = 30; // max réactions affichées simultanément

export function LiveReactions({ liveId, isLive }: LiveReactionsProps) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [userName, setUserName] = useState("");
  const lastTimestampRef = useRef<string | null>(null);
  const animationCounterRef = useRef(0);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Charger le nom depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem("live-chat-username");
    if (saved) setUserName(saved);
  }, []);

  // Polling des réactions
  const fetchReactions = useCallback(async () => {
    try {
      const since = lastTimestampRef.current;
      const url = since
        ? `/api/live/${liveId}/chat?since=${encodeURIComponent(since)}`
        : `/api/live/${liveId}/chat`;

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        // Filtrer seulement les réactions
        const reactions = data.messages.filter(
          (m: ReactionData) => m.type === "reaction" && m.emoji
        );

        for (const r of reactions) {
          if (!seenIdsRef.current.has(r.id)) {
            seenIdsRef.current.add(r.id);
            // Ajouter une réaction flottante
            addFloatingReaction(r.emoji);
          }
        }

        // Mettre à jour le timestamp
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

    fetchReactions();
    const interval = setInterval(fetchReactions, REACTION_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isLive, fetchReactions]);

  // Ajouter une réaction flottante
  const addFloatingReaction = (emoji: string) => {
    const id = `r-${Date.now()}-${Math.random()}`;
    const x = 10 + Math.random() * 80; // position horizontale aléatoire (10% à 90%)
    const animationId = ++animationCounterRef.current;

    setFloating((prev) => {
      const newArr = [...prev, { id, emoji, x, animationId }];
      // Limiter le nombre de réactions flottantes
      if (newArr.length > MAX_FLOATING) {
        return newArr.slice(-MAX_FLOATING);
      }
      return newArr;
    });

    // Supprimer après l'animation (3 secondes)
    setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.id !== id));
    }, 3000);
  };

  // Envoyer une réaction
  const sendReaction = async (emoji: string) => {
    const name = userName || localStorage.getItem("live-chat-username") || "Anonyme";

    // Afficher immédiatement localement
    addFloatingReaction(emoji);

    try {
      await fetch(`/api/live/${liveId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: name,
          content: emoji,
          type: "reaction",
          emoji,
        }),
      });
    } catch {
      // silent
    }
  };

  if (!isLive) return null;

  return (
    <>
      {/* Réactions flottantes — overlay sur la vidéo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floating.map((f) => (
          <div
            key={f.id}
            className="absolute bottom-0 text-3xl md:text-4xl"
            style={{
              left: `${f.x}%`,
              animation: "floatUp 3s ease-out forwards",
            }}
          >
            {f.emoji}
          </div>
        ))}
      </div>

      {/* Boutons de réaction rapide */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1.5 border border-white/10">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-xl hover:scale-125 transition-transform duration-150 active:scale-90"
            title={`Réagir ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* CSS pour l'animation flottante */}
      <style jsx>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          15% {
            transform: translateY(-20px) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translateY(-300px) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
