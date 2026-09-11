"use client";

/**
 * ⭐ V3.65 — Lecteur TikTok « VIDEO-FIRST » : la vidéo est GRANDE.
 *
 * RETOUR PASTEUR (capture V3.64) : « La largeur du lecteur TikTok est
 * trop petite » — mesure de la capture : embed affiché 298 px de large
 * centré dans un conteneur noir de 442 px (2 × ~72 px de bandes noires
 * mortes). CAUSE MATHÉMATIQUE : l'embed TikTok complet = vidéo 9:16
 * (578 px logiques) + légende/bouton (~200 px) soit 780 px de HAUT pour
 * 325 px de large ; plafonné à 78 vh il ne peut JAMAIS dépasser ~300 px
 * de large sur un écran portable — la contrainte de hauteur étranglait
 * la largeur.
 *
 * SOLUTION V3.65 :
 *  - VIDEO-FIRST : la zone VIDÉO (9:16, 578 px logiques) est dimensionnée
 *    au MAXIMUM de la place disponible — jusqu'à 486 px de large (la
 *    colonne lecteur de TikTok web) bornée par la hauteur du viewport
 *    (vh − 140 px, cap 960) et la largeur de la zone. Sur l'écran de la
 *    capture : 298 → 437 px (+47 %), et 486 px sur grand écran.
 *  - La légende TikTok (@auteur, musique, bouton « Regarder maintenant »)
 *    reste rendue DANS l'iframe mais sous la zone visible, clippée par
 *    overflow-hidden : la page affiche déjà TITRE + rubrique + actions
 *    sous le lecteur (les métadonnées de l'embed étaient redondantes).
 *  ⚠️ GARDE ANTI-SCROLLBAR conservée de V3.64 : l'iframe garde TOUJOURS
 *    sa hauteur LOGIQUE exacte (oEmbed par vidéo) → le contenu TikTok ne
 *    déborde JAMAIS de son iframe (zéro scrollbar interne, zéro reflow).
 *    Le clip est PUREMENT visuel (boîte), il ne redimensionne PAS le
 *    viewport de l'iframe.
 *  - REPLIS INTACTS : diaporamas /photo/ (embed complet, échelle
 *    uniforme V3.64 — les carrousels n'ont PAS de zone vidéo 9:16) et
 *    proxy oEmbed indisponible (502 → dimensionnement V3.64 prouvé).
 *  - Poster (vraie miniature R2) + preconnect + fondu enchaîné V3.64.
 *
 * Deux modes :
 *  - page (public /videos) : vidéo ≤ 486 px de large, ≤ min(vh−140, 960)
 *    de haut, lien « Ouvrir sur TikTok » ;
 *  - boîte (post-production) : la vidéo 9:16 remplit la zone d'aperçu
 *    portrait (420 × 747) de HAUT en bas — avant, la légende mangeait
 *    26 % de la hauteur et la vidéo n'occupait que 312 px de large.
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
// Zone VIDÉO de l'embed (9:16) : 325 × 578 logiques — c'est elle qu'on
// agrandit ; la légende sous les 578 px logiques est clippée.
const HAUTEUR_VIDEO_LOGIQUE = Math.round((LARGEUR_LOGIQUE * 16) / 9); // 578
const HAUTEUR_DEFAUT = 780; // 325×780 = taille iframe par défaut de TikTok
// Largeur maximale du lecteur en mode page : la colonne lecteur de
// TikTok web (~486 px). Au-delà, une vidéo verticale paraît démesurée.
const LARGEUR_MAX_PAGE = 486;

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
  // Proxy oEmbed en échec (502) → repli dimensionnement V3.64 complet.
  const [embedIndisponible, setEmbedIndisponible] = useState(false);
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
        if (annule) return;
        if (!d?.ok) {
          // 502 : TikTok injoignable — repli dimensionnement V3.64.
          setEmbedIndisponible(true);
          return;
        }
        if (d.hauteur && Number.isFinite(d.hauteur)) {
          setHauteur(Math.min(Math.max(d.hauteur, 580), 1500));
        }
        if (d.miniatureUrl) setPosterRepli(d.miniatureUrl);
      })
      .catch(() => {
        if (!annule) setEmbedIndisponible(true);
        /* repli : hauteur canonique 780, poster de marque */
      });
    return () => {
      annule = true;
    };
  }, [videoUrl]);

  // ② Mesure de la zone disponible (ResizeObserver + resize fenêtre
  // pour la contrainte de hauteur du mode page).
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

  // ③ Dimensionnement.
  // Diaporamas /photo/ : carrousel TikTok (PAS de zone vidéo 9:16) →
  // embed complet V3.64. Proxy en échec → idem (dimensionnement prouvé).
  const diaporama = !!videoUrl && videoUrl.includes("/photo/");
  const videoFirst = !diaporama && !embedIndisponible;

  let echelle: number;
  let largAffichee: number;
  let hautAffichee: number;

  if (videoFirst) {
    // ⭐ V3.65 VIDEO-FIRST : la ZONE VIDÉO (9:16) est la plus grande
    // possible dans la place disponible. La hauteur de l'iframe reste
    // logique-exacte (anti-scrollbar V3.64) ; sa partie « légende »
    // passe sous la boîte, clippée par overflow-hidden.
    const lMaxZone = boite
      ? (zone?.l ?? LARGEUR_LOGIQUE)
      : Math.min((zone?.l ?? LARGEUR_LOGIQUE) - 24, LARGEUR_MAX_PAGE);
    // vh − 140 : place pour la barre du haut + le titre + les actions ;
    // cap 960 pour rester maîtrisé sur très grands écrans.
    const hMaxZone = boite
      ? (zone?.h ?? HAUTEUR_VIDEO_LOGIQUE)
      : Math.min(hauteurFenetre - 140, 960);
    largAffichee = Math.max(180, Math.floor(Math.min(lMaxZone, (hMaxZone * 9) / 16)));
    echelle = largAffichee / LARGEUR_LOGIQUE;
    hautAffichee = Math.round(HAUTEUR_VIDEO_LOGIQUE * echelle);
  } else {
    // ⭐ V3.64 (replis) : embed COMPLET à l'échelle uniforme — vidéo +
    // légende + bouton entiers, garanti sans scrollbar ni texte tronqué.
    const lMax = boite
      ? (zone?.l ?? LARGEUR_LOGIQUE)
      : Math.min((zone?.l ?? LARGEUR_LOGIQUE) - 24, 425);
    const hMax = boite
      ? (zone?.h ?? HAUTEUR_DEFAUT)
      : Math.min(hauteurFenetre * 0.78, 820);
    echelle = Math.max(0.15, Math.min(lMax / LARGEUR_LOGIQUE, hMax / hauteur));
    largAffichee = Math.round(LARGEUR_LOGIQUE * echelle);
    hautAffichee = Math.round(hauteur * echelle);
  }

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
              mise à l'échelle uniforme — la page embed subit AUCUN reflow
              et AUCUN scrollbar interne (garde V3.64). En video-first, la
              boîte clippe SOUS la zone vidéo : la légende est rendue mais
              invisible — jamais coupée au milieu, jamais scrollable. */}
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
            pays, la vidéo reste atteignable en un clic. ⭐ V3.65 : en
            video-first la légende de l'embed est clippée — le lien donne
            aussi l'accès direct à la publication complète. */}
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
