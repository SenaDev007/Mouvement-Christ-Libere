import { readFileSync, writeFileSync } from "fs";

/**
 * V3.12 — Embarque le VRAI logo « Christ Libère » (PNG à fond transparent,
 * palette or/brun) dans le bundle serverless pour la page de garde du PDF
 * du calendrier biblique — même stratégie que les polices (base64, aucune
 * lecture disque au runtime, fiable sur Vercel).
 *
 * ⚠️ Ne pas éditer à la main — régénérer via scripts/gen-logo-b64.mjs.
 */
const b64 = readFileSync("public/logo-christ-libere.png").toString("base64");

const out = `/**
 * Logo officiel « Mouvement Christ Libère » — PNG 369×391, fond
 * transparent, palette or/brun. Utilisé par la page de garde du PDF du
 * calendrier biblique (⭐ V3.12 : remplace le médaillon shofar générique).
 *
 * Embarqué en base64 dans le bundle serverless : fiable sur Vercel
 * (aucune lecture disque au runtime), même stratégie que fonts.ts.
 *
 * ⚠️ Ne pas éditer à la main — régénérer via scripts/gen-logo-b64.mjs
 *    (source : public/logo-christ-libere.png).
 */

/** ~${Math.round(b64.length / 1024)} Ko en base64. */
export const LOGO_CHRIST_LIBERE_B64 =
  "${b64}";
`;

writeFileSync("src/lib/calendrier/pdf/logo.ts", out);
console.log("logo.ts écrit :", out.length, "caractères (~" + Math.round(b64.length / 1024) + " Ko de base64)");
