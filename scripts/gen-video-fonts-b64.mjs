import { readFileSync, writeFileSync } from "fs";

/**
 * ⭐ V3.16 — Embarque DejaVu Sans (regular + bold) pour le rendu des
 * overlays TEXTE de la post-production vidéo : ffmpeg-static ne contient
 * PAS le filtre drawtext (pas de libfreetype) → le texte est rendu en PNG
 * par @napi-rs/canvas avec CES polices, puis superposé via le filtre
 * overlay (disponible). Même stratégie serverless que fonts.ts/logo.ts.
 *
 * ⚠️ Ne pas éditer à la main — régénérer via scripts/gen-video-fonts-b64.mjs.
 */
const regular = readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf").toString("base64");
const bold = readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf").toString("base64");

const out = `/**
 * ⭐ V3.16 — Polices DejaVu Sans (complete, latin étendu) pour le rendu
 * des overlays TEXTE et SOUS-TITRES de la post-production vidéo.
 *
 * ffmpeg-static (Vercel) n'embarque PAS drawtext/libfreetype : le texte est
 * rendu côté Node avec @napi-rs/canvas (ces polices, enregistrées via
 * GlobalFonts.register — aucun fontconfig requis), exporté en PNG
 * transparent, puis superposé au flux vidéo par le filtre overlay.
 *
 * La police sert aussi de famille de repli pour les sous-titres brûlés
 * (libass) via un fonts.conf dédié.
 *
 * ⚠️ Ne pas éditer à la main — régénérer via scripts/gen-video-fonts-b64.mjs
 *    (sources : /usr/share/fonts/truetype/dejavu/DejaVuSans{,-Bold}.ttf).
 */

/** DejaVu Sans regular — ~${Math.round(regular.length / 1024)} Ko en base64. */
export const VIDEO_FONT_REGULAR_B64 =
  "${regular}";

/** DejaVu Sans bold — ~${Math.round(bold.length / 1024)} Ko en base64. */
export const VIDEO_FONT_BOLD_B64 =
  "${bold}";

/** Décode les polices en Buffer (mémoïsé par instance). */
let regularBuf: Buffer | null = null;
let boldBuf: Buffer | null = null;
export function getVideoFontRegular(): Buffer {
  if (!regularBuf) regularBuf = Buffer.from(VIDEO_FONT_REGULAR_B64, "base64");
  return regularBuf;
}
export function getVideoFontBold(): Buffer {
  if (!boldBuf) boldBuf = Buffer.from(VIDEO_FONT_BOLD_B64, "base64");
  return boldBuf;
}
`;

writeFileSync("src/lib/video-render-assets/fonts.ts", out);
console.log("✓ src/lib/video-render-assets/fonts.ts généré");
console.log("  regular :", Math.round(regular.length / 1024), "Ko b64");
console.log("  bold    :", Math.round(bold.length / 1024), "Ko b64");
