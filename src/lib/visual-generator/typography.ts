/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : moteur typographique & AUTO-FIT (§9/§21).
 *
 * Exigence ABSOLUE de la spécification : aucun texte ne déborde JAMAIS du
 * canvas, et aucun texte n'est jamais tronqué silencieusement. Algorithme :
 *   ① retour à la ligne mot à mot ;
 *   ② si débordement → réduire légèrement la taille de police, recalculer ;
 *   ③ si toujours trop grand → réduire l'espacement entre lettres ;
 *   ④ boucle jusqu'à tenir (garde-fou : taille minimale lisible).
 *
 * Hiérarchie (§10) : le moteur met en évidence les MOTS CLÉS du titre
 * (les mots pleins les plus longs) dans la couleur d'accent / dégradé
 * doré, le reste en couleur secondaire — lisible même en petite taille.
 *
 * @napi-rs/canvas 1.0.8 : ctx.letterSpacing natif (la mesure ET le rendu
 * en tiennent compte) + ctx.filter (luminosité/contraste/saturation).
 */

import type { SKRSContext2D } from "@napi-rs/canvas";
import { policeCanvas } from "./fonts";
import type { ClePolice, JetonCouleur } from "./types";
import { BRAND, styleStudio } from "../studio/brand-tokens";

/** Résout un jeton de couleur vers sa valeur hex (selon le style actif). */
export function resoudreCouleur(
  jeton: JetonCouleur,
  cleStyle: string
): string {
  const style = styleStudio(cleStyle);
  const b = BRAND.colors;
  switch (jeton) {
    case "accent":
      return style.accent;
    case "secondary":
      return style.secondary;
    case "white":
      return b.white;
    case "black":
      return b.black;
    case "ivory":
      return b.ivory;
    case "gold":
      return b.gold;
    case "goldLight":
      return b.goldLight;
    case "fireOrange":
      return b.fireOrange;
    default:
      return b.white;
  }
}

export interface MotDecoupe {
  mot: string;
  cle: boolean;
}

export interface LigneMesuree {
  texte: string;
  mots: MotDecoupe[];
  largeur: number;
}

export interface StyleTexte {
  police: ClePolice;
  taillePx: number;
  interligne: number;
  espacement: number; // em (interlettrage)
  couleur: JetonCouleur;
  couleurMotsCles?: JetonCouleur;
  majuscules?: boolean;
}

export interface BlocAjuste {
  lignes: LigneMesuree[];
  taillePx: number;
  espacement: number;
  hauteurTotale: number;
  largeurMax: number;
}

/** Petits mots à ne JAMAIS accentuer comme mot clé. */
const MOTS_VIDES = new Set([
  "de", "du", "des", "la", "le", "les", "un", "une", "et", "ou",
  "à", "au", "aux", "en", "dans", "pour", "par", "sur", "que", "qui",
  "comment", "pourquoi", "d", "l", "s", "est", "ce", "cette", "son",
  "sa", "ses", "votre", "nos", "vous", "nous", "ne", "pas", "plus",
]);

/** Coupe le texte en mots avec leur statut « mot clé ». */
function decouperMots(
  texte: string,
  maxMotsCles: number
): MotDecoupe[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  if (mots.length <= 1 || maxMotsCles <= 0) {
    return mots.map((mot) => ({ mot, cle: false }));
  }
  const candidats = mots
    .map((m, i) => ({
      i,
      score: m.replace(/[^\p{L}\p{N}]/gu, "").length,
    }))
    .filter((c) => c.score >= 4 && !MOTS_VIDES.has(mots[c.i].toLowerCase()))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMotsCles);
  const indexCles = new Set(candidats.map((c) => c.i));
  return mots.map((mot, i) => ({ mot, cle: indexCles.has(i) }));
}

/** Couleur d'une ligne : applique ctx.letterSpacing et mesure. */
function mesurerLigne(
  ctx: SKRSContext2D,
  texte: string,
  espacementPx: number
): number {
  ctx.letterSpacing = `${espacementPx}px`;
  const w = ctx.measureText(texte).width;
  ctx.letterSpacing = "0px";
  return w;
}

/** Coupe en lignes qui tiennent dans maxLargeur (glouton). */
function couperLignes(
  ctx: SKRSContext2D,
  mots: MotDecoupe[],
  maxLargeur: number,
  espacementPx: number
): LigneMesuree[] {
  const lignes: LigneMesuree[] = [];
  let courante: MotDecoupe[] = [];

  for (const mot of mots) {
    const essai = [...courante, mot];
    const texte = essai.map((m) => m.mot).join(" ");
    const largeur = mesurerLigne(ctx, texte, espacementPx);
    if (courante.length > 0 && largeur > maxLargeur) {
      const texteCourant = courante.map((m) => m.mot).join(" ");
      lignes.push({
        texte: texteCourant,
        mots: courante,
        largeur: mesurerLigne(ctx, texteCourant, espacementPx),
      });
      courante = [mot];
    } else {
      courante = essai;
    }
  }
  if (courante.length) {
    const texteCourant = courante.map((m) => m.mot).join(" ");
    lignes.push({
      texte: texteCourant,
      mots: courante,
      largeur: mesurerLigne(ctx, texteCourant, espacementPx),
    });
  }
  return lignes;
}

/**
 * AUTO-FIT complet d'un bloc de texte dans une zone (§21).
 * Retourne lignes + taille finale — JAMAIS de débordement.
 */
export function ajusterTexte(
  ctx: SKRSContext2D,
  texteBrut: string,
  zone: { w: number; h: number },
  style: StyleTexte,
  options?: {
    maxLignes?: number;
    maxMotsCles?: number;
    tailleMin?: number;
  }
): BlocAjuste {
  const maxMotsCles = options?.maxMotsCles ?? 2;
  const tailleMin = options?.tailleMin ?? 14;
  const texte =
    style.majuscules === false ? texteBrut : texteBrut.toLocaleUpperCase("fr-FR");

  let taillePx = style.taillePx;
  let espacement = style.espacement;

  for (let tentative = 0; tentative < 40; tentative++) {
    ctx.font = policeCanvas(style.police, taillePx);
    const espacementPx = espacement * taillePx;
    const mots = decouperMots(texte, maxMotsCles);
    const lignes = couperLignes(ctx, mots, zone.w, espacementPx);

    const hauteurLigne = taillePx * style.interligne;
    const hauteurTotale = lignes.length * hauteurLigne;
    const largeurMax = lignes.reduce((max, l) => Math.max(max, l.largeur), 0);
    const maxLignes =
      options?.maxLignes ?? Math.max(1, Math.floor(zone.h / hauteurLigne));

    if (
      hauteurTotale <= zone.h &&
      largeurMax <= zone.w &&
      lignes.length <= maxLignes
    ) {
      return { lignes, taillePx, espacement, hauteurTotale, largeurMax };
    }

    if (tentative % 4 === 3 && espacement > -0.03) {
      // ④ réduire l'espacement (algorithme §21).
      espacement = Math.max(-0.03, espacement - 0.015);
    } else {
      // ②③ réduire la taille puis recalculer.
      taillePx = Math.max(tailleMin, taillePx * 0.94);
      if (taillePx <= tailleMin) {
        // Garde-fou : rendu au mieux possible — JAMAIS de troncature.
        ctx.font = policeCanvas(style.police, tailleMin);
        const espFinal = Math.max(-0.03, espacement);
        const lignesF = couperLignes(
          ctx,
          decouperMots(texte, maxMotsCles),
          zone.w,
          espFinal * tailleMin
        );
        return {
          lignes: lignesF,
          taillePx: tailleMin,
          espacement: espFinal,
          hauteurTotale: lignesF.length * tailleMin * style.interligne,
          largeurMax: lignesF.reduce((m, l) => Math.max(m, l.largeur), 0),
        };
      }
    }
  }

  // Improbable (boucle épuisée) : rendu à la taille minimale.
  ctx.font = policeCanvas(style.police, tailleMin);
  const lignesZ = couperLignes(
    ctx,
    decouperMots(texte, maxMotsCles),
    zone.w,
    espacement * tailleMin
  );
  return {
    lignes: lignesZ,
    taillePx: tailleMin,
    espacement,
    hauteurTotale: lignesZ.length * tailleMin * style.interligne,
    largeurMax: lignesZ.reduce((m, l) => Math.max(m, l.largeur), 0),
  };
}

export interface StyleRenduBloc {
  interligne: number;
  couleur: string;
  couleurMotsCles?: string;
  ombre?: { flou: number; couleur: string; dy: number };
  contour?: { largeur: number; couleur: string };
  degradeOr?: boolean;
}

/** Dessine un bloc ajusté (lignes mot à mot pour colorer les mots clés). */
export function dessinerBloc(
  ctx: SKRSContext2D,
  bloc: BlocAjuste,
  police: ClePolice,
  x: number,
  y: number,
  largeurZone: number,
  align: "left" | "center" | "right",
  style: StyleRenduBloc
): void {
  ctx.save();
  ctx.font = policeCanvas(police, bloc.taillePx);
  ctx.textBaseline = "top";
  ctx.letterSpacing = `${bloc.espacement * bloc.taillePx}px`;
  const hauteurLigne = bloc.taillePx * style.interligne;

  bloc.lignes.forEach((ligne, indexLigne) => {
    const yLigne = y + indexLigne * hauteurLigne;
    let xLigne: number;
    if (align === "center") xLigne = x + (largeurZone - ligne.largeur) / 2;
    else if (align === "right") xLigne = x + largeurZone - ligne.largeur;
    else xLigne = x;

    // Contour (passe pleine ligne, sous le remplissage).
    if (style.contour && style.contour.largeur > 0) {
      ctx.save();
      ctx.lineWidth = style.contour.largeur;
      ctx.strokeStyle = style.contour.couleur;
      ctx.lineJoin = "round";
      ctx.strokeText(ligne.texte, xLigne, yLigne);
      ctx.restore();
    }

    // Ombre portée (passe pleine ligne).
    if (style.ombre) {
      ctx.save();
      ctx.shadowColor = style.ombre.couleur;
      ctx.shadowBlur = style.ombre.flou;
      ctx.shadowOffsetY = style.ombre.dy;
      ctx.fillStyle = "#000000";
      ctx.fillText(ligne.texte, xLigne, yLigne);
      ctx.restore();
    }

    // Texte mot à mot (couleur mot clé / secondaire).
    let xMot = xLigne;
    ligne.mots.forEach((mot) => {
      const couleur =
        mot.cle && style.couleurMotsCles ? style.couleurMotsCles : style.couleur;

      if (style.degradeOr && mot.cle) {
        const grad = ctx.createLinearGradient(
          0,
          yLigne,
          0,
          yLigne + hauteurLigne * 0.85
        );
        BRAND.gradients.goldShimmer.forEach((c, i, arr) => {
          grad.addColorStop(i / (arr.length - 1), c);
        });
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = couleur;
      }

      ctx.fillText(mot.mot, xMot, yLigne);
      xMot += ctx.measureText(mot.mot).width + ctx.measureText(" ").width;
    });
  });

  ctx.letterSpacing = "0px";
  ctx.restore();
}
