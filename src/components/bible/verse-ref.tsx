"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface VerseRefProps {
  reference: string; // "Genèse 5:24"
  children?: React.ReactNode;
  className?: string;
  showTooltip?: boolean;
}

interface VersetData {
  reference: string;
  texte: string | null;
  contexte?: string | null;
  livre?: {
    nomFr: string;
    nomHe: string | null;
    testament: string;
  };
  disponible: boolean;
}

export function VerseRef({
  reference,
  children,
  className,
  showTooltip = true,
}: VerseRefProps) {
  const [verset, setVerset] = useState<VersetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const fetchVerset = async () => {
    if (verset || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bible/${encodeURIComponent(reference)}`
      );
      if (res.ok) {
        const data = await res.json();
        setVerset(data);
      }
    } catch (err) {
      console.error("Erreur fetch verset:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    if (!showTooltip) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setShowPopup(true);
      fetchVerset();
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
      <Link
        href={`/bible?ref=${encodeURIComponent(reference)}`}
        className={cn(
          "verse-ref cursor-pointer hover:text-gold transition-colors",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children || reference}
      </Link>

      <AnimatePresence>
        {showPopup && (
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-w-[90vw]"
          >
            <div className="bg-ivory border border-gold/40 rounded-card shadow-xl overflow-hidden">
              {/* En-tête */}
              <div className="bg-imperial text-ivory px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-gold" />
                  <span className="font-serif text-sm font-semibold">
                    {reference}
                  </span>
                </div>
                {verset?.livre?.nomHe && (
                  <span className="text-xs text-gold-light/70 font-serif" dir="rtl">
                    {verset.livre.nomHe}
                  </span>
                )}
              </div>

              {/* Contenu */}
              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-gold" />
                  </div>
                ) : verset ? (
                  verset.disponible ? (
                    <>
                      <p className="font-serif text-sm text-ink leading-relaxed italic mb-2">
                        « {verset.texte} »
                      </p>
                      {verset.contexte && (
                        <p className="text-xs text-stone mt-2 pt-2 border-t border-stone/15">
                          {verset.contexte}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-stone italic">
                      Verset non disponible dans la base locale.
                    </p>
                  )
                ) : (
                  <p className="text-xs text-stone italic">Chargement...</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 bg-imperial/5 border-t border-stone/15">
                <Link
                  href={`/bible?ref=${encodeURIComponent(reference)}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-imperial hover:text-gold transition-colors"
                >
                  Lire le contexte
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Flèche */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-3 h-3 bg-ivory border-r border-b border-gold/40 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
