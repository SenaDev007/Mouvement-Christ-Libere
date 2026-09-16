"use client";

/**
 * ⭐ V3.84 — Fenêtre d'instructions d'installation (composant PARTAGÉ).
 *
 * Extraite d'InstallAppButton pour être réutilisée par InstallToast
 * (toast de proposition d'installation) : quand le navigateur n'expose
 * pas de dialogue natif (iOS Safari n'émet jamais beforeinstallprompt,
 * Firefox non plus), le clic « Installer » ouvre ces marches à suivre,
 * une par plateforme.
 *
 * PORTAL vers document.body : la sidebar admin est transformée
 * (translate-x) et le header a un backdrop-blur — position:fixed y
 * serait piégé dans un ancêtre à contexte d'empilement. createPortal
 * place la fenêtre à la racine du DOM.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, Share, MoreVertical, Monitor, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

type Contexte = "public" | "admin" | "secretariat" | "tresorerie";

/** Libellés de l'application selon le contexte (en-tête de la fenêtre). */
const LIBELLE_APPLI: Record<Contexte, string> = {
  public: "Site public Christ Libère",
  admin: "Back-office Christ Libère",
  secretariat: "Secrétariat Christ Libère",
  tresorerie: "Trésorerie Christ Libère",
};

/** Nom courant dans la phrase « Installez … » (corps de la fenêtre). */
const LIBELLE_PHRASE: Record<Contexte, string> = {
  public: "la plateforme",
  admin: "le back-office",
  secretariat: "le secrétariat",
  tresorerie: "la trésorerie",
};

interface InstructionsInstallationProps {
  /** Contexte d'affichage — adapte les textes de la fenêtre. */
  contexte: Contexte;
  /** iPhone / iPad détecté — met en avant la marche iOS (« votre appareil »). */
  estIOS: boolean;
  /** Fenêtre ouverte ? */
  ouvert: boolean;
  /** Demande de fermeture (bouton X, Échap, clic sur le fond). */
  onFermer: () => void;
}

export function InstructionsInstallation({
  contexte,
  estIOS,
  ouvert,
  onFermer,
}: InstructionsInstallationProps) {
  // Échap → fermer.
  useEffect(() => {
    if (!ouvert) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  const libelle = "Installer l'application";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={libelle}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onClick={onFermer}
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
              {LIBELLE_APPLI[contexte]}
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
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
              {LIBELLE_PHRASE[contexte]}
            </strong>{" "}
            sur votre appareil : l&apos;icône du logo s&apos;ajoute à votre
            écran d&apos;accueil et l&apos;application s&apos;ouvre
            directement, sans passer par le lien.
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
            Même logo, applications distinctes : « Site public Christ Libère »
            pour les croyants, « Back-office », « Secrétariat » et « Trésorerie
            Christ Libère » pour la gestion du ministère.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
