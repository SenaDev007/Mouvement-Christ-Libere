#!/usr/bin/env node
/**
 * ⭐ V4.01 — Validation locale du filtrage par catégorie sur /videos.
 * 1) Parse Babel (le conteneur OOM avec tsc) — videos-view.tsx doit parser.
 * 2) Vérifications structurelles du comportement demandé par le pasteur :
 *    - « Tout » présent (chips mobile + sidebar desktop) et reset à null ;
 *    - clic catégorie → setActiveCategory(cat.id) + scroll vers #categorie-active ;
 *    - activeCat = find(...) || null (plus de repli categories[0]) ;
 *    - grille « Toutes les vidéos » avec currentVideos (toutes catégories) ;
 *    - ancienne section « Vidéos récentes » et auto-sélection absentes ;
 *    - icône Clock et recentVideos absents du fichier.
 */
const fs = require("fs");
const path = require("path");

const babel = require("/home/z/my-project/.tmp-babel/node_modules/@babel/parser");
const FILE = "/home/z/my-project/mouvement-christ-libere/src/components/videos/videos-view.tsx";

let ok = 0, ko = 0;
function check(label, cond) {
  if (cond) { ok++; console.log(`  ✔ ${label}`); }
  else { ko++; console.log(`  ✘ ${label}`); }
}

const src = fs.readFileSync(FILE, "utf8");

console.log("── 1) Parse Babel ──");
try {
  babel.parse(src, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    errorRecovery: false,
  });
  check("videos-view.tsx parse (TSX, @babel/parser)", true);
} catch (e) {
  check(`videos-view.tsx parse — ${e.message}`, false);
}

console.log("── 2) Comportement « Tout » / filtrage ──");
check("state activeCategory: string | null (null = Tout)", /useState<string \| null>\(null\)/.test(src));
check("activeCat sans repli (|| null)", /categories\.find\(c => c\.id === activeCategory\) \|\| null/.test(src));
check("Chips mobile : bouton « Tout »", />\s*Tout\s*<span/.test(src) && src.includes("setActiveCategory(null);"));
check("Sidebar desktop : bouton « Tout » en tête", /Catégories<\/h3>[\s\S]{0,400}?Tout/.test(src));
check("Compteur « Tout » = currentVideos.length (total serviteur)", /Tout[\s\S]{0,200}?\{currentVideos\.length\}/.test(src));
check("Clic catégorie (chips) : setActiveCategory(cat.id)", /onClick=\{\(\) => \{\s*setActiveCategory\(cat\.id\);/.test(src));
check("Scroll vers #categorie-active après clic (premier plan)", /getElementById\("categorie-active"\)\?\.scrollIntoView/.test(src));
check("Rubriques « à suivre » : clic filtre aussi", /setActiveCategory\(`\$\{activeTab\}-\$\{name\}`\)/.test(src));
check("Grille « Toutes les vidéos » (mode Tout)", src.includes("Toutes les vidéos"));
check("Grille Tout : currentVideos.map (toutes catégories confondues)", /currentVideos\.map\(\(video\) =>/.test(src));
check("Changement d'onglet serviteur reset la catégorie", /setActiveTab\("afrika"\); setActiveCategory\(null\)/.test(src) && /setActiveTab\("kongo"\); setActiveCategory\(null\)/.test(src));
check("Animation motion.div par catégorie (key cat-/tout)", /key=\{activeCat \? `cat-\$\{activeCat\.id\}` : "tout"\}/.test(src));

console.log("── 3) Nettoyage (ancien comportement) ──");
// Retirer les commentaires // et /* */ avant de chercher le LIBELLÉ rendu
// (les commentaires V4.01 documentent la suppression — c'est attendu).
const srcNoComments = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
check("Section « Vidéos récentes » absente (hors commentaires)", !srcNoComments.includes("Vidéos récentes"));
check("recentVideos absent", !src.includes("recentVideos"));
check("Icône Clock absente (import nettoyé)", !/\bClock\b/.test(src));
check("Auto-sélection première catégorie absente", !/setActiveCategory\(categories\[0\]\.id\)/.test(src));

console.log(`\n${ok}/${ok + ko} vérifications ${ko === 0 ? "✔ V4.01 OK" : "✘ ÉCHEC"}`);
process.exit(ko === 0 ? 0 : 1);
