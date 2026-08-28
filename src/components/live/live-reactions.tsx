"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  startTime: number;
}

interface LiveReactionsProps {
  liveId: string;
  isLive: boolean;
}

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "🙏", "🎉", "✨"];
const REACTION_POLL_INTERVAL = 1000;
const MAX_FLOATING = 25;

export function LiveReactions({ liveId, isLive }: LiveReactionsProps) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [userName, setUserName] = useState("");
  const [burstCount, setBurstCount] = useState(0);
  const lastTimestampRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("live-chat-username");
    if (saved) setUserName(saved);
  }, []);

  const addFloatingReaction = useCallback((emoji: string) => {
    const id = `r-${Date.now()}-${Math.random()}`;
    const x = 15 + Math.random() * 70; // 15% à 85%
    setFloating((prev) => {
      const newArr = [...prev, { id, emoji, x, startTime: Date.now() }];
      return newArr.length > MAX_FLOATING ? newArr.slice(-MAX_FLOATING) : newArr;
    });
    setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.id !== id));
    }, 3500);
  }, []);

  const fetchReactions = useCallback(async () => {
    try {
      const since = lastTimestampRef.current;
      const url = since ? `/api/live/${liveId}/chat?since=${encodeURIComponent(since)}` : `/api/live/${liveId}/chat`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        const reactions = data.messages.filter((m: { type: string; emoji: string | null }) => m.type === "reaction" && m.emoji);
        for (const r of reactions) {
          if (!seenIdsRef.current.has(r.id)) {
            seenIdsRef.current.add(r.id);
            // Léger délai entre chaque réaction pour effet naturel
            setTimeout(() => addFloatingReaction(r.emoji), Math.random() * 500);
          }
        }
        lastTimestampRef.current = data.messages[data.messages.length - 1].createdAt;
      }
    } catch {}
  }, [liveId, addFloatingReaction]);

  useEffect(() => {
    if (!isLive) return;
    fetchReactions();
    const interval = setInterval(fetchReactions, REACTION_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isLive, fetchReactions]);

  // ─── Burst mode : cliquer rapidement envoie plusieurs réactions ───
  const sendReaction = async (emoji: string) => {
    const name = userName || localStorage.getItem("live-chat-username") || "Anonyme";

    // Afficher immédiatement localement
    addFloatingReaction(emoji);

    // Burst : si on clique vite, on envoie plusieurs
    const newCount = burstCount + 1;
    setBurstCount(newCount);

    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    burstTimeoutRef.current = setTimeout(() => {
      // Envoyer le burst
      const count = Math.min(newCount, 5); // max 5 d'un coup
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          fetch(`/api/live/${liveId}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName: name, content: emoji, type: "reaction", emoji }),
          }).catch(() => {});
        }, i * 100);
      }
      setBurstCount(0);
    }, 400);
  };

  if (!isLive) return null;

  return (
    <>
      {/* ─── Réactions flottantes — côté droit uniquement (ne cache pas le visage) ─── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {floating.map((f) => (
          <div
            key={f.id}
            className="absolute bottom-16 text-2xl md:text-3xl will-change-transform"
            style={{
              right: `${5 + Math.random() * 15}%`,
              left: "auto",
              animation: "reactionFloat 3.5s ease-out forwards",
            }}
          >
            {f.emoji}
          </div>
        ))}
      </div>

      {/* ─── Barre de réactions — positionnée en bas à droite, compacte ─── */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 bg-black/60 backdrop-blur-md rounded-full px-1.5 py-1 border border-white/10">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-lg hover:scale-125 active:scale-90 transition-transform duration-150 p-0.5"
            title={`Réagir ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        {/* Compteur burst */}
        {burstCount > 1 && (
          <span className="ml-1 text-xs font-bold text-[#C9A227] bg-[#C9A227]/20 rounded-full px-1.5 py-0.5">
            ×{burstCount}
          </span>
        )}
      </div>

      {/* ─── Animation CSS ─── */}
      <style jsx>{`
        @keyframes reactionFloat {
          0% {
            transform: translateY(0) translateX(0) scale(0.3) rotate(0deg);
            opacity: 0;
          }
          10% {
            transform: translateY(-30px) translateX(0) scale(1.3) rotate(-5deg);
            opacity: 1;
          }
          30% {
            transform: translateY(-100px) translateX(10px) scale(1) rotate(5deg);
            opacity: 1;
          }
          60% {
            transform: translateY(-200px) translateX(-15px) scale(0.9) rotate(-3deg);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-350px) translateX(20px) scale(0.5) rotate(8deg);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
