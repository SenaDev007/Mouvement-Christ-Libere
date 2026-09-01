"use client";

/**
 * ⭐ V3.13 — INTRO DU LANDING : LA PAGE DE LOADING DU MOUVEMENT.
 * ============================================================================
 *
 * « On avait créé une page de loading avec la palette de couleurs de Christ
 * Libère et il y avait le logo de Christ Libère au centre de la page, avec
 * une barre de chargement. C'est de cette page de loading que je parle. »
 *
 * Retour donc à NOTRE écran d'ouverture dédié (l'écran générique « anneau
 * or + Un instant... » de V3.11 est abandonné) :
 *   • palette Christ Libère : fond nuit #1E0F2B + halo radial or ;
 *   • le VRAI logo officiel de Christ Libère (Afrique + lion, PNG à fond
 *     transparent) AU CENTRE de la page, pulsant doucement ;
 *   • barre de chargement dorée 30 s + compte à rebours ;
 *   • le son du shofar retentit pendant EXACTEMENT 30 secondes.
 *
 * Fonctionnement conservé :
 * 1. Au premier chargement du landing page d'une session de navigation
 *    (sessionStorage — pas de re-sonnerie si l'on revient sur « / » dans
 *    la même visite), l'écran recouvre le site pendant EXACTEMENT 30 s.
 * 2. Pendant ces 30 s retentissent les 30 premières secondes du VRAI son
 *    du shofar (/sounds/shofar.mp3).
 * 3. « Passer » et Échap permettent de sauter l'intro (le son s'arrête).
 * 4. ⚠️ Règle des navigateurs : sans geste utilisateur la lecture auto
 *    peut être bloquée — une invite s'affiche alors, et le moindre
 *    clic/relâchement lance le son.
 * 5. Si le son a été débloqué en retard, il continue après l'ouverture
 *    du site jusqu'à ses 30 secondes naturelles.
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

    // EXACTEMENT 30 secondes, puis ouverture du site
    intervalRef.current = setInterval(() => {
      const restant = DUREE_MS - (Date.now() - debutRef.current);
      setRestantMs(Math.max(0, restant));
      if (restant <= 0) {
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

  // ── Rendu : la page de loading du Mouvement ───────────────────────────

  return (
    <AnimatePresence>
      {actif && (
        <motion.div
          key="landing-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FONDE_SORTIE_MS / 1000, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center bg-[#1E0F2B]"
          role="status"
          aria-live="polite"
          aria-label="Chargement du site — son du shofar"
        >
          {/* Palette Christ Libère : halo radial doré sur fond nuit */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 38%, rgba(201,162,39,0.22) 0%, rgba(201,162,39,0.08) 34%, rgba(30,15,43,0) 62%)",
            }}
          />
          {/* Liserés or haut/bas */}
          <div aria-hidden className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A227]/60 to-transparent" />
          <div aria-hidden className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A227]/60 to-transparent" />

          <div className={enFonduSortie ? "transition-opacity duration-700 opacity-0" : "w-full"}>
            <div className="min-h-[70vh] w-full flex flex-col items-center justify-center px-4 text-center">

              {/* ⭐ V3.13 — LE LOGO OFFICIEL DE CHRIST LIBÈRE AU CENTRE */}
              <motion.div
                animate={
                  mouvementReduit
                    ? undefined
                    : { scale: [1, 1.04, 1], opacity: [0.9, 1, 0.9] }
                }
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                {/* Double halo doré derrière le logo */}
                <div
                  aria-hidden
                  className="absolute -inset-6 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(201,162,39,0.28) 0%, rgba(201,162,39,0) 70%)" }}
                />
                {/* Using img pour éviter le loader Next (aucun décalage de layout) */}
                <img
                  src="/logo-christ-libere.png"
                  alt="Logo du Mouvement Christ Libère"
                  width={168}
                  height={178}
                  className="relative w-36 h-auto md:w-44 select-none drop-shadow-[0_0_38px_rgba(201,162,39,0.5)]"
                  draggable={false}
                />
              </motion.div>

              {/* Nom du mouvement */}
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#FAF6EF] mt-7 drop-shadow-lg">
                Mouvement Christ Libère
              </h1>
              <p className="font-serif italic text-[#C9A227] text-lg md:text-xl mt-3">
                Le shofar retentit…
              </p>
              <p className="text-[11px] text-[#FAF6EF]/50 mt-2 uppercase tracking-[0.25em] font-semibold">
                Ouverture de la visitation
              </p>

              {/* Barre de chargement — 30 s exactement */}
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
                    Chargement
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
