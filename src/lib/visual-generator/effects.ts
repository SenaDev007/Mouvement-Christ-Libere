/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : effets de la photo de l'intervenant (§13).
 *
 * Traitements professionnels appliqués au SUJET (et contrôlés par
 * template) : ombre portée, halo lumineux (glow), contour lumineux,
 * luminosité / contraste / saturation (via ctx.filter natif de
 * @napi-rs/canvas 1.0.8), vignette et voiles de lisibilité (§15).
 *
 * ⚠️ SERVEUR UNIQUEMENT (@napi-rs/canvas natif).
 */

import type { SKRSContext2D, Image } from "@napi-rs/canvas";
import type { EffetsSujet, ConfigVoile } from "./types";
import { BRAND, styleStudio } from "../studio/brand-tokens";

/**
 * Applique les réglages tonaux (luminosité/contraste/saturation) au
 * contexte courant — ctx.filter CSS natif Skia.
 */
export function appliquerFiltresSujet(
  ctx: SKRSContext2D,
  effets: EffetsSujet
): void {
  const parties: string[] = [];
  if (effets.luminosite && effets.luminosite !== 1) {
    parties.push(`brightness(${effets.luminosite})`);
  }
  if (effets.contraste && effets.contraste !== 1) {
    parties.push(`contrast(${effets.contraste})`);
  }
  if (effets.saturation && effets.saturation !== 1) {
    parties.push(`saturate(${effets.saturation})`);
  }
  ctx.filter = parties.length ? parties.join(" ") : "none";
}

/** Réinitialise le filtre du contexte. */
export function reinitialiserFiltres(ctx: SKRSContext2D): void {
  ctx.filter = "none";
}

/**
 * Dessine le sujet AVEC ses effets : halo → ombre portée → filtres →
 * photo → contour lumineux.
 *  · mode « cover » (photo OPAQUE, non détourée) : la photo REMPLIT la
 *    zone (crop centré sur le haut — le visage reste visible), sans
 *    bandes vides — le rendu est propre même sans détourage.
 *  · mode « contain » (PNG détouré) : silhouette contenue dans la zone
 *    (ratio préservé, ancres hAlign/vAlign).
 */
export function dessinerSujetAvecEffets(
  ctx: SKRSContext2D,
  image: Image,
  zone: { x: number; y: number; w: number; h: number },
  hAlign: "left" | "center" | "right",
  vAlign: "top" | "center" | "bottom",
  effets: EffetsSujet,
  cleStyle: string,
  mode: "contain" | "cover" = "contain",
  palettePerso?: { accent?: string; secondary?: string; background?: string }
): void {
  const style = styleStudio(cleStyle, palettePerso);

  let w: number;
  let h: number;
  const ratio = image.width / image.height;
  if (mode === "cover") {
    // Couverture : au moins une dimension = zone, l'autre déborde (crop).
    if (zone.w / zone.h > ratio) {
      w = zone.w;
      h = w / ratio;
    } else {
      h = zone.h;
      w = h * ratio;
    }
  } else {
    // Contention : ratio préservé, tout tient dans la zone.
    w = zone.w;
    h = w / ratio;
    if (h > zone.h) {
      h = zone.h;
      w = h * ratio;
    }
  }
  // Ancrage : en cover, le CROP privilégie le HAUT (visage) quand ça
  // déborde verticalement ; en contain, les ancres explicites s'appliquent.
  let x = zone.x;
  if (hAlign === "center") x = zone.x + (zone.w - w) / 2;
  else if (hAlign === "right") x = zone.x + zone.w - w;
  let y = zone.y;
  if (mode === "cover") {
    // Recadrage vertical : HAUT DE LA ZONE = haut de la photo (le visage
    // est en haut des portraits — jamais rogné).
    if (h > zone.h) y = zone.y;
    else y = zone.y + (zone.h - h) / 2;
  } else {
    if (vAlign === "center") y = zone.y + (zone.h - h) / 2;
    else if (vAlign === "bottom") y = zone.y + zone.h - h;
  }
  // Le dessin reste borné à la zone en cover (clip doux du contexte).
  const clipNecessaire = mode === "cover";
  if (clipNecessaire) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(zone.x, zone.y, zone.w, zone.h);
    ctx.clip();
  }

  // ① Halo lumineux derrière le sujet (glow aux couleurs du style).
  if (effets.halo) {
    ctx.save();
    const rayon = Math.max(w, h) * 0.62;
    const cx = x + w / 2;
    const cy = y + h * 0.42;
    const halo = ctx.createRadialGradient(cx, cy, rayon * 0.12, cx, cy, rayon);
    halo.addColorStop(0, `${style.accent}66`); // ~40 % alpha
    halo.addColorStop(0.55, `${style.accent}22`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - rayon, cy - rayon, rayon * 2, rayon * 2);
    ctx.restore();
  }

  // ② Ombre portée portée par la silhouette de la photo.
  if (effets.ombre) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = Math.max(w, h) * 0.05;
    ctx.shadowOffsetY = Math.max(w, h) * 0.018;
    // Redessiner l'image avec filtre neutre : seule l'ombre compte.
    ctx.drawImage(image, x, y, w, h);
    ctx.restore();
  }

  // ③ Réglages tonaux puis photo.
  ctx.save();
  appliquerFiltresSujet(ctx, effets);
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
  reinitialiserFiltres(ctx);

  // ④ Contour lumineux : l'image est retracée légèrement décalée en
  // mode « lumière » — simple, robuste et efficace sur fond sombre.
  if (effets.contour && effets.contour > 0) {
    const epaisseur = Math.min(w, h) * effets.contour;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = epaisseur;
    ctx.shadowColor = style.accent;
    ctx.shadowBlur = epaisseur * 2.5;
    ctx.strokeRect(x + epaisseur * 0.4, y + epaisseur * 0.4, w - epaisseur * 0.8, h - epaisseur * 0.8);
    ctx.restore();
  }

  if (clipNecessaire) {
    ctx.restore();
  }
}

/**
 * Voile de lisibilité ENTRE le fond et le sujet/texte (§15 — un fond ne
 * doit JAMAIS prendre le dessus sur le visage, le titre, le logo).
 * Toujours dessiné APRÈS le fond, AVANT le sujet.
 */
export function dessinerVoile(
  ctx: SKRSContext2D,
  largeur: number,
  hauteur: number,
  voile: ConfigVoile
): void {
  if (voile.type === "aucun" || voile.intensite <= 0) return;
  const i = Math.min(1, Math.max(0, voile.intensite));
  const noir = BRAND.colors.black;

  ctx.save();
  switch (voile.type) {
    case "bas": {
      // Dégradé montant depuis le bas — le bloc texte du bas reste lisible.
      const grad = ctx.createLinearGradient(0, hauteur * 0.3, 0, hauteur);
      grad.addColorStop(0, "rgba(5,5,5,0)");
      grad.addColorStop(1, `${noir}${Math.round(i * 230).toString(16).padStart(2, "0")}`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, largeur, hauteur);
      break;
    }
    case "cote": {
      // Dégradé latéral — protège la colonne de texte opposée au sujet.
      const grad = ctx.createLinearGradient(0, 0, largeur, 0);
      grad.addColorStop(0, `${noir}${Math.round(i * 215).toString(16).padStart(2, "0")}`);
      grad.addColorStop(0.62, `${noir}${Math.round(i * 110).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, "rgba(5,5,5,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, largeur, hauteur);
      break;
    }
    case "cinema": {
      // Voile plein très léger + bas renforcé (composition cinématique).
      ctx.fillStyle = `${noir}${Math.round(i * 92).toString(16).padStart(2, "0")}`;
      ctx.fillRect(0, 0, largeur, hauteur);
      const grad = ctx.createLinearGradient(0, hauteur * 0.45, 0, hauteur);
      grad.addColorStop(0, "rgba(5,5,5,0)");
      grad.addColorStop(1, `${noir}${Math.round(i * 205).toString(16).padStart(2, "0")}`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, largeur, hauteur);
      break;
    }
    default: {
      // "plein"
      ctx.fillStyle = `${noir}${Math.round(i * 165).toString(16).padStart(2, "0")}`;
      ctx.fillRect(0, 0, largeur, hauteur);
    }
  }
  ctx.restore();
}

/**
 * Vignette finale (assombrissement des bords) — un seul passage discret,
 * jamais au-dessus du texte : appliqué ENTRE le fond et le sujet.
 */
export function dessinerVignette(
  ctx: SKRSContext2D,
  largeur: number,
  hauteur: number,
  intensite = 0.5
): void {
  const r = Math.sqrt(largeur * largeur + hauteur * hauteur) / 2;
  const grad = ctx.createRadialGradient(
    largeur / 2,
    hauteur / 2,
    r * 0.55,
    largeur / 2,
    hauteur / 2,
    r
  );
  grad.addColorStop(0, "rgba(5,5,5,0)");
  grad.addColorStop(1, `rgba(5,5,5,${0.55 * intensite})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, largeur, hauteur);
}
