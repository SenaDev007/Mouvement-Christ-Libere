/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : détourage automatique des photos (§12).
 *
 * La spécification privilégie `rembg` (Python) — impossible dans une
 * fonction serverless Next.js/Vercel. Stratégie robuste SANS dépendance
 * externe : algorithme de SEGMENTATION PAR COULEUR DEPUIS LES BORDS
 * (flood-fill) avec sharp :
 *
 *   ① estime la couleur de fond depuis une couronne de pixels du contour ;
 *   ② remplit par diffusion (scanline flood fill) tous les pixels « proches
 *      du fond » CONNECTÉS aux bords (les zones internes de la tenue ne
 *      sont jamais touchées) ;
 *   ③ lisse le masque (flou léger + seuil) pour des bords propres ;
 *   ④ exporte un PNG avec transparence.
 *
 * Le traitement est fait UNE SEULE FOIS À L'UPLOAD (spec : « Le détourage
 * doit être réalisé une seule fois puis réutilisé ») et reste best-effort :
 * si l'algorithme ne converge pas (fond complexe), la photo originale est
 * conservée et utilisée telle quelle — jamais d'échec bloquant.
 *
 * ⚠️ SERVEUR UNIQUEMENT (sharp natif).
 */

import sharp from "sharp";

/** Statistiques d'une tentative de détourage. */
export interface ResultatDetourage {
  ok: boolean;
  tamponPng: Buffer | null;
  couverture: number; // part des pixels rendus transparents (0-1)
}

/** Échantillonne la couleur moyenne d'une couronne de bord. */
function couleurDeFond(
  data: Buffer,
  largeur: number,
  hauteur: number
): { r: number; g: number; b: number } {
  const pas = Math.max(1, Math.floor(Math.max(largeur, hauteur) / 200));
  const zones: Array<[number, number]> = [];
  // Couronne : 4 bords.
  for (let x = 0; x < largeur; x += pas) {
    zones.push([x, 0]);
    zones.push([x, hauteur - 1]);
  }
  for (let y = 0; y < hauteur; y += pas) {
    zones.push([0, y]);
    zones.push([largeur - 1, y]);
  }
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const [x, y] of zones) {
    const i = (y * largeur + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/** Distance quadratique couleur. */
function distance2(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/**
 * Détourage par flood-fill depuis les bords. tolérance 0-1 (défaut 0.18 :
 * photos prises sur fond relativement uni — studio, mur, ciel).
 */
export async function detourerPhoto(
  entree: Buffer,
  options?: { tolerance?: number; largeurMax?: number }
): Promise<ResultatDetourage> {
  const tolerance = options?.tolerance ?? 0.18;
  const largeurMax = options?.largeurMax ?? 1600;

  try {
    // Normalisation : max 1600 px de large (suffisant pour le rendu 2480
    // en A4 car le sujet n'occupe qu'une zone — et le calcul reste rapide).
    const image = sharp(entree).rotate(); // EXIF
    const meta = await image.metadata();
    const largeur = meta.width || 0;
    const hauteur = meta.height || 0;
    if (!largeur || !hauteur) return { ok: false, tamponPng: null, couverture: 0 };

    const cibleW = Math.min(largeur, largeurMax);
    const { data, info } = await image
      .resize({ width: cibleW, withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const px = data;

    const fond = couleurDeFond(px, w, h);
    const seuil = (tolerance * 255) ** 2 * 3;

    // Masque binaire : true = fond détecté.
    const masque = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      masque[i] =
        distance2(px[o], px[o + 1], px[o + 2], fond.r, fond.g, fond.b) <= seuil
          ? 1
          : 0;
    }

    // Flood-fill depuis les bords : seuls les pixels « fond » CONNECTÉS au
    // contour deviennent transparents (une chemise de la même couleur que
    // le fond mais entourée par le sujet reste opaque).
    const visite = new Uint8Array(w * h);
    const pile: number[] = [];
    for (let x = 0; x < w; x++) {
      pile.push(x, 0, x, h - 1); // (index, inutile) — on pousse indices
    }
    for (let y = 0; y < h; y++) {
      pile.push(y * w, y * w + w - 1);
    }
    // Simplification : pile d'indices.
    const stack: number[] = [];
    for (let x = 0; x < w; x++) {
      stack.push(x);
      stack.push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      stack.push(y * w);
      stack.push(y * w + w - 1);
    }
    while (stack.length) {
      const i = stack.pop() as number;
      if (i < 0 || i >= w * h || visite[i]) continue;
      visite[i] = 1;
      if (!masque[i]) continue;
      masque[i] = 2; // fond connecté
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w);
      if (y < h - 1) stack.push(i + w);
    }
    void pile;

    // Alpha doux : le masque binaire est flouté (gaussien) puis seuillé en
    // BANDE PROGRESSIVE — bords nets sans dentelure, et légère ÉROSION
    // (seuil bas élevé) qui supprime la frange de pixels mixtes
    // sujet/fond (leçon VLM : « franges résiduelles »).
    let transparents = 0;
    const masqueNet = Buffer.alloc(w * h);
    for (let i = 0; i < w * h; i++) {
      if (masque[i] === 2) {
        masqueNet[i] = 255;
        transparents++;
      }
    }
    const masqueFlou = await sharp(masqueNet, {
      raw: { width: w, height: h, channels: 1 },
    })
      .blur(2)
      .raw()
      .toBuffer();

    // Bande de transition 90-170 : 0 → transparent, 255 → opaque.
    for (let i = 0; i < w * h; i++) {
      const v = masqueFlou[i];
      let alpha: number;
      if (v <= 90) alpha = 0; // clairement fond
      else if (v >= 170) alpha = 255; // clairement sujet
      else alpha = Math.round(((v - 90) / 80) * 255); // transition douce
      px[i * 4 + 3] = alpha;
    }

    const couverture = transparents / (w * h);

    // Garde-fous de pertinence : un détourage « réussi » retire 8 % à 65 %
    // de l'image. En dehors → fond non uni ou sujet coupé : on ABANDONNE.
    if (couverture < 0.08 || couverture > 0.65) {
      return { ok: false, tamponPng: null, couverture };
    }

    // PNG + TRIM des marges transparentes : le fichier final ne contient
    // QUE le sujet — dans le moteur, la silhouette remplit exactement sa
    // zone (leçon VLM : « sujet trop petit » quand les marges de la photo
    // consument l'espace de composition).
    const tamponPng = await sharp(px, { raw: { width: w, height: h, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const taille = await sharp(tamponPng)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
      .catch(() => tamponPng);
    void taille;

    return { ok: true, tamponPng: taille, couverture };
  } catch (e) {
    console.warn("[studio/detourage] Erreur :", e instanceof Error ? e.message : e);
    return { ok: false, tamponPng: null, couverture: 0 };
  }
}
