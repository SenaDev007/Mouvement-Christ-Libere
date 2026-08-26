"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, BookOpen, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

interface StrongEntry {
  numero: string;
  langue: "hebrew" | "greek";
  lemma?: string;
  pron?: string;
  translit?: string;
  derivation?: string;
  strongs_def?: string;
  kjv_def?: string;
}

interface StrongTooltipProps {
  numero: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Affiche un numéro Strong inline avec tooltip au survol.
 * Ex: <StrongTooltip numero="H1961">H1961</StrongTooltip>
 */
export function StrongTooltip({ numero, children, className }: StrongTooltipProps) {
  const [entry, setEntry] = useState<StrongEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEntry = async () => {
    if (entry || loading) return;
    setLoading(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/strong/${encodeURIComponent(numero)}`));
      if (res.ok) {
        const data = await res.json();
        setEntry(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setShowPopup(true);
      fetchEntry();
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowPopup(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        className={cn(
          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono font-semibold cursor-pointer transition-colors",
          numero.startsWith("H")
            ? "bg-gold/15 text-gold-dark hover:bg-gold/25"
            : "bg-lavender/15 text-lavender hover:bg-lavender/25",
          className
        )}
      >
        <Hash className="w-2.5 h-2.5" />
        {children || numero}
      </span>

      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-w-[90vw]"
          >
            <div className="bg-ivory border border-gold/40 rounded-card shadow-xl overflow-hidden">
              <div className={cn(
                "px-4 py-2 flex items-center justify-between",
                numero.startsWith("H") ? "bg-gold/15" : "bg-lavender/15"
              )}>
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-gold" />
                  <span className="font-mono text-sm font-semibold text-ink">{numero}</span>
                  <span className="text-xs text-stone">
                    {numero.startsWith("H") ? "Hébreu" : "Grec"}
                  </span>
                </div>
                {entry?.lemma && (
                  <span className="font-serif text-base text-ink" dir="rtl">{entry.lemma}</span>
                )}
              </div>

              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-gold" />
                  </div>
                ) : entry ? (
                  <div className="space-y-2">
                    {entry.translit && (
                      <p className="text-xs text-stone italic">Translittération : {entry.translit}</p>
                    )}
                    {entry.strongs_def && (
                      <p className="text-sm text-ink/80 leading-relaxed">{entry.strongs_def}</p>
                    )}
                    {entry.kjv_def && (
                      <p className="text-xs text-stone italic">KJV : {entry.kjv_def}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-stone italic">Chargement...</p>
                )}
              </div>

              <div className="px-4 py-2 bg-imperial/5 border-t border-stone/15">
                <Link
                  href={`/bible?tab=strong`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-imperial hover:text-gold transition-colors"
                >
                  Voir dans le lexique
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-3 h-3 bg-ivory border-r border-b border-gold/40 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

/**
 * Détecte les numéros Strong dans un texte et les rend interactifs.
 * Pattern : H1-H8674 ou G1-G5523
 */
export function TextWithStrongRefs({ text }: { text: string }) {
  // Pattern pour détecter les numéros Strong : H1234 ou G5678
  const pattern = /\b([HG])(\d{1,4})\b/g;
  const parts: Array<{ type: "text" | "strong"; content: string; numero?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.substring(lastIndex, match.index) });
    }
    parts.push({
      type: "strong",
      content: match[0],
      numero: match[0],
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.substring(lastIndex) });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === "strong" && part.numero ? (
          <StrongTooltip key={i} numero={part.numero} />
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
    </>
  );
}
