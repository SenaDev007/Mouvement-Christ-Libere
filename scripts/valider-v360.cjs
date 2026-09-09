#!/usr/bin/env node
/**
 * ⭐ V3.60 — Validateur sémantique : stickers pro + filtres cinéma + presets
 * couleur + transitions PRO + raccourci Bibliothèque visible.
 * Usage : node scripts/valider-v360.cjs
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "..");
const FICHIERS = [
  "src/components/post-production/sticker-catalog.ts",
  "src/components/post-production/types.ts",
  "src/components/post-production/post-production.tsx",
  "src/lib/video-render.ts",
];

let ok = 0, ko = 0;
const res = (cond, label, detail) => {
  if (cond) { ok++; console.log(`  ✅ ${label}`); }
  else { ko++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`); }
};

console.log("── V3.60 — 1) Syntaxe Babel ──");
const sources = {};
for (const f of FICHIERS) {
  const p = path.join(ROOT, f);
  const src = fs.readFileSync(p, "utf8");
  sources[f] = src;
  try {
    parser.parse(src, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators-legacy"],
      errorRecovery: false,
    });
    ok++;
    console.log(`  ✅ ${path.basename(f)} — syntaxe OK`);
  } catch (e) {
    ko++;
    console.log(`  ❌ ${path.basename(f)} — ${e.message}`);
  }
}

const sticker = sources[FICHIERS[0]];
const types = sources[FICHIERS[1]];
const pp = sources[FICHIERS[2]];
const vr = sources[FICHIERS[3]];

console.log("── 2) Catalogue de stickers pro ──");
res(sticker.includes("export interface StickerPro"), "interface StickerPro exportée");
res(sticker.includes("STICKER_CATEGORIES"), "catégories exportées");
for (const cat of ["social", "arrows", "badges", "shapes"]) {
  res(new RegExp(`category: "${cat}"`).test(sticker) || sticker.includes(`"${cat}"`), `catégorie ${cat} présente`);
}
// Boutons style CapCut (partages / notifications / likes)
res(/id:\s*"like-btn"/.test(sticker), "bouton J'AIME (like) présent");
res(/id:\s*"subscribe/i.test(sticker) || /S'ABONNER/i.test(sticker), "bouton ABONNÉS (subscribe) présent");
res(/notification/i.test(sticker), "bouton/cloche NOTIFICATION présent");
res(/partag/i.test(sticker) || /share/i.test(sticker), "bouton PARTAGER présent");
res(sticker.split("id:").length > 25, "≥ 24 stickers dans le catalogue", `${sticker.split("id:").length - 1} trouvés`);
res(sticker.includes("rasteriserStickerEnPng"), "rastérisation SVG→PNG exportée");
res(sticker.includes("encodeURIComponent(svg)"), "SVG encodé URI-safe pour <img>");
res(!/[€£¥]/.test(sticker), "aucun caractère monétaire exotique (sûr SVG)");

console.log("── 3) types.ts — filtres + presets + transitions ──");
res((types.match(/groupe: "cinema"/g) || []).length >= 5, "filtres CINÉMA groupés", `${(types.match(/groupe: "cinema"/g) || []).length}`);
res((types.match(/groupe: "ambiance"/g) || []).length >= 5, "filtres AMBIANCE groupés");
res(types.includes("COLOR_PRESETS"), "COLOR_PRESETS (étalonnage 1 clic) exporté");
res((types.match(/value: "/g) || []).length >= 28, "≥ 28 entrées dans les listes types", `${(types.match(/value: "/g) || []).length}`);
res(types.includes(`| "glitch"`), "transition glitch déclarée");
for (const f of ["tealorange", "film35", "golden", "bleach", "dreamy", "hdr", "muted", "bluenight", "cyberpunk", "pastel", "vhs", "noirbleu"]) {
  res(types.includes(`"${f}"`), `filtre cinéma ${f} déclaré`);
}

console.log("── 4) video-render.ts — rendu RÉEL (ffmpeg) ──");
res(vr.includes("xfade=transition="), "xfade appliqué à l'export");
res(vr.includes("acrossfade"), "acrossfade audio appliqué");
res(vr.includes("anullsrc"), "piste silencieuse pour segments muets");
res(vr.includes('t === "glitch" ? "distance"'), "glitch → distance (xfade valide)");
res(vr.includes("xfadeReussi"), "repli concat simple si xfade échoue");
for (const f of ["tealorange", "film35", "vhs", "cyberpunk"]) {
  res(vr.includes(`case "${f}"`), `chaîne ffmpeg du filtre ${f}`);
}
res(vr.includes("colorbalance"), "colorbalance utilisé (étalonnage cinéma)");
res(vr.includes("vignette"), "vignettage (film 35 mm / VHS)");
res((vr.match(/case "/g) || []).length >= 20, "≥ 20 filtres rendus ffmpeg", `${(vr.match(/case "/g) || []).length}`);

console.log("── 5) post-production.tsx — UI ──");
res(pp.includes("addProSticker"), "handler addProSticker");
res(pp.includes("rasteriserStickerEnPng"), "appel rastérisation stickers");
res(pp.includes("stickersParCategorie"), "grille par catégorie");
res(pp.includes("stickerpro-"), "stickers pro tracés dans la liste des actifs");
res(pp.includes("COLOR_PRESETS"), "presets d'étalonnage dans le panneau Couleur");
res(pp.includes("STICKER_CATEGORIES"), "sélecteur de catégories stickers");
res((pp.match(/groupe === /g) || []).length >= 2, "filtres groupés dans le panneau");
// Raccourci Bibliothèque (retour « je n'ai pas vu la bibliothèque »)
res(/setActiveTab\("library"\)/.test(pp), "raccourci Bibliothèque dans l'EN-TÊTE (visible)");
res(/animate-pulse/.test(pp), "indicateur pulsant sur l'onglet Bibliothèque");
res(pp.includes("optgroup"), "transitions groupées Classiques / Pack PRO");
res(pp.includes("Pack PRO"), "label Pack PRO visible");
// Aperçus CSS des filtres cinéma
res(pp.includes("tealorange:"), "aperçu CSS du filtre tealorange");
res((pp.match(/saturate\(/g) || []).length > 10, "aperçus CSS filtres nombreux", `${(pp.match(/saturate\(/g) || []).length}`);

console.log("── 6) Cohérence catalogue ↔ types ↔ ffmpeg ──");
const filtresTypes = [...types.matchAll(/value: "(\w+)"/g)].map((m) => m[1]);
for (const f of ["tealorange", "film35", "golden", "bleach", "dreamy", "hdr", "muted", "bluenight", "cyberpunk", "pastel", "vhs", "noirbleu"]) {
  res(vr.includes(`case "${f}"`), `ffmpeg rend ${f}`);
}
const transTypes = [...types.matchAll(/value: "(\w+)", label:/g)].map((m) => m[1]);
res(transTypes.includes("fadewhite") && transTypes.includes("wiperight"), "transitions pro listées côté client");

console.log(`\n════ RÉSULTAT : ${ok} ✅ / ${ko} ❌ ════`);
process.exit(ko === 0 ? 0 : 1);
