"use client";

/**
 * InstallAppButton — ⭐ V3.80 — PWA installable sur smartphone ET desktop.
 *
 * Le site public et le back-office possèdent chacun leur manifest dédié
 * (public/manifest.webmanifest « Site public Christ Libère » et
 * public/manifest-back-office.webmanifest « Back-office Christ Libère ») :
 * les deux applications s'installent séparément avec le MÊME logo.
 *
 * Ce bouton rend l'installation DÉCOUVRABLE :
 *  · Chrome / Edge / Chromium (desktop + Android) : événement
 *    « beforeinstallprompt » capturé → clic = dialogue natif d'installation
 *    (le bouton n'apparaît que quand l'installation est possible) ;
 *  · iPhone / iPad (Safari, jamais de beforeinstallprompt) : clic = fenêtre
 *    d'instructions « Partager → Sur l'écran d'accueil » ;
 *  · variante « toujoursVisible » (footer, menu burger, sidebar admin) :
 *    le bouton reste affiché et ouvre les instructions universelles
 *    (Chrome, Edge, Firefox, Android, iOS) — chaque plateforme a sa marche
 *    à suivre, le clic déclenche l'installation native quand elle existe.
 *
 * Masqué automatiquement quand l'application est déjà installée
 * (display-mode: standalone / navigator.standalone / événement appinstalled).
 *
 * Hydration-safe : tous les états sont posés dans des effets — le rendu
 * serveur et le premier rendu client sont identiques (bouton caché), puis
 * le bouton apparaît une fois les capacités du navigateur connues.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Download,
  X,
  Share,
  MoreVertical,
  Monitor,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
type Contexte = "public" | "admin";

interface InstallAppButtonProps {
  /** Contexte d'affichage — adapte les textes de la fenêtre d'instructions. */
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

  // Échap → fermer la fenêtre d'instructions.
  useEffect(() => {
    if (!instructionsOuvertes) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInstructionsOuvertes(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [instructionsOuvertes]);

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

      {/* ⭐ V3.80 — Fenêtre d'instructions : PORTAL vers document.body.
          La sidebar admin est transformée (translate-x) et le header a un
          backdrop-blur : position:fixed y serait piégé dans un ancêtre à
          contexte d'empilement. createPortal place la fenêtre à la racine. */}
      {instructionsOuvertes &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={libelle}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            onClick={() => setInstructionsOuvertes(false)}
          >
            <div className="absolute inset-0 bg-[#1A0826]/80 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-md bg-[#FAF6EF] rounded-2xl border border-[#C9A227]/40 shadow-2xl shadow-[#1A0826]/50 overflow-hidden max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* En-tête — logo + titre + fermeture */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[#C9A227]/25 bg-[#2A0E3D]">
                <Image
                  src="/logo-christ-libere-v3.png"
                  alt="Christ Libère"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-base font-bold leading-tight"
                    style={{
                      fontFamily:
                        "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif",
                    }}
                  >
                    <span style={{ color: "#C9A227" }}>Christ</span>
                    <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>
                  </p>
                  <p className="text-xs text-[#DDBE55]/80 font-medium">
                    {contexte === "admin"
                      ? "Back-office Christ Libère"
                      : "Site public Christ Libère"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInstructionsOuvertes(false)}
                  aria-label="Fermer"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-[#FAF6EF]/70 hover:text-[#FAF6EF] hover:bg-[#FAF6EF]/10 transition-colors"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              {/* Corps — pourquoi + marches à suivre par plateforme */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-[#1E0F2B]/80 leading-relaxed">
                  Installez{" "}
                  <strong className="font-semibold text-[#2A0E3D]">
                    {contexte === "admin"
                      ? "le back-office"
                      : "la plateforme"}
                  </strong>{" "}
                  sur votre appareil : l&apos;icône du logo s&apos;ajoute à
                  votre écran d&apos;accueil et l&apos;application
                  s&apos;ouvre directement, sans passer par le lien.
                </p>

                <ul className="space-y-2">
                  {(
                    [
                      {
                        icone: Share,
                        titre: "iPhone / iPad",
                        texte:
                          "Dans Safari : bouton Partager (carré avec flèche montante) → « Sur l’écran d’accueil ».",
                        accent: estIOS,
                      },
                      {
                        icone: MoreVertical,
                        titre: "Android — Chrome",
                        texte: "Menu ⋮ → « Installer l’application ».",
                        accent: false,
                      },
                      {
                        icone: Monitor,
                        titre: "Ordinateur — Chrome / Edge",
                        texte:
                          "Icône d’installation dans la barre d’adresse (à droite de l’adresse), ou menu ⋮ → « Installer Christ Libère… ».",
                        accent: false,
                      },
                      {
                        icone: Menu,
                        titre: "Firefox",
                        texte: "Menu ☰ → « Installer l’application ».",
                        accent: false,
                      },
                    ] as const
                  ).map((ligne) => (
                    <li
                      key={ligne.titre}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-3.5 py-3",
                        ligne.accent
                          ? "border-[#C9A227] bg-[#C9A227]/10"
                          : "border-[#8A8378]/20 bg-white/60"
                      )}
                    >
                      <span
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                          ligne.accent
                            ? "bg-[#C9A227] text-[#1E0F2B]"
                            : "bg-[#2A0E3D]/10 text-[#2A0E3D]"
                        )}
                      >
                        <ligne.icone className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1E0F2B]">
                          {ligne.titre}
                          {ligne.accent && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-[#A3821C] font-bold">
                              votre appareil
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#1E0F2B]/70 leading-relaxed mt-0.5">
                          {ligne.texte}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="text-[11px] text-[#8A8378] leading-relaxed pt-1">
                  Même logo, deux applications distinctes : « Site public
                  Christ Libère » pour les croyants, « Back-office Christ
                  Libère » pour la gestion du ministère.
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
