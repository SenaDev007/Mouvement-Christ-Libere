"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Link2, Mail, Share2 } from "lucide-react";
import {
  WhatsAppIcon, FacebookIcon, XIcon, TelegramIcon, LinkedInIcon,
} from "@/components/videos/social-icons";

/**
 * ⭐ V3.36 — MODAL DE PARTAGE COMPLET (remplace les petits popovers).
 *
 * Anomalie remontée par le pasteur : le panneau de partage ouvert depuis le
 * lecteur était trop petit — la liste des plateformes était tronquée — et il
 * fallait cliquer D'ABORD sur la vidéo avant qu'il ne se ferme ; cliquer en
 * dehors ne faisait rien.
 *
 * Ce composant répond aux trois exigences :
 *  1. TOUT le contenu visible d'un seul coup : grille 3×2 des plateformes,
 *     hauteur auto (jamais tronquée), défilement interne uniquement en
 *     dernier recours (très petits écrans) ;
 *  2. Clic en dehors → fermeture (overlay plein écran), PC ET mobile ;
 *  3. Modal agrandi et lisible : fiche (miniature + titre) + gros boutons
 *     tactiles, feuille plein-largeur en bas d'écran sur mobile, carte
 *     centrée sur desktop.
 *
 * Fermeture : overlay, bouton ✕, touche Échap. Défilement de la page
 * bloqué pendant l'ouverture.
 */

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  /** URL à partager (page publique de la vidéo / du live). */
  url: string;
  /** Titre affiché dans la fiche et joint aux partages. */
  title: string;
  /** Miniature affichée dans la fiche (optionnelle). */
  thumbnailUrl?: string | null;
}

export function ShareModal({ open, onClose, url, title, thumbnailUrl }: ShareModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nativeShared, setNativeShared] = useState(false);

  // SSR safety : n'afficher le portail plein écran qu'après montage.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloquer le défilement de la page derrière le modal.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Échap → fermer.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );
  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  const shareUrl = encodeURIComponent(url);
  const shareTitle = encodeURIComponent(title);

  const platforms = [
    {
      name: "WhatsApp",
      icon: WhatsAppIcon,
      color: "#25D366",
      href: `https://wa.me/?text=${shareTitle}%20${shareUrl}`,
    },
    {
      name: "Facebook",
      icon: FacebookIcon,
      color: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
    },
    {
      name: "X",
      icon: XIcon,
      color: "#0f1419",
      href: `https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`,
    },
    {
      name: "Telegram",
      icon: TelegramIcon,
      color: "#229ED9",
      href: `https://t.me/share/url?url=${shareUrl}&text=${shareTitle}`,
    },
    {
      name: "E-mail",
      icon: null, // lucide Mail — pas une icône SVG de marque
      color: "#8A8378",
      href: `mailto:?subject=${shareTitle}&body=${shareUrl}`,
    },
    {
      name: "LinkedIn",
      icon: LinkedInIcon,
      color: "#0A66C2",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
    },
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Repli pour les contextes non sécurisés / anciens navigateurs.
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Partage natif du device (mobile surtout) — complète la grille sans la
  // surcharger : ouvre le sélecteur système (Messages, Messenger, etc.).
  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({ title, url });
      setNativeShared(true);
      setTimeout(() => setNativeShared(false), 2200);
    } catch {
      /* annulé par l'utilisateur — ne rien afficher */
    }
  };
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Partager"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full sm:max-w-md bg-[#FAF6EF] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#8A8378]/15 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[#2A0E3D] text-[#FAF6EF] sm:rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#C9A227]" />
                <span className="text-sm uppercase tracking-[0.18em] font-bold text-[#C9A227]">
                  Partager
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-[#FAF6EF]/10 transition-colors"
                title="Fermer (Échap)"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fiche : miniature + titre (contexte de ce qu'on partage) */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#8A8378]/10">
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-[#8A8378]/15"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-[#2A0E3D]/5 flex items-center justify-center flex-shrink-0">
                  <Share2 className="w-6 h-6 text-[#C9A227]/60" />
                </div>
              )}
              <p className="text-sm font-bold text-[#1E0F2B] leading-snug line-clamp-3 break-words">
                {title}
              </p>
            </div>

            {/* Grille des plateformes — TOUTE la liste visible d'un coup */}
            <div className="px-4 py-4">
              <p className="text-xs font-bold text-[#8A8378] uppercase tracking-wider mb-3 px-1">
                Partager sur
              </p>
              <div className="grid grid-cols-3 gap-3">
                {platforms.map((p) => {
                  const Icon = p.icon;
                  return (
                    <a
                      key={p.name}
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 px-2 py-3 rounded-xl bg-white border border-[#8A8378]/15 hover:border-[#C9A227]/50 hover:bg-[#C9A227]/5 transition-colors"
                    >
                      <div className="w-11 h-11 rounded-full bg-[#2A0E3D]/5 flex items-center justify-center">
                        {Icon ? (
                          <Icon size={24} />
                        ) : (
                          <Mail className="w-6 h-6" style={{ color: p.color }} />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-[#1E0F2B]">{p.name}</span>
                    </a>
                  );
                })}
              </div>

              {/* Partage natif du device (mobile) — quand disponible */}
              {canNativeShare && (
                <button
                  onClick={handleNativeShare}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-[#8A8378]/15 hover:border-[#C9A227]/50 hover:bg-[#C9A227]/5 transition-colors"
                >
                  <Share2 className="w-4 h-4 text-[#C9A227]" />
                  <span className="text-sm font-semibold text-[#1E0F2B]">
                    {nativeShared ? "Partagé !" : "Autres applications…"}
                  </span>
                </button>
              )}

              {/* Copier le lien */}
              <button
                onClick={handleCopy}
                className={
                  "mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors " +
                  (copied
                    ? "bg-[#5B7052] text-white"
                    : "bg-[#2A0E3D] text-[#FAF6EF] hover:bg-[#3A1E4D]")
                }
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Lien copié !
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 text-[#C9A227]" />
                    Copier le lien
                  </>
                )}
              </button>

              {/* Aperçu discret du lien partagé (vérifiable d'un coup d'œil) */}
              <p className="mt-3 px-1 text-[11px] text-[#8A8378] break-all line-clamp-2">
                {url}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
