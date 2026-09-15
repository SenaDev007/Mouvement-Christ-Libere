"use client";

/**
 * ⭐ V3.84 — InstallToast : toast de proposition d'installation de la PWA
 * « Site public Christ Libère ».
 *
 * Directive : « il faut un toast de notification avec le bouton pour
 * proposer à l'utilisateur l'installation si c'est pas encore fait — le
 * système doit vérifier si l'installation a déjà été faite — avec un autre
 * bouton "ne plus afficher" » (le bouton d'installation de la BARRE de
 * navigation est retiré ; celui du footer reste).
 *
 * Comportement :
 *  · JAMAIS affiché si l'application est déjà installée (display-mode:
 *    standalone, navigator.standalone iOS, événement appinstalled) ;
 *  · proposé uniquement quand l'installation est RÉELLEMENT possible :
 *    Chrome/Edge/Chromium (événement beforeinstallprompt capturé → clic
 *    « Installer » = dialogue natif) ou iPhone/iPad (instructions
 *    « Partager → Sur l'écran d'accueil ») ;
 *  · « Ne plus afficher » → mémoire LOCALE (plus jamais sur cet appareil) ;
 *  · croix de fermeture → mémoire de SESSION (ne revient pas pendant la
 *    visite, mais pourra revenir à la prochaine) ;
 *  · apparition différée (~3 s) pour ne pas interrompre la lecture ;
 *  · auto-masqué sur les espaces internes (/admin, /secretariat,
 *    /tresorerie) et les pages d'authentification — le toast ne concerne
 *    que le site public ;
 *  · après une tentative (dialogue natif accepté OU refusé), le toast ne
 *    revient pas pendant la session — le bouton du footer reste toujours
 *    disponible.
 *
 * Hydration-safe : tous les états sont posés dans des effets — le rendu
 * serveur et le premier rendu client sont identiques (toast invisible).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { InstructionsInstallation } from "@/components/pwa/instructions-installation";

// Événement « beforeinstallprompt » (Chromium) — absent des types DOM
// standard de TypeScript, d'où cette interface locale.
interface EvenementInstallDiffere extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

/** Espaces internes / auth : le toast ne concerne que le site public. */
const ROUTES_INTERDITES = [
  "/admin",
  "/secretariat",
  "/tresorerie",
  "/login",
  "/register",
];

/** Mémoires de refus — cloisonnées pour ne jamais se gêner. */
const CLE_NE_PLUS_AFFICHER = "mcl-pwa-install-ne-plus-afficher"; // localStorage
const CLE_FERME_SESSION = "mcl-pwa-install-ferme-session"; // sessionStorage

/** Délai avant l'apparition — laisser la page respirer. */
const DELAI_APPARITION_MS = 3000;

export function InstallToast() {
  const pathname = usePathname();
  const [peutPromouvoir, setPeutPromouvoir] = useState(false);
  const [estInstalle, setEstInstalle] = useState(false);
  const [estIOS, setEstIOS] = useState(false);
  const [visible, setVisible] = useState(false);
  const [instructionsOuvertes, setInstructionsOuvertes] = useState(false);
  const differeRef = useRef<EvenementInstallDiffere | null>(null);

  const routeInterdite = ROUTES_INTERDITES.some((route) =>
    pathname?.startsWith(route)
  );

  // ── Détection des capacités + gardes de mémoire ──
  useEffect(() => {
    // Déjà installée ? (fenêtre standalone PWA, ou écran d'accueil iOS)
    const enStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      (window.navigator as Navigator & { standalone?: boolean })
        .standalone === true;
    if (enStandalone) {
      setEstInstalle(true);
      return;
    }

    // Refus permanent (« Ne plus afficher ») ou fermeture de session ?
    try {
      if (window.localStorage.getItem(CLE_NE_PLUS_AFFICHER) === "1") return;
      if (window.sessionStorage.getItem(CLE_FERME_SESSION) === "1") return;
    } catch {
      // Stockage indisponible (navigation privée stricte…) — on propose.
    }

    // iPhone / iPad ? (Safari iOS n'émet JAMAIS beforeinstallprompt —
    // l'installation passe par Partager → « Sur l'écran d'accueil »).
    // iPadOS 13+ se présente comme « MacIntel » avec écran tactile.
    const ua = window.navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1);
    if (ios) setEstIOS(true);

    const surBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      differeRef.current = e as EvenementInstallDiffere;
      setPeutPromouvoir(true);
    };
    const surAppInstalled = () => {
      setEstInstalle(true);
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", surBeforeInstallPrompt);
    window.addEventListener("appinstalled", surAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", surBeforeInstallPrompt);
      window.removeEventListener("appinstalled", surAppInstalled);
    };
  }, []);

  // ── Apparition différée (une seule fois, conditions réunies) ──
  useEffect(() => {
    if (routeInterdite || estInstalle || visible) return;
    if (!peutPromouvoir && !estIOS) return;
    const minuteur = setTimeout(() => setVisible(true), DELAI_APPARITION_MS);
    return () => clearTimeout(minuteur);
  }, [peutPromouvoir, estIOS, estInstalle, routeInterdite, visible]);

  // Navigation vers un espace interne → le toast se retire poliment.
  useEffect(() => {
    if (routeInterdite) setVisible(false);
  }, [routeInterdite]);

  /** « Installer » : dialogue natif (Chromium) ou instructions (iOS…). */
  const surInstaller = useCallback(async () => {
    const differe = differeRef.current;
    if (differe) {
      try {
        await differe.prompt();
        const choix = await differe.userChoice;
        if (choix.outcome === "accepted") setEstInstalle(true);
      } catch {
        // Dialogue indisponible (déjà consommé / refusé) → instructions.
        setInstructionsOuvertes(true);
      }
      differeRef.current = null;
      setPeutPromouvoir(false);
      // Tentative faite → ne pas re-proposer pendant cette session
      // (le bouton du footer reste, lui, toujours disponible).
      try {
        window.sessionStorage.setItem(CLE_FERME_SESSION, "1");
      } catch {
        /* stockage indisponible — sans conséquence */
      }
      setVisible(false);
      return;
    }
    setInstructionsOuvertes(true);
  }, []);

  /** « Ne plus afficher » : refus définitif sur cet appareil. */
  const surNePlusAfficher = useCallback(() => {
    try {
      window.localStorage.setItem(CLE_NE_PLUS_AFFICHER, "1");
    } catch {
      /* stockage indisponible — le toast reviendra, sans gravité */
    }
    setVisible(false);
  }, []);

  /** Croix : fermeture pour cette session uniquement. */
  const surFermer = useCallback(() => {
    try {
      window.sessionStorage.setItem(CLE_FERME_SESSION, "1");
    } catch {
      /* stockage indisponible — sans conséquence */
    }
    setVisible(false);
  }, []);

  if (!visible) {
    // La fenêtre d'instructions reste montable même sans toast visible ?
    // Non : elle ne s'ouvre QUE depuis le bouton « Installer » du toast.
    return null;
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-label="Proposition d'installation de l'application"
        className="animate-toast-install fixed inset-x-4 bottom-4 z-[110] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[400px]"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[#C9A227]/40 bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] shadow-2xl shadow-[#1A0826]/60">
          {/* Halo doré discret */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#C9A227]/15 blur-3xl rounded-full pointer-events-none" />

          <div className="relative p-4">
            {/* Fermeture (session) */}
            <button
              type="button"
              onClick={surFermer}
              aria-label="Fermer pour cette visite"
              className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-lg text-[#FAF6EF]/60 hover:text-[#FAF6EF] hover:bg-[#FAF6EF]/10 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <Image
                src="/logo-christ-libere-v3.png"
                alt="Christ Libère"
                width={44}
                height={44}
                className="w-11 h-11 object-contain flex-shrink-0"
              />
              <div className="min-w-0">
                <p
                  className="text-sm font-bold text-[#FAF6EF] leading-tight"
                  style={{
                    fontFamily:
                      "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif",
                  }}
                >
                  <span style={{ color: "#C9A227" }}>Christ</span>
                  <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>{" "}
                  <span className="text-[#FAF6EF]/90">sur votre écran</span>
                </p>
                <p className="text-xs text-[#FAF6EF]/70 leading-relaxed mt-1">
                  Installez l&apos;application : ouverture directe et plein
                  écran, comme une vraie application — sans passer par le
                  lien.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3.5 pl-[56px] sm:pl-0">
              <button
                type="button"
                onClick={surInstaller}
                className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2 rounded-full bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] active:scale-[0.98] transition-all whitespace-nowrap flex-1 sm:flex-none"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Installer
              </button>
              <button
                type="button"
                onClick={surNePlusAfficher}
                className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2 rounded-full border border-[#FAF6EF]/25 text-[#FAF6EF]/70 hover:text-[#FAF6EF] hover:border-[#FAF6EF]/50 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Smartphone className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
                Ne plus afficher
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions (iOS, Firefox…) — même fenêtre que le bouton du footer. */}
      <InstructionsInstallation
        contexte="public"
        estIOS={estIOS}
        ouvert={instructionsOuvertes}
        onFermer={() => setInstructionsOuvertes(false)}
      />
    </>
  );
}
