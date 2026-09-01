"use client";

/**
 * ⭐ V3.11 — INTRO DU LANDING PAGE : NOTRE PAGE DE LOADING + LE SHOFAR.
 * ============================================================================
 *
 * « C'est notre page de loading que tu dois utiliser, ne crée pas une
 * autre. » — L'écran d'ouverture V3.9 (fond nuit, corne, barre de
 * progression, compte à rebours) est abandonné : l'ouverture du site
 * affiche désormais NOTRE PAGE DE LOADING, reprise À L'IDENTIQUE de
 * src/app/loading.tsx (anneau or pulsant + « Un instant... »), pendant
 * EXACTEMENT 30 secondes, pendant lesquelles retentissent les 30
 * premières secondes du son du shofar (/sounds/shofar.mp3).
 *
 * Fonctionnement (inchangé par ailleurs) :
 * 1. Au premier chargement du landing page d'une session de navigation
 *    (sessionStorage — pas de re-sonnerie si l'on revient sur « / » dans
 *    la même visite), la page de loading recouvre le site pendant
 *    EXACTEMENT 30 secondes.
 * 2. Pendant ces 30 secondes retentissent les 30 premières secondes du
 *    VRAI son du shofar, avec fondu de fermeture gracieux.
 * 3. « Passer » et Échap permettent de sauter l'intro (le son s'arrête).
 * 4. ⚠️ Règle des navigateurs : sans geste utilisateur la lecture auto
 *    peut être bloquée — une invite discrète s'affiche alors, et le
 *    moindre clic/relâchement lance le son.
 * 5. Si le son a été débloqué en retard, il continue de retentir après
 *    l'ouverture du site jusqu'à ses 30 secondes naturelles.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, FastForward } from "lucide-react";

const CLE_SESSION = "mcl-intro-shofar";
const DUREE_MS = 30_000; // EXACTEMENT 30 secondes
const FICHIER = "/sounds/shofar.mp3";
const FONDE_SORTIE_MS = 900;

export function LandingIntro() {
  const [actif, setActif] = useState(false);
  const [enFonduSortie, setEnFonduSortie] = useState(false);
  const [sonBloque, setSonBloque] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debutRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minuteurSortieRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termineRef = useRef(false);

  // ── Clôture de l'intro (naturelle à 30 s, ou saut manuel) ──────────────
  const terminer = useCallback((naturel: boolean) => {
    if (termineRef.current) return;
    termineRef.current = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const audio = audioRef.current;
    if (audio) {
      if (naturel) {
        // Laisser le shofar finir ses 30 s s'il a démarré en retard
        // (débloqué par un clic après le début de l'intro) — il
        // s'éteint de lui-même à la fin du média.
        audio.onended = () => audio.pause();
      } else {
        audio.pause();
      }
    }

    try {
      window.sessionStorage.setItem(CLE_SESSION, "1");
    } catch {
      /* navigation privée : l'intro reprendra au prochain onglet */
    }

    document.body.style.overflow = "";
    setEnFonduSortie(true);
    minuteurSortieRef.current = setTimeout(() => setActif(false), FONDE_SORTIE_MS);
  }, []);

  // ── Montage : une seule intro par session ─────────────────────────────
  useEffect(() => {
    let dejaJoue = false;
    try {
      dejaJoue = window.sessionStorage.getItem(CLE_SESSION) === "1";
    } catch {
      /* stockage indisponible : on joue l'intro */
    }
    if (dejaJoue) return;

    setActif(true);
    document.body.style.overflow = "hidden"; // pas de défilement pendant l'intro
    debutRef.current = Date.now();

    // Le shofar réel — lecture immédiate (peut être bloquée avant un geste)
    const audio = new Audio(FICHIER);
    audio.preload = "auto";
    audio.volume = 0.9;
    audioRef.current = audio;

    let debloquer: (() => void) | null = null;
    const tentative = audio.play();
    tentative
      .then(() => setSonBloque(false))
      .catch(() => {
        // Autoplay bloqué par le navigateur → inviter au premier geste
        setSonBloque(true);
        debloquer = () => {
          audio
            .play()
            .then(() => setSonBloque(false))
            .catch(() => {
              /* reste silencieux : l'intro se poursuit sans son */
            });
        };
        window.addEventListener("pointerdown", debloquer, { once: true, capture: true });
      });

    // EXACTEMENT 30 secondes, puis ouverture du site
    intervalRef.current = setInterval(() => {
      if (Date.now() - debutRef.current >= DUREE_MS) {
        terminer(true);
      }
    }, 250);

    // Échap = passer
    const onEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") terminer(false);
    };
    window.addEventListener("keydown", onEchap);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (minuteurSortieRef.current) clearTimeout(minuteurSortieRef.current);
      if (debloquer) {
        window.removeEventListener("pointerdown", debloquer, { capture: true } as AddEventListenerOptions);
      }
      window.removeEventListener("keydown", onEchap);
      const a = audioRef.current;
      if (a && !termineRef.current) a.pause();
      document.body.style.overflow = "";
    };
  }, [terminer]);

  // ── Rendu : NOTRE PAGE DE LOADING, à l'identique ───────────────────────

  return (
    <AnimatePresence>
      {actif && (
        <motion.div
          key="landing-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FONDE_SORTIE_MS / 1000, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#FAF6EF]"
          role="status"
          aria-live="polite"
          aria-label="Chargement du site — son du shofar"
        >
          <div className={enFonduSortie ? "transition-opacity duration-700 opacity-0" : "w-full"}>
            {/* ⭐ Reprise À L'IDENTIQUE de src/app/loading.tsx —
                notre page de loading : anneau or + « Un instant... » */}
            <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
              <div className="relative">
                {/* Anneau or pulsant */}
                <div className="w-16 h-16 rounded-full border-2 border-[#C9A227]/20" />
                <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-2 border-transparent border-t-gold animate-spin" />
              </div>
              <p className="mt-6 text-sm text-[#8A8378] italic font-serif">
                Un instant...
              </p>
            </div>
          </div>

          {/* Lecture auto bloquée → inviter discrètement au premier geste */}
          {sonBloque && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 text-[#A3821C] text-xs font-semibold"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Touchez l&apos;écran pour activer le son du shofar
            </motion.div>
          )}

          {/* Passer l'intro */}
          <button
            onClick={() => terminer(false)}
            className="absolute bottom-6 right-6 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#8A8378]/30 text-[#8A8378] hover:text-[#1E0F2B] hover:border-[#C9A227]/60 hover:bg-[#C9A227]/10 transition-colors text-xs font-semibold"
            title="Passer l'introduction (Échap)"
          >
            <FastForward className="w-3.5 h-3.5" />
            Passer
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
