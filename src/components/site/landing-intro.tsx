"use client";

/**
 * ⭐ V3.14 — INTRO DU LANDING : LA PAGE DE LOADING DU MOUVEMENT.
 * ============================================================================
 *
 * La page de loading du Mouvement (palette Christ Libère, logo officiel au
 * centre, barre de chargement dorée) — directives du pasteur (02/09/2026) :
 *
 *   1. LA PAGE DE LOADING S'AFFICHE EN PREMIER, AVANT le landing page —
 *      elle est rendue dans le HTML initial (état initial « actif » au
 *      premier rendu, serveur comme client) : le site ne peut JAMAIS
 *      apparaître quelques secondes avant elle. Elle revient à CHAQUE
 *      chargement complet du site (première visite, nouvel onglet,
 *      rafraîchissement) — mais pas lors des navigations internes.
 *   2. Durée de chargement : 5 SECONDES MAXIMUM (barre 0 → 100 %).
 *   3. Le SON DU SHOFAR dure 30 secondes et CONTINUE de retentir après
 *      l'ouverture du site : l'écran s'ouvre à 5 s, le shofar achève
 *      ses 30 s naturelles sous le site affiché.
 *   4. La barre de progression affiche un POURCENTAGE (plus de minutes).
 *   5. Titre : « Christ Libère » (même style, même couleur).
 *
 * Conservé par ailleurs : palette nuit #1E0F2B + halo radial or + liserés,
 * le VRAI logo officiel (Afrique + lion) au centre pulsant doucement,
 * « Le shofar retentit… », verset 1 Th 4:16, bouton « Passer » + Échap,
 * gestion de l'autoplay bloqué (invite au premier geste — le son démarre
 * alors et finit ses 30 s), fondu de sortie, défilement verrouillé pendant
 * l'écran, prefers-reduced-motion respecté.
 *
 * ⚠️ Plus de sessionStorage : il survivait au rafraîchissement (même
 * onglet) et masquait la page de loading demandée à chaque affichage du
 * site. Un simple drapeau module suffit : il distingue le rechargement
 * complet (nouveau runtime JS → l'intro se rejoue) de la navigation
 * interne (module déjà chargé → pas de re-sonnerie).
 *
 * ⭐ V3.53 — LE SHOFAR DÈS LE PREMIER INSTANT, SÉCURITÉ RENFORCÉE :
 *   · AVANT : le son était créé en JS (`new Audio`) APRÈS l'hydratation →
 *     la tentative d'autoplay partait TARD (1-3 s) et échouait dès que le
 *     navigateur appliquait strictement sa politique anti-autoplay SONORE.
 *   · MAINTENANT : l'élément `<audio autoPlay preload="auto">` est rendu
 *     dans le HTML INITIAL (SSR) → le navigateur tente la lecture au PARSE
 *     de la page, bien avant le JS : c'est la tentative la plus PRÉCOCE
 *     possible, celle que les navigateurs honorent dès qu'une dérogation
 *     existe (interaction déjà eue avec le domaine dans la session, indice
 *     d'engagement médiatique Chrome/MEI, site installé comme app PWA).
 *   · L'élément vit HORS de l'overlay (état audioVivant) : ses 30 s
 *     continuent de retentir sous le site après l'ouverture (V3.14).
 *   · Si le navigateur refuse (première visite À FROID — aucun site web
 *     ne peut forcer un son avant le tout premier geste, c'est une règle
 *     des navigateurs) : le shofar démarre au PREMIER geste QUELCONQUE
 *     (toucher, clic, touche du clavier — capture) et achève ses 30 s ;
 *     chaque visite où il retentit nourrit l'indice d'engagement (MEI) →
 *     les visites suivantes démarrent SEULES, sans geste.
 *
 * ⭐ V3.54 — DIRECTIVE DU PASTEUR : l'invite « Touchez l'écran pour activer
 * le son » est SUPPRIMÉE (plus AUCUN élément à taper). Le déblocage au
 * premier geste quelconque (toucher/clic/touche, en capture, INVISIBLE)
 * reste en place, une nouvelle tentative silencieuse part dès que le média
 * est prêt (onCanPlay), et le geste « click » est ajouté aux événements de
 * déblocage. Sur le navigateur du pasteur, l'autoplay deviendra définitif
 * par les réglages décrits dans le worklog V3.54 : autorisation « Son » du
 * site dans les paramètres du navigateur, installation du site comme app
 * (PWA), ou mémoire d'engagement Chrome (MEI) qui se reconstitue après
 * quelques visites.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { FastForward } from "lucide-react";

/**
 * Drapeau de runtime : true dès que l'intro s'est jouée dans CE cycle de
 * vie du bundle client. Un rechargement complet (F5, nouvel onglet) crée
 * un nouveau runtime → false → la page de loading s'affiche de nouveau.
 * Une navigation interne (Link vers « / ») ne le reset PAS → pas de
 * re-sonnerie en pleine visite.
 */
let introDejaJoueeAuRuntime = false;

const DUREE_MS = 5_000; // ⭐ V3.14 — 5 secondes MAXIMUM (barre 0 → 100 %)
const FICHIER = "/sounds/shofar.mp3"; // 30 s — continue après l'ouverture
const FONDE_SORTIE_MS = 500;

// ⭐ V3.53 — Gestes qui débloquent l'audio quand le navigateur refuse la
// lecture automatique (politique anti-autoplay sonore) : pointerdown
// (souris + tactile moderne), touchend (iOS ancien), keydown (clavier),
// click (V3.54 — couverture maximale, tous navigateurs). Écouteurs posés
// sur window en phase de CAPTURE → le geste compte même s'il est consommé
// par un autre élément de la page : N'IMPORTE QUEL premier geste démarre
// le shofar, de façon invisible (invite supprimée en V3.54).
const ECOUTE_CAPTURE: AddEventListenerOptions = { capture: true };

function ecouterPremierGeste(handler: EventListener): void {
  window.addEventListener("pointerdown", handler, ECOUTE_CAPTURE);
  window.addEventListener("touchend", handler, ECOUTE_CAPTURE);
  window.addEventListener("keydown", handler, ECOUTE_CAPTURE);
  window.addEventListener("click", handler, ECOUTE_CAPTURE);
}

function nePlusEcouterLeGeste(handler: EventListener): void {
  window.removeEventListener("pointerdown", handler, ECOUTE_CAPTURE);
  window.removeEventListener("touchend", handler, ECOUTE_CAPTURE);
  window.removeEventListener("keydown", handler, ECOUTE_CAPTURE);
  window.removeEventListener("click", handler, ECOUTE_CAPTURE);
}

export function LandingIntro() {
  // ⭐ V3.14 — État initial calculé au PREMIER rendu : l'écran est VISIBLE
  // dès le premier paint (HTML serveur inclus) → le landing ne s'affiche
  // JAMAIS avant la page de loading. Hydratation identique (même valeur
  // initiale côté serveur et client) → aucun flash, aucun écart.
  const [actif, setActif] = useState(() => !introDejaJoueeAuRuntime);
  // ⭐ V3.53 — l'élément <audio> reste rendu TANT QUE le shofar doit
  // retentir (intro + 30 s sous le site) : il vit HORS de l'overlay
  // conditionnel — retiré seulement à sa fin naturelle (onEnded) ou au
  // « Passer » — pour que sa lecture traverse la fermeture de l'écran.
  const [audioVivant, setAudioVivant] = useState(() => !introDejaJoueeAuRuntime);
  const [enFonduSortie, setEnFonduSortie] = useState(false);
  const [restantMs, setRestantMs] = useState(DUREE_MS);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debutRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minuteurSortieRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termineRef = useRef(false);
  // Capture de l'état initial AU MONTAGE : l'effet ne démarre ses
  // minuteurs/son que si ce montage joue réellement l'intro (navigation
  // interne → déjà jouée dans ce runtime → rien).
  const doitJouerRef = useRef(actif);
  const mouvementReduit = useReducedMotion();

  const pourcentage = Math.min(
    100,
    Math.max(0, Math.round(((DUREE_MS - restantMs) / DUREE_MS) * 100))
  );

  // ── Clôture de l'écran (naturelle à 5 s, ou saut manuel) ──────────────
  const terminer = useCallback((naturel: boolean) => {
    if (termineRef.current) return;
    termineRef.current = true;
    introDejaJoueeAuRuntime = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const audio = audioRef.current;
    if (audio && !naturel) {
      // « Passer »/Échap : on coupe aussi le son et l'on retire l'élément.
      // (Ouverture NATURELLE : le shofar CONTINUE ses 30 s sous le site —
      // l'élément reste dans le DOM (audioVivant) et s'éteint de lui-même
      // à la fin du média, voir onEnded sur le <audio>.)
      audio.pause();
      setAudioVivant(false);
    }

    document.body.style.overflow = "";
    setEnFonduSortie(true);
    minuteurSortieRef.current = setTimeout(() => setActif(false), FONDE_SORTIE_MS);
  }, []);

  // ── Montage : minuteurs + shofar (si ce montage joue l'intro) ─────────
  useEffect(() => {
    // Navigation interne : l'intro a déjà été jouée dans ce runtime.
    if (!doitJouerRef.current) return;

    document.body.style.overflow = "hidden"; // pas de défilement pendant l'écran
    debutRef.current = Date.now();

    // ⭐ V3.53 — Le shofar réel : l'élément <audio autoPlay> est déjà dans
    // le HTML INITIAL (SSR) → le navigateur a pu démarrer la lecture au
    // PARSE de la page (dérogations : interaction déjà eue avec le domaine
    // dans la session, indice d'engagement médiatique Chrome, PWA
    // installée). Au montage, on GARANTIT la tentative (élément inséré
    // côté client lors d'une navigation interne, ou autoPlay différé) :
    const audio = audioRef.current;
    let debloquer: EventListener | null = null;

    if (audio) {
      audio.volume = 0.9;
      if (audio.paused && !audio.ended) {
        audio
          .play()
          .catch(() => {
            // ⭐ V3.54 — Lecture automatique refusée par le navigateur
            // (première visite à froid — politique anti-autoplay SONORE,
            // aucune page web ne peut la contourner : c'est une règle DU
            // NAVIGATEUR). SANS AUCUNE INVITE (supprimée à la demande du
            // pasteur) : le shofar démarre en silence au PREMIER geste
            // quelconque (toucher, clic, touche — capture) et achève ses
            // 30 s, même sous le site.
            const surPremierGeste: EventListener = () => {
              nePlusEcouterLeGeste(surPremierGeste);
              audio.play().catch(() => {
                /* reste silencieux : l'écran se poursuit sans son */
              });
            };
            debloquer = surPremierGeste;
            ecouterPremierGeste(surPremierGeste);
          });
      }
      // (autoPlay natif déjà démarré → rien à faire ; sinon le premier
      // geste enregistré ci-dessus démarre le shofar en silence.)
    }

    // 5 secondes de chargement (barre 0 → 100 %), puis ouverture du site
    // — le shofar, lui, continue jusqu'à 30 s.
    intervalRef.current = setInterval(() => {
      const restant = DUREE_MS - (Date.now() - debutRef.current);
      setRestantMs(Math.max(0, restant));
      if (restant <= 0) {
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
      if (debloquer) nePlusEcouterLeGeste(debloquer);
      window.removeEventListener("keydown", onEchap);
      const a = audioRef.current;
      if (a && !termineRef.current) a.pause();
      document.body.style.overflow = "";
    };
  }, [terminer]);

  // ── Rendu : la page de loading du Mouvement ───────────────────────────

  return (
    <>
      {/* ⭐ V3.53 — LE SHOFAR DANS LE HTML INITIAL : <audio autoPlay> rendu
          côté serveur → le navigateur tente la lecture DÈS LE PARSE de la
          page (avant le JS) — l'instant le plus précoce que les navigateurs
          puissent autoriser. L'élément vit HORS de l'overlay : sa lecture
          de 30 s continue sous le site après l'ouverture ; il est retiré à
          sa fin naturelle (onEnded) ou au « Passer ». */}
      {audioVivant && (
        <audio
          ref={audioRef}
          src={FICHIER}
          autoPlay
          preload="auto"
          onEnded={() => setAudioVivant(false)}
          onCanPlay={() => {
            // ⭐ V3.54 — nouvelle chance silencieuse dès que le média est
            // prêt (si la tentative initiale est partie avant le
            // chargement du fichier) : play() est sans effet sur un audio
            // déjà lancé, et un échec est ignoré (règle navigateur).
            const a = audioRef.current;
            if (a && a.paused && !a.ended) a.play().catch(() => {});
          }}
          aria-hidden="true"
        />
      )}

      <AnimatePresence>
      {actif && (
        <motion.div
          key="landing-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: mouvementReduit ? 0 : FONDE_SORTIE_MS / 1000,
            ease: "easeInOut",
          }}
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

          <div className={enFonduSortie ? "transition-opacity duration-500 opacity-0" : "w-full"}>
            <div className="min-h-[70vh] w-full flex flex-col items-center justify-center px-4 text-center">

              {/* ⭐ LE LOGO OFFICIEL DE CHRIST LIBÈRE AU CENTRE */}
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
                {/* ⭐ V3.28 — logo via next/image : le PNG source de 156 Ko
                    était servi TEL QUEL par le <img> ; l'optimiseur sert
                    désormais un ~144/176px AVIF/WebP (~15-30 Ko). width/height
                    déclarés + w-36 h-auto → zéro CLS (comportement du <img>
                    d'origine conservé), priority car premier élément visible. */}
                <Image
                  src="/logo-christ-libere-v2.png"
                  alt="Logo Christ Libère"
                  width={168}
                  height={178}
                  priority
                  sizes="(min-width: 768px) 176px, 144px"
                  className="relative w-36 h-auto md:w-44 select-none drop-shadow-[0_0_38px_rgba(201,162,39,0.5)]"
                />
              </motion.div>

              {/* ⭐ V3.14 — « Christ Libère » (même style, même couleur) */}
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#FAF6EF] mt-7 drop-shadow-lg">
                Christ Libère
              </h1>
              <p className="font-serif italic text-[#C9A227] text-lg md:text-xl mt-3">
                Le shofar retentit…
              </p>
              <p className="text-[11px] text-[#FAF6EF]/50 mt-2 uppercase tracking-[0.25em] font-semibold">
                Ouverture de la visitation
              </p>

              {/* Barre de chargement — 5 s, en POURCENTAGE */}
              <div className="w-full max-w-sm mt-8">
                <div className="h-1.5 rounded-full bg-[#FAF6EF]/12 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#9C7E1E] via-[#C9A227] to-[#E8CF6B] transition-[width] duration-100 ease-linear"
                    style={{ width: `${pourcentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <span
                    className="text-[10px] font-mono font-semibold text-[#FAF6EF]/60 tracking-widest tabular-nums"
                    aria-label={`Chargement : ${pourcentage} pour cent`}
                  >
                    {pourcentage}&nbsp;%
                  </span>
                  <span className="text-[10px] font-semibold text-[#C9A227]/80 uppercase tracking-[0.2em]">
                    Chargement
                  </span>
                </div>
              </div>

              {/* Verset */}
              <p className="text-[11px] text-[#FAF6EF]/40 mt-8 leading-relaxed italic">
                « Car le Seigneur lui-même… descendra du ciel avec un son de trompette. »
                <span className="not-italic text-[#C9A227]/60"> — 1 Thessaloniciens 4:16</span>
              </p>
            </div>
          </div>

          {/* Passer l'écran (coupe aussi le son) */}
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
    </>
  );
}
