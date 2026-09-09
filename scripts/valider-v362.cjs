#!/usr/bin/env node
/**
 * ⭐ V3.62 — Validateur sémantique : correctif « l'écran s'élargit ».
 * ① Containment CSS : min-w-0 sur les colonnes de la grille + le scroller.
 * ② Auto-fit robuste de la timeline (largeur réelle + recalage à l'arrivée
 *    des métadonnées vidéo).
 * Usage : node scripts/valider-v362.cjs
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "..");
const FICHIERS = [
  "src/components/post-production/timeline-pro.tsx",
  "src/components/post-production/post-production.tsx",
];

let ok = 0, ko = 0;
const res = (cond, label, detail) => {
  if (cond) { ok++; console.log(`  ✅ ${label}`); }
  else { ko++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`); }
};

console.log("── V3.62 — 1) Syntaxe Babel ──");
const sources = {};
for (const f of FICHIERS) {
  const p = path.join(ROOT, f);
  const src = fs.readFileSync(p, "utf8");
  sources[f] = src;
  try {
    parser.parse(src, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: false });
    ok++; console.log(`  ✅ ${path.basename(f)} — syntaxe OK`);
  } catch (e) { ko++; console.log(`  ❌ ${path.basename(f)} — ${e.message}`); }
}

const tp = sources[FICHIERS[0]];   // timeline-pro
const pp = sources[FICHIERS[1]];   // post-production

// ─── 2) Containment CSS (cause racine mesurée : page 19 864 px) ───
console.log("── 2) Containment CSS — min-w-0 (cause racine) ──");
res(
  /<div className="min-w-0 space-y-3">\s*\{\s*\/\*\s*─── Colonne gauche/.test(pp) || /Colonne gauche[\s\S]{0,220}min-w-0/.test(pp),
  "colonne GAUCHE de la grille : min-w-0 (la piste 1fr ne peut plus être dilatée par le min-content)"
);
res(/Colonne droite[\s\S]{0,220}min-w-0/.test(pp), "colonne DROITE de la grille : min-w-0 (défense en profondeur)");
res(
  pp.includes('lg:grid-cols-[1fr_360px]'),
  "grille principale 1fr_360px toujours en place"
);
res(
  /data-scroller/.test(tp) && /flex-1 min-w-0 overflow-x-auto/.test(tp),
  "scroller timeline : flex-1 + min-w-0 + overflow-x-auto (défile DANS son conteneur)"
);
res(
  /width: largeurContenu/.test(tp) && /largeurContenu = Math\.max\(dureeAffichee \* pxParSec, 320\)/.test(tp),
  "largeur du contenu interne : explicite, confinée au scroller"
);

// ─── 3) Auto-fit robuste ───
console.log("── 3) Auto-fit robuste de la timeline ──");
res(/useState\(0\)/.test(tp) && /pas encore mesuré/.test(tp), "largeur initiale = 0 (attend la mesure RÉELLE du ResizeObserver)");
res(/zoomManuelRef/.test(tp), "drapeau zoomManuel : l'utilisateur qui zoome prend la main");
res(/premiereMesureRef/.test(tp), "① premier ajustement dès la première mesure réelle (largeur > 200)");
res(/dureeAjusteeRef/.test(tp), "② recalage quand la durée affichée change fortement (métadonnées vidéo)");
res(/ajustementsAutoRef\.current >= 3/.test(tp), "② auto-fits bornés (max 3) — pas de boucle");
res(/dragRef\.current\)/.test(tp) && /jamais pendant un glisser/.test(tp), "② jamais pendant un glisser (pas de saut de zoom en cours de drag)");
res(/largeur < 200\) return;/.test(tp), "ajuster() protégé tant que la largeur n'est pas mesurée");
res(/zoomer\(/.test(tp), "contrôles de zoom routés via zoomer() (marque le zoom manuel)");
res(
  /onClick=\{\(\) => zoomer\(pxParSec \/ 1\.35\)\}/.test(tp) &&
  /onChange=\{\(e\) => zoomer\(parseFloat\(e\.target\.value\)\)\}/.test(tp) &&
  /onClick=\{\(\) => zoomer\(pxParSec \* 1\.35\)\}/.test(tp),
  "ZoomOut / slider / ZoomIn passent par zoomer()"
);
res(/Number\.isFinite\(v\) \? v : 40/.test(tp), "zoomer() : garde-fou NaN (slider vide)");
res(
  /zoomManuelRef\.current = true; ajuster\(\);/.test(tp),
  "bouton « Ajuster » : calage manuel + stoppe les auto-fits futurs"
);

// ─── 4) Invariants V3.61 préservés ───
console.log("── 4) Invariants V3.61/V3.60 préservés ──");
res(pp.includes("TimelinePro"), "TimelinePro toujours intégré dans post-production");
res(tp.includes("V1 · Vidéo") && tp.includes("TX · Textes") && tp.includes("IMG · Images"), "pistes NLE V1/TX/IMG intactes");
res(tp.includes("data-scroller"), "data-scroller intact (conversions pixel↔temps)");
res(pp.includes("min-w-0 space-y-3") && pp.split("min-w-0 space-y-3").length === 3, "exactement 2 colonnes min-w-0 (gauche + droite)");

console.log(`\n═══ V3.62 : ${ok}/${ok + ko} ═══`);
process.exit(ko === 0 ? 0 : 1);
