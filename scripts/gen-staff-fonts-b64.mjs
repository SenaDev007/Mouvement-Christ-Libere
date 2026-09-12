import { readFileSync, writeFileSync } from "fs";

/**
 * Génération des polices PDF des espaces staff (V3.66).
 * Sous-ensembles DejaVu : latin + accents français + ponctuation + €.
 * (Les polices du calendrier biblique n'incluent PAS le glyphe €.)
 */
const fonts = [
  ["DejaVuSans-staff.ttf", "FONT_STAFF_SANS_B64", "DejaVu Sans (latin + accents + €)"],
  ["DejaVuSans-Bold-staff.ttf", "FONT_STAFF_SANS_GRAS_B64", "DejaVu Sans Bold (latin + accents + €)"],
  ["DejaVuSerif-Bold-staff.ttf", "FONT_STAFF_SERIF_GRAS_B64", "DejaVu Serif Bold (titres + €)"],
];

let out = `/**
 * ⭐ V3.66 — Polices PDF des espaces Secrétariat & Trésorerie.
 *
 * Sous-ensembles DejaVu (pyftsubset) : latin de base + accents français +
 * ponctuation typographique + SYMBOLE EURO (U+20AC — absent des polices du
 * calendrier biblique : ces nouvelles polices sont dédiées aux documents
 * financiers du ministère).
 *
 * Embarquées en base64 dans le bundle serverless : fiable sur Vercel
 * (aucune lecture disque au runtime), PDF fin.
 *
 * ⚠️ Ne pas éditer à la main — régénérer via scripts/gen-staff-fonts-b64.mjs.
 */

`;

for (const [file, name, comment] of fonts) {
  const b64 = readFileSync(`/tmp/fonts-staff/${file}`).toString("base64");
  out += `/** ${comment} — ${Math.round(b64.length / 1024)} Ko en base64. */\nexport const ${name} =\n  "${b64}";\n\n`;
}

writeFileSync(
  "src/lib/staff-space/pdf/fonts.ts",
  out
);
console.log("fonts.ts (staff) écrit :", out.length, "caractères");
