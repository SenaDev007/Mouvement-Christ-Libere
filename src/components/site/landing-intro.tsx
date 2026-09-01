"use client";

/**
 * ⭐ V3.9 — INTRO DU LANDING PAGE : LE SHOFAR RETENTIT AU CHARGEMENT.
 * ============================================================================
 *
 * « Le landing page prend exactement 30 secondes à charger, et pendant
 * exactement ces 30 secondes, ça joue le son du shofar — les 30 premières
 * secondes du fichier du pasteur. »
 *
 * Fonctionnement :
 * 1. Au premier chargement du landing page d'une session de navigation
 *    (sessionStorage — pas de re-sonnerie si l'on revient sur « / » dans
 *    la même visite), un écran d'ouverture recouvre le site pendant
 *    EXACTEMENT 30 secondes.
 * 2. Pendant ces 30 secondes retentissent les 30 premières secondes du
 *    VRAI son du shofar (/sounds/shofar.mp3 — copie tronquée du média
 *    fourni), avec fondu de fermeture gracieux.
 * 3. Barre de progression dorée + compte à rebours ; « Passer » et Échap
 *    permettent de sauter l'intro (le son s'arrête alors).
 * 4. ⚠️ Règle des navigateurs : sans geste utilisateur la lecture auto
 *    peut être bloquée — une invite « Touchez l'écran pour activer le son »
 *    s'affiche alors, et le moindre clic/relâchement lance le son.
 * 5. Si le son a été débloqué en retard, il continue de retentir après
 *    l'ouverture du site jusqu'à ses 30 secondes naturelles.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Volume2, FastForward } from "lucide-react";

const CLE_SESSION = "mcl-intro-shofar";
const DUREE_MS = 30_000; // EXACTEMENT 30 secondes
const FICHIER = "/sounds/shofar.mp3";
const FONDE_SORTIE_MS = 900;

function formaterSecondes(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `0:${String(s).padStart(2, "0")}`;
}

export function LandingIntro() {
  const [actif, setActif] = useState(false);
  const [enFonduSortie, setEnFonduSortie] = useState(false);
  const [sonBloque, setSonBloque] = useState(false);
  const [restantMs, setRestantMs] = useState(DUREE_MS);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debutRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minuteurSortieRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termineRef = useRef(false);
  const mouvementReduit = useReducedMotion();

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

    // Barre de progression — EXACTEMENT 30 secondes
    intervalRef.current = setInterval(() => {
      const ecoule = Date.now() - debutRef.current;
      setRestantMs(Math.max(0, DUREE_MS - ecoule));
      if (ecoule >= DUREE_MS) {
        terminer(true);
      }
    }, 100);

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

  // ── Rendu ──────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {actif && (
        <motion.div
          key="landing-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: FONDE_SORTIE_MS / 1000, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          role="status"
          aria-live="polite"
          aria-label="Ouverture du site — son du shofar"
        >
          {/* Fond nuit profonde + halo doré */}
          <div className="absolute inset-0 bg-[#1E0F2B]" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(201,162,39,0.22) 0%, rgba(42,14,61,0) 70%)",
            }}
          />
          {/* Liseré or en haut et en bas */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#C9A227] to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#C9A227] to-transparent" />

          <div className={enFonduSortie ? "transition-opacity duration-700 opacity-0" : "w-full"}>
            <div className="flex flex-col items-center px-6 text-center max-w-xl mx-auto">
              {/* Corne */}
              <motion.div
                animate={
                  mouvementReduit
                    ? undefined
                    : { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }
                }
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="text-6xl md:text-7xl select-none leading-none drop-shadow-[0_0_24px_rgba(201,162,39,0.45)]"
                aria-hidden="true"
              >
                📯
              </motion.div>

              {/* Nom du mouvement */}
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#FAF6EF] mt-6 drop-shadow-lg">
                Mouvement Christ Libère
              </h1>
              <p className="font-serif italic text-[#C9A227] text-lg md:text-xl mt-3">
                Le shofar retentit…
              </p>
              <p className="text-[11px] text-[#FAF6EF]/50 mt-2 uppercase tracking-[0.25em] font-semibold">
                Ouverture de la visitation
              </p>

              {/* Barre de progression — 30 s exactement */}
              <div className="w-full max-w-sm mt-8">
                <div className="h-1.5 rounded-full bg-[#FAF6EF]/12 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#9C7E1E] via-[#C9A227] to-[#E8CF6B]"
                    style={{
                      width: `${((DUREE_MS - restantMs) / DUREE_MS) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[10px] font-mono font-semibold text-[#FAF6EF]/60 tracking-widest">
                    {formaterSecondes(restantMs)}
                  </span>
                  <span className="text-[10px] font-semibold text-[#C9A227]/80 uppercase tracking-[0.2em]">
                    Préparation
                  </span>
                </div>
              </div>

              {/* Lecture auto bloquée → inviter au premier geste */}
              {sonBloque && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227] text-xs font-semibold"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Touchez l&apos;écran pour activer le son du shofar
                </motion.div>
              )}

              {/* Verset */}
              <p className="text-[11px] text-[#FAF6EF]/40 mt-8 leading-relaxed italic">
                « Car le Seigneur lui-même… descendra du ciel avec un son de trompette. »
                <span className="not-italic text-[#C9A227]/60"> — 1 Thessaloniciens 4:16</span>
              </p>
            </div>
          </div>

          {/* Passer l'intro */}
          <button
            onClick={() => terminer(false)}
            className="absolute bottom-6 right-6 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#FAF6EF]/15 text-[#FAF6EF]/55 hover:text-[#FAF6EF] hover:border-[#C9A227]/50 hover:bg-[#C9A227]/10 transition-colors text-xs font-semibold"
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
