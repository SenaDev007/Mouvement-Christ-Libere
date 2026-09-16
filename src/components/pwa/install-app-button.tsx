"use client";

/**
 * InstallAppButton — ⭐ V3.80 — PWA installable sur smartphone ET desktop.
 * ⭐ V3.84 — la fenêtre d'instructions vit désormais dans le composant
 * partagé InstructionsInstallation (réutilisée par InstallToast).
 *
 * Le site public, le back-office et les espaces secrétariat / trésorerie
 * (V3.89) possèdent chacun leur manifest dédié (public/manifest*.webmanifest) :
 * les applications s'installent séparément avec le MÊME logo.
 *
 * Ce bouton rend l'installation DÉCOUVRABLE :
 *  · Chrome / Edge / Chromium (desktop + Android) : événement
 *    « beforeinstallprompt » capturé → clic = dialogue natif d'installation
 *    (le bouton n'apparaît que quand l'installation est possible) ;
 *  · iPhone / iPad (Safari, jamais de beforeinstallprompt) : clic = fenêtre
 *    d'instructions « Partager → Sur l'écran d'accueil » ;
 *  · variante « toujoursVisible » (footer, sidebar admin) :
 *    le bouton reste affiché et ouvre les instructions universelles
 *    (Chrome, Edge, Firefox, Android, iOS) — chaque plateforme a sa marche
 *    à suivre, le clic déclenche l'installation native quand elle existe.
 *
 * Masqué automatiquement quand l'application est déjà installée
 * (display-mode: standalone / navigator.standalone / événement appinstalled).
 *
 * ⭐ V3.84 — RETIRÉ de la barre de navigation publique (directive : le
 * toast de proposition InstallToast remplace le bouton d'en-tête) ;
 * le composant reste utilisé par le footer du site public et la sidebar
 * du back-office.
 *
 * Hydration-safe : tous les états sont posés dans des effets — le rendu
 * serveur et le premier rendu client sont identiques (bouton caché), puis
 * le bouton apparaît une fois les capacités du navigateur connues.
 */

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
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

type Variante = "or" | "icone" | "sidebar";
type Contexte = "public" | "admin" | "secretariat" | "tresorerie";

interface InstallAppButtonProps {
  /** Contexte d'affichage — adapte les textes de la fenêtre d'instructions
   *  (site public, back-office, secrétariat, trésorerie — V3.89). */
  contexte?: Contexte;
  /** Style du bouton : pilule dorée « or », icône compacte « icone » (header
   *  desktop), ligne discrète « sidebar » (pied de sidebar back-office). */
  variante?: Variante;
  /** Afficher le bouton même sans prompt détecté (footer / burger) — le clic
   *  ouvre alors les instructions universelles. */
  toujoursVisible?: boolean;
  /** Classes additionnelles appliquées au bouton. */
  className?: string;
}

export function InstallAppButton({
  contexte = "public",
  variante = "or",
  toujoursVisible = false,
  className,
}: InstallAppButtonProps) {
  const [differe, setDiffere] = useState<EvenementInstallDiffere | null>(null);
  const [peutPromouvoir, setPeutPromouvoir] = useState(false);
  const [estInstalle, setEstInstalle] = useState(false);
  const [estIOS, setEstIOS] = useState(false);
  const [instructionsOuvertes, setInstructionsOuvertes] = useState(false);

  useEffect(() => {
    // Déjà installée ? (fenêtre standalone PWA, ou écran d'accueil iOS)
    const enStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      (window.navigator as Navigator & { standalone?: boolean })
        .standalone === true;
    if (enStandalone) setEstInstalle(true);

    // iPhone / iPad ? (Safari iOS n'émet JAMAIS beforeinstallprompt —
    // l'installation passe par Partager → « Sur l'écran d'accueil »).
    // iPadOS 13+ se présente comme « MacIntel » avec écran tactile.
    const ua = window.navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1);
    setEstIOS(ios);

    const surBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDiffere(e as EvenementInstallDiffere);
      setPeutPromouvoir(true);
    };
    const surAppInstalled = () => {
      setEstInstalle(true);
      setPeutPromouvoir(false);
      setDiffere(null);
    };
    window.addEventListener("beforeinstallprompt", surBeforeInstallPrompt);
    window.addEventListener("appinstalled", surAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", surBeforeInstallPrompt);
      window.removeEventListener("appinstalled", surAppInstalled);
    };
  }, []);

  const surClic = useCallback(async () => {
    if (differe) {
      try {
        await differe.prompt();
        const choix = await differe.userChoice;
        if (choix.outcome === "accepted") setEstInstalle(true);
      } catch {
        // Dialogue indisponible (déjà consommé / refusé) → instructions.
      }
      setDiffere(null);
      setPeutPromouvoir(false);
      return;
    }
    setInstructionsOuvertes(true);
  }, [differe]);

  const visible = !estInstalle && (toujoursVisible || peutPromouvoir || estIOS);
  if (!visible) return null;

  const libelle = "Installer l'application";

  return (
    <>
      {variante === "or" && (
        <button
          type="button"
          onClick={surClic}
          aria-label={libelle}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2 rounded-full bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] active:scale-[0.98] transition-all whitespace-nowrap",
            className
          )}
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          {libelle}
        </button>
      )}

      {variante === "icone" && (
        <button
          type="button"
          onClick={surClic}
          aria-label={libelle}
          title={libelle}
          className={cn(
            "hidden sm:inline-flex items-center justify-center size-10 rounded-lg text-[#DDBE55]/80 hover:text-[#C9A227] hover:bg-[#FAF6EF]/10 transition-colors",
            className
          )}
        >
          <Download className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {variante === "sidebar" && (
        <button
          type="button"
          onClick={surClic}
          className={cn(
            "w-full flex items-center gap-2 text-xs text-[#FAF6EF]/60 hover:text-[#C9A227] transition-colors py-1.5 text-left",
            className
          )}
        >
          <Download className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {libelle}
        </button>
      )}

      {/* ⭐ V3.84 — Fenêtre d'instructions : composant partagé (PORTAL vers
          document.body — la sidebar admin est transformée (translate-x) et le
          header a un backdrop-blur : position:fixed y serait piégé). */}
      <InstructionsInstallation
        contexte={contexte}
        estIOS={estIOS}
        ouvert={instructionsOuvertes}
        onFermer={() => setInstructionsOuvertes(false)}
      />
    </>
  );
}
