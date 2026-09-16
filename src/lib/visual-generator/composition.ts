/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : moteur de composition par zones (§18/§20).
 *
 * L'utilisateur ne gère AUCUNE coordonnée : le moteur calcule la
 * composition à partir de (format × variante) — chaque format a une
 * composition ADAPTÉE (paysage ≠ portrait ≠ carré, jamais un simple
 * redimensionnement) et chaque variante (A/B/C/D) propose une
 * composition différente (§7) :
 *
 *   A — classique : sujet à droite, texte à gauche ;
 *   B — miroir    : sujet à gauche, texte à droite ;
 *   C — centré    : sujet centré en bas, texte en haut ;
 *   D — cinématique : sujet dominant, voile profond, titre central.
 *
 * L'ADN graphique du template (polices, effets sujet, voile, dégradé)
 * modifie ces compositions — les couleurs passent par des jetons.
 *
 * Ordre des couches (§15) : fond → voile → vignette → sujet → textes → logo.
 *
 * ⚠️ SERVEUR UNIQUEMENT.
 */

import type { SKRSContext2D, Image } from "@napi-rs/canvas";
import {
  type CleVariante,
  type CleCalque,
  type ConfigLayout,
  type DonneesVisuel,
  type DefinitionFormat,
  type EffetsSujet,
  ORDRE_CALQUES_DEFAUT,
} from "./types";
import { BRAND, styleStudio } from "../studio/brand-tokens";
import {
  ajusterTexte,
  dessinerBloc,
  resoudreCouleur,
  type BlocAjuste,
} from "./typography";
import {
  dessinerSujetAvecEffets,
  dessinerVignette,
  dessinerVoile,
} from "./effects";

// ─── Structure interne d'une composition calculée ──────────────────────

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Composition {
  marge: number;
  logo: { coin: "tl" | "tr" | "tc" };
  sujet: Zone & { hAlign: "left" | "center" | "right"; vAlign: "top" | "center" | "bottom" } | null;
  headline: Zone & { align: "left" | "center" | "right" };
  sousTitre: Zone & { align: "left" | "center" | "right" };
  evenement: Zone & { align: "left" | "center" | "right" };
  verset: Zone & { align: "left" | "center" | "right" };
  voileInverse: boolean;
}

/** Zones de base par VARIANTE — famille PAYSAGE (fractions du canvas).
 *   A — classique : sujet à droite, texte à gauche ;
 *   B — miroir    : sujet à gauche, texte à droite ;
 *   C — centré    : texte en haut, sujet dominant en bas ;
 *   D — cinématique : sujet à droite, voile profond, titre vertical.
 * ⚠️ Zones texte et sujet SANS CHEVAUCHEMENT (leçon VLM : le texte ne
 * touche JAMAIS la photo — 1,5 % de recouvrement suffit à gâcher le
 * visuel) et marge basse ≥ 4,5 % (rognage mobile YouTube). */
function compositionPaysage(variante: CleVariante, m: number): Composition {
  const base: Composition = {
    marge: m,
    logo: { coin: "tl" },
    sujet: null,
    headline: { x: m, y: 0.15, w: 0.44, h: 0.42, align: "left" },
    sousTitre: { x: m, y: 0.60, w: 0.44, h: 0.12, align: "left" },
    evenement: { x: m, y: 0.74, w: 0.44, h: 0.13, align: "left" },
    verset: { x: m, y: 0.87, w: 0.44, h: 0.08, align: "left" },
    voileInverse: false,
  };
  switch (variante) {
    case "B":
      return {
        ...base,
        logo: { coin: "tr" },
        // Sujet à GAUCHE — texte à droite, sans chevauchement.
        sujet: { x: 0.0, y: 0.0, w: 0.44, h: 1.0, hAlign: "left", vAlign: "center" },
        headline: { x: 0.51, y: 0.15, w: 0.49 - m, h: 0.42, align: "right" },
        sousTitre: { x: 0.51, y: 0.60, w: 0.49 - m, h: 0.12, align: "right" },
        evenement: { x: 0.51, y: 0.74, w: 0.49 - m, h: 0.13, align: "right" },
        verset: { x: 0.51, y: 0.87, w: 0.49 - m, h: 0.08, align: "right" },
        voileInverse: true,
      };
    case "C":
      return {
        ...base,
        logo: { coin: "tr" },
        // Sujet DOMINANT centré-bas (leçon VLM : le visage occupe la
        // majorité de l'image, pas de zone morte en haut).
        sujet: { x: 0.19, y: 0.38, w: 0.62, h: 0.6, hAlign: "center", vAlign: "bottom" },
        // ⭐ Titre resserré (72 %) : force 2 lignes AVEC une police plus
        // grande — lisible en miniature 320 px (leçon VLM : une seule
        // ligne étirée paraît minuscule sur mobile).
        headline: { x: 0.14, y: 0.12, w: 0.72, h: 0.2, align: "center" },
        sousTitre: { x: m, y: 0.34, w: 1 - 2 * m, h: 0.07, align: "center" },
        evenement: { x: m, y: 0.84, w: 1 - 2 * m, h: 0.08, align: "center" },
        verset: { x: m, y: 0.915, w: 1 - 2 * m, h: 0.045, align: "center" },
      };
    case "D":
      return {
        ...base,
        logo: { coin: "tl" },
        sujet: { x: 0.62, y: 0.0, w: 0.38, h: 1.0, hAlign: "right", vAlign: "center" },
        headline: { x: m, y: 0.2, w: 0.54, h: 0.42, align: "left" },
        sousTitre: { x: m, y: 0.64, w: 0.54, h: 0.11, align: "left" },
        evenement: { x: m, y: 0.77, w: 0.54, h: 0.09, align: "left" },
        verset: { x: m, y: 0.875, w: 0.54, h: 0.05, align: "left" },
      };
    default: // A — classique : silhouette PLEINE hauteur à droite
      return {
        ...base,
        headline: { x: m, y: 0.15, w: 0.48, h: 0.42, align: "left" },
        sousTitre: { x: m, y: 0.6, w: 0.48, h: 0.12, align: "left" },
        evenement: { x: m, y: 0.74, w: 0.48, h: 0.13, align: "left" },
        verset: { x: m, y: 0.87, w: 0.48, h: 0.08, align: "left" },
        sujet: { x: 0.58, y: 0.0, w: 0.4, h: 1.0, hAlign: "right", vAlign: "center" },
      };
  }
}

/** Zones par VARIANTE — famille CARRÉ.
 *   A — classique : sujet à droite, texte à gauche ;
 *   B — miroir    : sujet à gauche, texte à droite ;
 *   C — centré    : titre haut, sujet dominant bas ;
 *   D — cinématique centré. */
function compositionCarre(variante: CleVariante, m: number): Composition {
  const base: Composition = {
    marge: m,
    logo: { coin: "tl" },
    sujet: null,
    headline: { x: m, y: 0.18, w: 0.4, h: 0.44, align: "left" },
    sousTitre: { x: m, y: 0.64, w: 0.4, h: 0.11, align: "left" },
    evenement: { x: m, y: 0.77, w: 0.4, h: 0.13, align: "left" },
    verset: { x: m, y: 0.9, w: 0.4, h: 0.06, align: "left" },
    voileInverse: false,
  };
  switch (variante) {
    case "B":
      return {
        ...base,
        logo: { coin: "tr" },
        sujet: { x: 0.0, y: 0.0, w: 0.46, h: 1.0, hAlign: "left", vAlign: "center" },
        headline: { x: 0.53, y: 0.18, w: 0.47 - m, h: 0.44, align: "right" },
        sousTitre: { x: 0.53, y: 0.64, w: 0.47 - m, h: 0.11, align: "right" },
        evenement: { x: 0.53, y: 0.77, w: 0.47 - m, h: 0.13, align: "right" },
        verset: { x: 0.53, y: 0.9, w: 0.47 - m, h: 0.06, align: "right" },
        voileInverse: true,
      };
    case "C":
      return {
        ...base,
        logo: { coin: "tl" },
        headline: { x: m, y: 0.09, w: 1 - 2 * m, h: 0.22, align: "center" },
        sousTitre: { x: m, y: 0.33, w: 1 - 2 * m, h: 0.08, align: "center" },
        sujet: { x: 0.16, y: 0.43, w: 0.68, h: 0.53, hAlign: "center", vAlign: "bottom" },
        evenement: { x: m, y: 0.84, w: 1 - 2 * m, h: 0.09, align: "center" },
        verset: { x: m, y: 0.92, w: 1 - 2 * m, h: 0.045, align: "center" },
      };
    case "D":
      return {
        ...base,
        logo: { coin: "tc" },
        sujet: { x: 0.08, y: 0.14, w: 0.84, h: 0.6, hAlign: "center", vAlign: "bottom" },
        headline: { x: m, y: 0.68, w: 1 - 2 * m, h: 0.19, align: "center" },
        sousTitre: { x: m, y: 0.88, w: 1 - 2 * m, h: 0.07, align: "center" },
        evenement: { x: m, y: 0.88, w: 1 - 2 * m, h: 0.07, align: "center" },
        verset: { x: m, y: 0.93, w: 1 - 2 * m, h: 0.04, align: "center" },
      };
    default: // A — classique
      return {
        ...base,
        sujet: { x: 0.54, y: 0.0, w: 0.46, h: 1.0, hAlign: "right", vAlign: "center" },
      };
  }
}

/** Zones par VARIANTE — famille PORTRAIT (story/reels/instagram/A4).
 *   A — affiche classique : titre haut, sujet centre, infos bas ;
 *   B — photo pleine largeur en HAUT, textes en dessous (voile bas) ;
 *   C — titre HAUT, sujet centre-bas, infos en bandeau ;
 *   D — cinématique : sujet dominant centre, voile profond, titre au
 *        nombre d'or. */
function compositionPortrait(variante: CleVariante, m: number): Composition {
  const base: Composition = {
    marge: m,
    logo: { coin: "tc" },
    sujet: null,
    headline: { x: 0.06, y: 0.11, w: 0.88, h: 0.17, align: "center" },
    sousTitre: { x: 0.08, y: 0.29, w: 0.84, h: 0.05, align: "center" },
    evenement: { x: 0.1, y: 0.75, w: 0.8, h: 0.12, align: "center" },
    verset: { x: 0.1, y: 0.9, w: 0.8, h: 0.05, align: "center" },
    voileInverse: false,
  };
  switch (variante) {
    case "B":
      return {
        ...base,
        logo: { coin: "tl" },
        sujet: { x: 0.0, y: 0.05, w: 1, h: 0.48, hAlign: "center", vAlign: "top" },
        headline: { x: 0.06, y: 0.57, w: 0.88, h: 0.14, align: "center" },
        sousTitre: { x: 0.08, y: 0.72, w: 0.84, h: 0.05, align: "center" },
        evenement: { x: 0.1, y: 0.79, w: 0.8, h: 0.11, align: "center" },
        verset: { x: 0.1, y: 0.92, w: 0.8, h: 0.05, align: "center" },
      };
    case "C":
      return {
        ...base,
        logo: { coin: "tl" },
        headline: { x: 0.06, y: 0.08, w: 0.88, h: 0.15, align: "center" },
        sujet: { x: 0.06, y: 0.28, w: 0.88, h: 0.5, hAlign: "center", vAlign: "bottom" },
        sousTitre: { x: 0.08, y: 0.8, w: 0.84, h: 0.05, align: "center" },
        evenement: { x: 0.1, y: 0.86, w: 0.8, h: 0.09, align: "center" },
        verset: { x: 0.1, y: 0.93, w: 0.8, h: 0.04, align: "center" },
      };
    case "D":
      return {
        ...base,
        logo: { coin: "tc" },
        sujet: { x: 0.0, y: 0.14, w: 1, h: 0.72, hAlign: "center", vAlign: "center" },
        headline: { x: 0.06, y: 0.42, w: 0.88, h: 0.15, align: "center" },
        sousTitre: { x: 0.08, y: 0.58, w: 0.84, h: 0.05, align: "center" },
        evenement: { x: 0.1, y: 0.78, w: 0.8, h: 0.11, align: "center" },
        verset: { x: 0.1, y: 0.9, w: 0.8, h: 0.05, align: "center" },
      };
    default: // A — affiche classique : titre haut, sujet GRAND centre, infos bas
      return {
        ...base,
        // ⭐ Leçon VLM : la photo doit DOMINER l'affiche (42 % de hauteur,
        // 90 % de largeur) — le nom et les infos s'organisent dessous.
        headline: { x: 0.06, y: 0.1, w: 0.88, h: 0.15, align: "center" },
        sujet: { x: 0.05, y: 0.27, w: 0.9, h: 0.42, hAlign: "center", vAlign: "center" },
        sousTitre: { x: 0.08, y: 0.71, w: 0.84, h: 0.05, align: "center" },
        evenement: { x: 0.1, y: 0.78, w: 0.8, h: 0.11, align: "center" },
        verset: { x: 0.1, y: 0.91, w: 0.8, h: 0.05, align: "center" },
      };
  }
}

// ─── Fond généré par le style (quand aucun background n'est choisi) ────

/** Dessine un fond procédural premium : dégradé profond + lumière d'accent. */
function dessinerFondStyle(
  ctx: SKRSContext2D,
  W: number,
  H: number,
  cleStyle: string,
  palettePerso?: { accent?: string; secondary?: string; background?: string }
): void {
  const style = styleStudio(cleStyle, palettePerso);
  const b = BRAND.colors;

  // Dégradé vertical profond (noir → couleur de fond du style).
  const fond = ctx.createLinearGradient(0, 0, W * 0.35, H);
  fond.addColorStop(0, b.black);
  fond.addColorStop(1, style.background);
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, W, H);

  // Halo lumineux d'accent discret (tier supérieure droite).
  const rayon = Math.max(W, H) * 0.75;
  const halo = ctx.createRadialGradient(
    W * 0.78,
    H * 0.22,
    rayon * 0.05,
    W * 0.78,
    H * 0.22,
    rayon
  );
  halo.addColorStop(0, `${style.accent}2E`);
  halo.addColorStop(0.5, `${style.accent}14`);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Rayures lumineuses diagonales très subtiles (texture premium, pas de
  // surcharge — §3 éviter les effets excessifs).
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = style.accent;
  ctx.lineWidth = Math.max(1, W * 0.0012);
  for (let i = -H; i < W + H; i += W * 0.06) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H * 0.45, H);
    ctx.stroke();
  }
  ctx.restore();
}

/** ⭐ V3.90 — Dessine le GROUPE de sujets (une photo par intervenant).
 *
 * Une photo : comportement historique (zone entière, mode selon le
 * détourage). Plusieurs photos : colonnes chevauchantes — la première
 * démarre au bord de la zone, la dernière la termine exactement, les
 * silhouettes se touchent légèrement comme sur un vrai montage de
 * groupe (Canva-like). Chaque photo garde SES effets et SON mode
 * (silhouette détourée → contain, photo opaque → cover).
 */
function dessinerGroupeSujets(
  ctx: SKRSContext2D,
  images: Image[],
  zone: { x: number; y: number; w: number; h: number },
  hAlign: "left" | "center" | "right",
  vAlign: "top" | "center" | "bottom",
  effets: EffetsSujet,
  cleStyle: string,
  donnees: DonneesVisuel
): void {
  if (!images.length) return;

  const decoupeeDe = (i: number): boolean => {
    const explicite = donnees.photosSujet?.[i]?.decoupee;
    if (typeof explicite === "boolean") return explicite;
    return Boolean(donnees.photoDecoupee);
  };

  // Une seule photo : rendu historique plein zone.
  if (images.length === 1) {
    dessinerSujetAvecEffets(
      ctx,
      images[0],
      zone,
      hAlign,
      vAlign,
      effets,
      cleStyle,
      decoupeeDe(0) ? "contain" : "cover",
      donnees.palettePerso
    );
    return;
  }

  // Groupe : colonnes chevauchantes (14 % de la colonne).
  const n = images.length;
  const colonne = zone.w / n;
  const largeur = colonne * 1.14;
  const pas = (zone.w - largeur) / (n - 1);
  for (let i = 0; i < n; i++) {
    dessinerSujetAvecEffets(
      ctx,
      images[i],
      {
        x: zone.x + i * pas,
        y: zone.y,
        w: largeur,
        h: zone.h,
      },
      "center",
      vAlign,
      effets,
      cleStyle,
      decoupeeDe(i) ? "contain" : "cover",
      donnees.palettePerso
    );
  }
}

/** Dessine le logo dans son coin (jamais déformé, marge de sécurité §22). */
function dessinerLogo(
  ctx: SKRSContext2D,
  logo: Image,
  coin: "tl" | "tr" | "tc",
  W: number,
  H: number,
  marge: number,
  famille: "paysage" | "portrait" | "carre"
): void {
  // ⭐ Leçon VLM : en paysage, le logo doit rester visible en petit format
  // (YouTube mobile) — hauteur relative augmentée.
  const hLogo = H * (famille === "paysage" ? 0.095 : BRAND.logo.heightRatio);
  const ratio = logo.width / logo.height;
  const wLogo = hLogo * ratio;
  const espace = hLogo * BRAND.logo.clearSpace;
  const x = marge * W + espace;
  let y = marge * H + espace;
  let dx = x;
  if (coin === "tr") dx = W - marge * W - wLogo - espace;
  else if (coin === "tc") dx = (W - wLogo) / 2;
  if (coin === "tc") y = marge * H * 0.6;
  ctx.drawImage(logo, dx, y, wLogo, hLogo);
}

// ─── Composition principale ───────────────────────────────────────────

export interface AssetsComposition {
  fond?: Image | null;
  /** ⭐ V3.90 — une image PAR intervenant (2-4) : dessinées côte à côte
   *  dans la zone sujet ; un tableau vide = aucun sujet. */
  sujets?: Array<Image | null>;
  logo: Image | null;
}

/** Dessine la composition complète sur le contexte (canvas déjà dimensionné). */
export function composer(
  ctx: SKRSContext2D,
  donnees: DonneesVisuel,
  layout: ConfigLayout,
  format: DefinitionFormat,
  variante: CleVariante,
  assets: AssetsComposition
): void {
  const W = format.largeur;
  const H = format.hauteur;
  const marge = BRAND.safeMargin;
  const style = styleStudio(donnees.style, donnees.palettePerso);

  // Composition selon la famille du format.
  const familles = {
    paysage: compositionPaysage,
    portrait: compositionPortrait,
    carre: compositionCarre,
  } as const;
  let comp = familles[format.famille](variante, marge);

  // Overrides du template par famille (§19 — un template PEUT affiner).
  const override =
    layout.overrides?.[
      format.famille as "paysage" | "portrait" | "carre"
    ];
  const layoutFinal: ConfigLayout = override
    ? { ...layout, ...override, sujet: { ...layout.sujet, ...(override.sujet || {}) }, voile: { ...layout.voile, ...(override.voile || {}) } }
    : layout;

  // ⭐ V3.91 — SYSTÈME DE CALQUES : chaque élément est un calque nommé,
  // dessiné dans l'ORDRE choisi (le premier est DESSOUS), masquable (œil)
  // et ajustable finement (décalage relatif glissé dans le canvas).
  // RÉTROCOMPATIBLE : sans `donnees.calques`, l'ordre historique
  // ① fond → ② voile → ④ sujets → ⑤ textes → ⑥ logo est conservé À
  // L'IDENTIQUE (directive : jamais de changement de rendu silencieux).

  // ⑤ TEXTES (auto-fit obligatoire — §21).
  const echelle = format.famille === "paysage" ? H : W;
  const facteurTaille = layoutFinal.tailleTitre ?? 1;

  const imagesSujets = (assets.sujets || []).filter(
    (img): img is Image => Boolean(img)
  );

  /** Les calques, dans leur ordre de dessin historique (défaut). */
  const calques: Record<CleCalque, () => void> = {
    fond: () => {
      if (assets.fond) {
        // Cover : remplit tout le canvas sans déformation, recentré sur le visage
        // (centre-haut pour les portraits photografiques).
        const img = assets.fond;
        const ratioImg = img.width / img.height;
        const ratioCanvas = W / H;
        let dw: number, dh: number, dx: number, dy: number;
        if (ratioImg > ratioCanvas) {
          dh = H;
          dw = dh * ratioImg;
          dx = (W - dw) / 2;
          dy = 0;
        } else {
          dw = W;
          dh = dw / ratioImg;
          dx = 0;
          dy = (H - dh) * 0.35; // privilégie le haut du fond
        }
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        dessinerFondStyle(ctx, W, H, donnees.style, donnees.palettePerso);
      }
    },

    voile: () => {
      // ② VOILE de lisibilité (§15) — inversé pour la variante miroir B.
      if (comp.voileInverse && layoutFinal.voile.type === "cote") {
        ctx.save();
        const noir = BRAND.colors.black;
        const i = Math.min(1, layoutFinal.voile.intensite);
        const grad = ctx.createLinearGradient(W, 0, 0, 0);
        grad.addColorStop(0, `${noir}${Math.round(i * 215).toString(16).padStart(2, "0")}`);
        grad.addColorStop(0.62, `${noir}${Math.round(i * 110).toString(16).padStart(2, "0")}`);
        grad.addColorStop(1, "rgba(5,5,5,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      } else {
        dessinerVoile(ctx, W, H, layoutFinal.voile);
      }
      // ③ VIGNETTE discrète (traitement du voile — suit le calque).
      dessinerVignette(ctx, W, H, 0.55);
    },

    sujet: () => {
      // ④ SUJETS (photos des intervenants — V3.90 : plusieurs possibles)
      //    mode « cover » pour une photo OPAQUE, « contain » pour un PNG
      //    détouré (silhouette). Une seule photo = comportement historique.
      if (imagesSujets.length && comp.sujet) {
        dessinerGroupeSujets(
          ctx,
          imagesSujets,
          {
            x: comp.sujet.x * W,
            y: comp.sujet.y * H,
            w: comp.sujet.w * W,
            h: comp.sujet.h * H,
          },
          comp.sujet.hAlign,
          comp.sujet.vAlign,
          layoutFinal.sujet,
          donnees.style,
          donnees
        );
      }
    },

    titre: () => {
      // Headline — accroche (miniature) ou titre (affiche).
      const texteTitre =
        donnees.type === "miniature"
          ? donnees.accroche?.trim() || donnees.titre
          : donnees.titre;
      if (texteTitre?.trim()) {
        const zoneH = {
          x: comp.headline.x * W,
          y: comp.headline.y * H,
          w: comp.headline.w * W,
          h: comp.headline.h * H,
        };
        const tailleInitiale =
          format.famille === "paysage" ? 0.105 * H : format.famille === "carre" ? 0.092 * W : 0.068 * W;
        const bloc: BlocAjuste = ajusterTexte(
          ctx,
          texteTitre,
          { w: zoneH.w, h: zoneH.h },
          {
            police: layoutFinal.policeTitre,
            taillePx: tailleInitiale * facteurTaille,
            interligne: 1.06,
            espacement: layoutFinal.policeTitre === "anton" ? 0.005 : 0.01,
            couleur: "accent",
            couleurMotsCles: "accent",
            majuscules: true,
          },
          { maxMotsCles: 2 }
        );
        dessinerBloc(
          ctx,
          bloc,
          layoutFinal.policeTitre,
          zoneH.x,
          zoneH.y,
          zoneH.w,
          comp.headline.align,
          {
            interligne: 1.06,
            couleur: resoudreCouleur("secondary", donnees.style, donnees.palettePerso),
            couleurMotsCles: resoudreCouleur("accent", donnees.style, donnees.palettePerso),
            ombre: { flou: echelle * 0.018, couleur: "rgba(0,0,0,0.85)", dy: echelle * 0.006 },
            contour: { largeur: echelle * 0.0035, couleur: "rgba(0,0,0,0.9)" },
            degradeOr: layoutFinal.degradeTitre && estStyleDore(donnees.style),
          }
        );
      }
    },

    sousTitre: () => {
      const texteSousTitre = donnees.sousTitre?.trim() || nomIntervenant(donnees);
      if (texteSousTitre) {
        const zoneS = {
          x: comp.sousTitre.x * W,
          y: comp.sousTitre.y * H,
          w: comp.sousTitre.w * W,
          h: comp.sousTitre.h * H,
        };
        const bloc = ajusterTexte(
          ctx,
          texteSousTitre,
          { w: zoneS.w, h: zoneS.h },
          {
            police: layoutFinal.policeSousTitre,
            taillePx: (format.famille === "paysage" ? 0.042 * H : 0.03 * W) * facteurTaille,
            interligne: 1.15,
            espacement: 0.045,
            couleur: "secondary",
            majuscules: true,
          },
          { maxMotsCles: 0 }
        );
        dessinerBloc(
          ctx,
          bloc,
          layoutFinal.policeSousTitre,
          zoneS.x,
          zoneS.y,
          zoneS.w,
          comp.sousTitre.align,
          {
            interligne: 1.15,
            couleur: resoudreCouleur("secondary", donnees.style, donnees.palettePerso),
            // ⭐ Leçon VLM : le nom doit rester lisible sur TOUT fond (même un
            // mur blanc) — contour sombre net + ombre forte, TOUJOURS.
            contour: { largeur: echelle * 0.0055, couleur: "rgba(5,5,5,0.92)" },
            ombre: { flou: echelle * 0.014, couleur: "rgba(0,0,0,0.9)", dy: echelle * 0.005 },
          }
        );
      }
    },

    evenement: () => {
      // Bloc événementiel (affiches — date, heure, lieu).
      if (donnees.type !== "affiche") return;
      const lignesEvenement = construireLignesEvenement(donnees);
      if (lignesEvenement.length) {
        const zoneE = {
          x: comp.evenement.x * W,
          y: comp.evenement.y * H,
          w: comp.evenement.w * W,
          h: comp.evenement.h * H,
        };
        const tailleLigne =
          (format.famille === "paysage" ? 0.032 * H : 0.03 * W) * facteurTaille;
        ctx.save();
        ctx.textBaseline = "top";
        lignesEvenement.forEach((ligne, i) => {
          const bloc = ajusterTexte(
            ctx,
            ligne.texte,
            { w: zoneE.w, h: tailleLigne * 1.5 },
            {
              police: i === 0 ? layoutFinal.policeSousTitre : "inter-400",
              taillePx: tailleLigne * (i === 0 ? 1.18 : 1),
              interligne: 1.25,
              espacement: i === 0 ? 0.05 : 0.02,
              couleur: i === 0 ? "accent" : "white",
              majuscules: i === 0,
            },
            { maxMotsCles: 0 }
          );
          dessinerBloc(
            ctx,
            bloc,
            i === 0 ? layoutFinal.policeSousTitre : "inter-400",
            zoneE.x,
            zoneE.y + i * tailleLigne * 1.6,
            zoneE.w,
            comp.evenement.align,
            {
              interligne: 1.25,
              couleur:
                i === 0
                  ? resoudreCouleur("accent", donnees.style, donnees.palettePerso)
                  : resoudreCouleur("white", donnees.style, donnees.palettePerso),
              ombre: { flou: echelle * 0.008, couleur: "rgba(0,0,0,0.75)", dy: echelle * 0.003 },
            }
          );
        });
        ctx.restore();
      }
    },

    verset: () => {
      // Verset biblique (affiches).
      if (donnees.type !== "affiche") return;
      if (donnees.verset?.trim()) {
        const zoneV = {
          x: comp.verset.x * W,
          y: comp.verset.y * H,
          w: comp.verset.w * W,
          h: comp.verset.h * H,
        };
        const bloc = ajusterTexte(
          ctx,
          `« ${donnees.verset.trim()} »`,
          { w: zoneV.w, h: zoneV.h },
          {
            police: "inter-400",
            taillePx: (format.famille === "paysage" ? 0.024 * H : 0.021 * W) * facteurTaille,
            interligne: 1.3,
            espacement: 0.03,
            couleur: "goldLight",
            majuscules: false,
          },
          { maxMotsCles: 0 }
        );
        dessinerBloc(
          ctx,
          bloc,
          "inter-400",
          zoneV.x,
          zoneV.y,
          zoneV.w,
          comp.verset.align,
          {
            interligne: 1.3,
            couleur: resoudreCouleur("goldLight", donnees.style, donnees.palettePerso),
            ombre: { flou: echelle * 0.008, couleur: "rgba(0,0,0,0.75)", dy: echelle * 0.003 },
          }
        );
      }
    },

    logo: () => {
      // ⑥ LOGO — jamais déformé (§22).
      if (assets.logo) {
        dessinerLogo(ctx, assets.logo, comp.logo.coin, W, H, marge, format.famille);
      }
    },
  };

  // Ordre effectif : celui choisi par l'utilisateur, complété par le défaut
  // (les calques manquants restent dessinés en fin, ordre historique).
  const reglages = donnees.calques;
  const ordreEffectif: CleCalque[] = [
    ...(reglages?.ordre || []),
    ...ORDRE_CALQUES_DEFAUT.filter((c) => !(reglages?.ordre || []).includes(c)),
  ];
  const masques = new Set(reglages?.masques || []);

  for (const cle of ordreEffectif) {
    if (masques.has(cle)) continue;
    const decalage = reglages?.decalages?.[cle];
    const dessiner = calques[cle];
    if (!dessiner) continue;
    if (
      decalage &&
      (Math.abs(decalage.x) > 0.0001 || Math.abs(decalage.y) > 0.0001)
    ) {
      ctx.save();
      ctx.translate(
        Math.max(-0.3, Math.min(0.3, decalage.x)) * W,
        Math.max(-0.3, Math.min(0.3, decalage.y)) * H
      );
      dessiner();
      ctx.restore();
    } else {
      dessiner();
    }
  }
  void style;
}

/** Le style utilise-t-il une palette dorée (dégradé or pertinent) ? */
function estStyleDore(cleStyle: string): boolean {
  return ["noir-or", "royal", "predication", "temoignage", "cinematique"].includes(
    cleStyle
  );
}

/** Nom d'affichage de l'intervenant. */
function nomIntervenant(donnees: DonneesVisuel): string {
  // ⭐ V3.90 — noms libres : priorité aux noms saisis (éditables,
  // illimités) sur l'ancienne énumeration figée.
  if (donnees.speakerNames?.length) {
    const noms = donnees.speakerNames
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (noms.length) return noms.join(" & ");
  }
  switch (donnees.intervenant) {
    case "kongo":
      return "Pasteur Kongo";
    case "pam":
      return "Pam";
    case "kongo-pam":
      return "Pasteur Kongo & Pam";
    default:
      return donnees.sousTitre?.trim() || "";
  }
}

/** Lignes du bloc événementiel : [date+heure, lieu]. */
function construireLignesEvenement(donnees: DonneesVisuel): { texte: string; i: number }[] {
  const lignes: { texte: string; i: number }[] = [];
  const dateFormatee = formaterDateEvenement(donnees.dateEvenement);
  const partieDateHeure = [dateFormatee, donnees.heureEvenement?.trim()]
    .filter(Boolean)
    .join(" — ");
  if (partieDateHeure) lignes.push({ texte: partieDateHeure, i: 0 });
  if (donnees.lieuEvenement?.trim()) {
    lignes.push({ texte: donnees.lieuEvenement.trim(), i: 1 });
  }
  return lignes;
}

/** « 2026-10-18 » → « 18 OCTOBRE 2026 » (français, majuscules). */
function formaterDateEvenement(dateIso?: string): string {
  if (!dateIso) return "";
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d
    .toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toLocaleUpperCase("fr-FR");
}
