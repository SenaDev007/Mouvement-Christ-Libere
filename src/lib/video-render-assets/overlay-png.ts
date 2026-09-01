/**
 * ⭐ V3.16 — Rendu des overlays TEXTE et STICKERS en PNG transparent.
 * ============================================================================
 * ffmpeg-static (le binaire ffmpeg utilisé sur Vercel) N'EMBARQUE PAS le
 * filtre drawtext (compilé sans libfreetype) — les textes et emoji ne
 * pouvaient donc JAMAIS être gravés dans la vidéo exportée.
 *
 * Stratégie : le texte est rendu côté Node avec @napi-rs/canvas (binaires
 * pré-compilés, compatible serverless Vercel) en PNG transparent à la
 * résolution VIDÉO, puis superposé par le filtre `overlay` (disponible dans
 * ffmpeg-static). Les stickers emoji sont récupérés en PNG haute résolution
 * (OpenMoji 618px, repli Twemoji 72px) puis composés avec leur rotation.
 *
 * Les polices DejaVu sont embarquées en base64 (video-render-assets/fonts.ts)
 * et enregistrées via GlobalFonts.register — AUCUN fontconfig requis.
 */
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { getVideoFontBold, getVideoFontRegular } from "./fonts";

// Types minimaux locaux (structure des overlays — évite un import circulaire
// avec video-render.ts qui importe ce module).
interface TextOverlayLike {
  content: string;
  fontSize: number;
  fontColor?: string;
  bgColor?: string | null;
  bold?: boolean;
  italic?: boolean;
}

interface StickerOverlayLike {
  emoji: string;
  size: number;
  rotation: number;
}

let fontsEnregistrees = false;

/** Enregistre les polices DejaVu une seule fois par instance (familles
 * distinctes : le binaire ffmpeg-static n'a pas drawtext, tout le texte
 * passe par ce rendu canvas → PNG → filtre overlay). */
function assurerPolices(): void {
  if (fontsEnregistrees) return;
  GlobalFonts.register(getVideoFontRegular(), "DejaVuVideoRegular");
  GlobalFonts.register(getVideoFontBold(), "DejaVuVideoBold");
  fontsEnregistrees = true;
}

/**
 * Rend un overlay TEXTE en PNG transparent.
 * Le PNG ne contient que le texte (+ son fond) — il est ensuite superposé
 * CENTRÉ sur le point (x%, y%) de la vidéo (WYSIWYG avec le preview).
 */
export function renderTextOverlayPng(t: TextOverlayLike): Buffer {
  assurerPolices();
  const family = t.bold ? "DejaVuVideoBold" : "DejaVuVideoRegular";
  const fontStyle = t.italic ? "italic " : "";
  const fontSpec = `${fontStyle}${t.fontSize}px "${family}"`;

  // Mesure (canevas sonde)
  const probe = createCanvas(8, 8).getContext("2d");
  probe.font = fontSpec;
  const metrics = probe.measureText(t.content || " ");
  const textW = Math.ceil(metrics.width);
  const textH = Math.ceil(t.fontSize * 1.4);
  const padX = t.bgColor ? Math.round(t.fontSize * 0.4) + 4 : 2;
  const padY = t.bgColor ? Math.round(t.fontSize * 0.18) + 4 : 2;

  const w = Math.max(4, textW + padX * 2);
  const h = Math.max(4, textH + padY * 2);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  if (t.bgColor) {
    ctx.fillStyle = t.bgColor;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.font = fontSpec;
  ctx.fillStyle = t.fontColor || "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t.content, w / 2, h / 2 + Math.round(t.fontSize * 0.06));

  return canvas.toBuffer("image/png");
}

/**
 * Nom de fichier emoji (points de code sans sélecteur FE0F,
 * séquences ZWJ conservées) — convention OpenMoji/Twemoji.
 */
function emojiFileName(emoji: string): string {
  // On retire le sélecteur de variation FE0F (les CDN ne le nomment pas),
  // on conserve les séquences ZWJ (200D) pour les emoji composés.
  return [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16).padStart(4, "0").toUpperCase())
    .filter((cp) => cp !== "FE0F")
    .join("-");
}

/**
 * Récupère le PNG d'un emoji : OpenMoji 618×618 (haute résolution) puis
 * Twemoji 72×72 en repli. Retourne null si les deux échouent (l'overlay est
 * alors ignoré — non bloquant).
 */
async function fetchEmojiPng(emoji: string): Promise<Buffer | null> {
  const name = emojiFileName(emoji);
  const urls = [
    `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/618x618/${name}.png`,
    `https://cdn.jsdelivr.net/gh/twitter/twemoji@master/assets/72x72/${name.toLowerCase()}.png`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 100) return buf;
      }
    } catch {
      // CDN indisponible → essayer le suivant
    }
  }
  console.warn(`[render] emoji introuvable sur les CDN : ${emoji} (${name})`);
  return null;
}

/**
 * Rend un STICKER emoji en PNG transparent, à la taille demandée et avec sa
 * rotation. Retourne null si le PNG de l'emoji est indisponible.
 */
export async function renderStickerPng(s: StickerOverlayLike): Promise<Buffer | null> {
  const emojiBuf = await fetchEmojiPng(s.emoji);
  if (!emojiBuf) return null;

  // ⭐ V3.16 — loadImage (API documentée) : l'affectation directe
  // `img.src = buffer` décode silencieusement mais ne dessine RIEN.
  const img = await loadImage(emojiBuf);

  const size = Math.max(8, Math.round(s.size));
  // Canevas couvrant la bounding box de l'emoji pivoté (diagonale)
  const diag = Math.ceil(size * 1.5);
  const canvas = createCanvas(diag, diag);
  const ctx = canvas.getContext("2d");

  ctx.translate(diag / 2, diag / 2);
  if (s.rotation) ctx.rotate((s.rotation * Math.PI) / 180);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);

  return canvas.toBuffer("image/png");
}
