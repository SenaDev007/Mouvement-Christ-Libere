import { readFileSync, writeFileSync } from "fs";
const fonts = [
  ["DejaVuSans-sub.ttf", "FONT_SANS_B64", "DejaVu Sans (latin + hébreu sans niquoud)"],
  ["DejaVuSans-Bold-sub.ttf", "FONT_SANS_GRAS_B64", "DejaVu Sans Bold"],
  ["DejaVuSerif-Bold-sub.ttf", "FONT_SERIF_GRAS_B64", "DejaVu Serif Bold (titres)"],
];
let out = `/**
 * Polices embarquées pour la génération PDF du calendrier biblique.
 *
 * Sous-ensembles DejaVu (pyftsubset) : latin de base + accents français +
 * ponctuation typographique + lettres hébraïques (U+05D0-05EA, sans
 * niquoud — le PDF n'a pas de moteur bidi ; les chaînes hébraïques sont
 * inversées manuellement à l'affichage, ce qui est exact pour l'hébreu
 * pointé sans ligatures contextuelles).
 *
 * Embarquées en base64 dans le bundle serverless : fiable sur Vercel
 * (aucune lecture disque au runtime), PDF fin (~19 Ko par police avant
 * sous-ensemble final par pdf-lib).
 *
 * ⚠️ Ne pas éditer à la main — régénérer via scripts/gen-fonts-b64.mjs.
 */

`;
for (const [file, name, comment] of fonts) {
  const b64 = readFileSync(`/tmp/fonts-sub/${file}`).toString("base64");
  out += `/** ${comment} — ${Math.round(b64.length / 1024)} Ko en base64. */\nexport const ${name} =\n  "${b64}";\n\n`;
}
writeFileSync("src/lib/calendrier/pdf/fonts.ts", out);
console.log("fonts.ts écrit :", out.length, "caractères");
