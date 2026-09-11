"use client";

/**
 * ⭐ V3.64 — Lecteur TikTok à dimension EXACTE (site public + éditeur).
 *
 * PROBLÈMES RÉSOLUS (retours pasteur V3.63) :
 *  ① « Barre de scroll pour la vidéo TikTok même » + « textes tronqués » :
 *     la page embed/v2 de TikTok est PLUS HAUTE que la vidéo seule (vidéo
 *     9:16 + légende + bouton « Regarder maintenant » + @auteur). Forcer
 *     un conteneur 9:16 coupait le bas → scrollbar interne + textes
 *     tronqués. Ici l'iframe garde la TAILLE LOGIQUE de TikTok (325 ×
 *     hauteur-exacte issue de l'oEmbed, ex. 780) et est mise à l'échelle
 *     par transform uniforme → TOUT le contenu embed est visible,
 *     EXACTEMENT comme sur TikTok. Aucun redimensionnement du viewport
 *     de l'iframe = aucun reflow de la légende = aucun débordement.
 *  ② « La vidéo prend du temps avant de jouer » : l'embed TikTok charge
 *     quelques secondes de JS sur une boîte noire. Le POSTER (vraie
 *     miniature de la vidéo, R2 permanente) s'affiche INSTANTANÉMENT,
 *     l'iframe charge DERRIÈRE, un fondu enchaîné révèle le lecteur dès
 *     qu'il est prêt (onLoad) + preconnect TikTok.
 *
 * Deux modes :
 *  - page (public /videos) : largeur ≤ 425 px, hauteur ≤ 78 vh, lien
 *    « Ouvrir sur TikTok » ;
 *  - boîte (post-production) : remplit la zone d'aperçu (absolute
 *    inset-0) — l'éditeur ne tente PLUS de lire l'URL TikTok dans un
 *    <video> (le blocage « prend du temps avant de jouer »).
 */

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { urlEmbedTiktok } from "@/lib/tiktok";
import { TiktokNoteIcon } from "@/components/tiktok/tiktok-note-icon";

interface PropsLecteurTikTok {
  tiktokId: string;
  /** URL TikTok complète (pour l'oEmbed + le lien externe). */
  videoUrl?: string | null;
  titre: string;
  /** Miniature PERMANENTE (R2, via /api/tiktok/backfill) si présente. */
  miniature?: string | null;
  /** Mode boîte : remplit le parent (post-production). */
  boite?: boolean;
  /** Afficher le lien « Ouvrir sur TikTok » (mode page uniquement). */
  afficherLien?: boolean;
  /** Couleur d'accent du lien externe (mode page). */
  accent?: string;
}

// Dimensions logiques canoniques de l'embed TikTok.
const LARGEUR_LOGIQUE = 325;
const HAUTEUR_DEFAUT = 780; // 325×780 = taille iframe par défaut de TikTok

export function LecteurTikTok({
  tiktokId,
  videoUrl,
  titre,
  miniature,
  boite = false,
  afficherLien = true,
  accent = "#C9A227",
}: PropsLecteurTikTok) {
  // Hauteur d'embed EXACTE (oEmbed : vidéo + légende + bouton) — défaut
  // canonique en attendant la réponse (ou si le proxy est indisponible).
  const [hauteur, setHauteur] = useState(HAUTEUR_DEFAUT);
  // Poster : miniature permanente en priorité, oEmbed signée en repli.
  const [posterRepli, setPosterRepli] = useState<string | null>(null);
  const [posterEchoue, setPosterEchoue] = useState(false);
  // Fondu : l'iframe est-elle chargée ?
  const [prete, setPrete] = useState(false);

  const zoneRef = useRef<HTMLDivElement>(null);
  const [zone, setZone] = useState<{ l: number; h: number } | null>(null);
  const [hauteurFenetre, setHauteurFenetre] = useState(800);

  // ① Hauteur exacte + poster de repli depuis le proxy oEmbed (le fetch
  // sortant vers TikTok tourne SUR VERCEL — cf. /api/tiktok/oembed).
  useEffect(() => {
    if (!videoUrl) return;
    let annule = false;
    fetch(`/api/tiktok/oembed?url=${encodeURIComponent(videoUrl)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { ok?: boolean; hauteur?: number; miniatureUrl?: string }) => {
        if (annule || !d?.ok) return;
        if (d.hauteur && Number.isFinite(d.hauteur)) {
          setHauteur(Math.min(Math.max(d.hauteur, 580), 1500));
        }
        if (d.miniatureUrl) setPosterRepli(d.miniatureUrl);
      })
      .catch(() => {
        /* repli : hauteur canonique 780, poster de marque */
      });
    return () => {
      annule = true;
    };
  }, [videoUrl]);

  // ② Mesure de la zone disponible (ResizeObserver + resize fenêtre
  // pour la contrainte 78 vh du mode page).
  useEffect(() => {
    const el = zoneRef.current;
    const mesurer = () => {
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) setZone({ l: r.width, h: r.height });
      }
      setHauteurFenetre(window.innerHeight);
    };
    mesurer();
    window.addEventListener("resize", mesurer);
    let ro: ResizeObserver | null = null;
    if (el) {
      ro = new ResizeObserver(mesurer);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener("resize", mesurer);
      ro?.disconnect();
    };
  }, []);

  // ③ Échelle uniforme : la largeur ET la hauteur de l'embed logique
  // tiennent dans la zone disponible (mode page : hauteur ≤ 78 vh/820 px,
  // largeur ≤ 425 px hors padding de 24 px ; mode boîte : contraint par
  // la zone elle-même).
  const lMax = boite
    ? (zone?.l ?? LARGEUR_LOGIQUE)
    : Math.min((zone?.l ?? LARGEUR_LOGIQUE) - 24, 425);
  const hMax = boite
    ? (zone?.h ?? HAUTEUR_DEFAUT)
    : Math.min(hauteurFenetre * 0.78, 820);
  const echelle = Math.max(
    0.15,
    Math.min(lMax / LARGEUR_LOGIQUE, hMax / hauteur)
  );
  const largAffichee = Math.round(LARGEUR_LOGIQUE * echelle);
  const hautAffichee = Math.round(hauteur * echelle);

  const posterSrc = !posterEchoue ? (miniature || posterRepli) : null;

  return (
    <>
      {/* Preconnect : DNS + TLS de l'origine de l'iframe amorcés dès le
          rendu — le lecteur TikTok démarre ~200-400 ms plus tôt. */}
      <link rel="preconnect" href="https://www.tiktok.com" />
      <link rel="dns-prefetch" href="https://www.tiktokcdn.com" />

      <div
        ref={zoneRef}
        className={cn(
          boite
            ? "absolute inset-0 flex items-center justify-center overflow-hidden"
            : "relative flex w-full flex-col items-center py-4 px-3"
        )}
      >
        <div
          className="relative overflow-hidden rounded-lg bg-[#111118] ring-1 ring-white/10 shadow-inner"
          style={{ width: largAffichee, height: hautAffichee }}
        >
          {/* Iframe à la TAILLE LOGIQUE de TikTok (325 × hauteur exacte),
              mise à l'échelle uniforme — la page embed subit AUCUN reflow :
              légende et bouton entiers, zéro scrollbar. */}
          <iframe
            src={urlEmbedTiktok(tiktokId)}
            title={titre}
            width={LARGEUR_LOGIQUE}
            height={hauteur}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              // Petit délai : le shell de la page embed est chargé, on
              // laisse le player TikTok s'initialiser avant le fondu.
              window.setTimeout(() => setPrete(true), 350);
            }}
            className="absolute left-0 top-0 border-0 bg-black"
            style={{
              width: LARGEUR_LOGIQUE,
              height: hauteur,
              transform: `scale(${echelle})`,
              transformOrigin: "top left",
            }}
          />

          {/* Poster pendant le chargement de l'iframe : vraie miniature
              (R2) — repli image signée oEmbed — repli marque TikTok.
              Fondu enchaîné vers le lecteur (aucun écran noir vide). */}
          <div
            aria-hidden={prete}
            className={cn(
              "absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-[#0d0d16] transition-opacity duration-500",
              prete && "pointer-events-none opacity-0"
            )}
          >
            {posterSrc && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={posterSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setPosterEchoue(true)}
              />
            )}
            {posterSrc && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
            )}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C9A227]/95 text-[#1E0F2B] shadow-lg">
                <TiktokNoteIcon size={26} />
              </div>
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white/85" />
                <span className="text-[11px] font-semibold text-white/85">
                  Chargement du lecteur TikTok…
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lien externe (mode page) : si l'embed est indisponible dans un
            pays, la vidéo reste atteignable en un clic. */}
        {!boite && afficherLien && (
          <a
            href={
              videoUrl || `https://www.tiktok.com/@pamela.dali7/video/${tiktokId}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B] text-xs font-semibold transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" style={{ color: accent }} />
            Ouvrir sur TikTok
          </a>
        )}
      </div>
    </>
  );
}
