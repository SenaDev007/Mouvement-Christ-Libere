#!/usr/bin/env node
/**
 * ⭐ V3.61 — Validateur sémantique : timeline multi-pistes + templates
 * intégrés + correctif audio export (adelay).
 * Usage : node scripts/valider-v361.cjs
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "..");
const FICHIERS = [
  "src/components/post-production/timeline-pro.tsx",
  "src/components/post-production/templates-integres.ts",
  "src/components/post-production/post-production.tsx",
  "src/components/post-production/library-panel.tsx",
  "src/components/post-production/types.ts",
  "src/lib/video-render.ts",
];

let ok = 0, ko = 0;
const res = (cond, label, detail) => {
  if (cond) { ok++; console.log(`  ✅ ${label}`); }
  else { ko++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`); }
};

console.log("── V3.61 — 1) Syntaxe Babel ──");
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
const ti = sources[FICHIERS[1]];   // templates-integres
const pp = sources[FICHIERS[2]];   // post-production
const lp = sources[FICHIERS[3]];   // library-panel
const ty = sources[FICHIERS[4]];   // types
const vr = sources[FICHIERS[5]];   // video-render

console.log("── 2) Timeline PRO multi-pistes (structure NLE) ──");
res(tp.includes("V1 · Vidéo"), "piste V1 (vidéo) avec en-tête dédié");
res(tp.includes("TX · Textes"), "piste TX (textes) dédiée");
res(tp.includes("IMG · Images"), "piste IMG (images/stickers) dédiée");
res(/A\{i \+ 1\}|A1 · Audio/.test(tp), "pistes audio A1..An (une voie par piste)");
res(tp.includes("règle temporelle") || tp.includes("Règle temporelle"), "règle temporelle (graduations)");
res(tp.includes("Tête de lecture") || tp.includes("tête de lecture"), "tête de lecture (playhead)");
res(tp.includes("scrub"), "scrub (glisser la tête de lecture)");
res(tp.includes("pxParSec"), "zoom pixels/seconde");
res(tp.includes("Maximize2"), "bouton « Ajuster » à la fenêtre");
res(tp.includes("onReorderClip"), "réordonnancement des clips par glisser");
res(tp.includes("ghostX"), "fantôme de drag visuel");
res(tp.includes("poignées") || tp.includes("GripVertical"), "poignées de trim sur les clips");
res(tp.includes("bordures hachurées") || tp.includes("repeating-linear-gradient(45deg, rgba(153,27,27"), "zones rognées visibles (hachures rouges)");
res(tp.includes("onOpenTransitions"), "badges transitions cliquables → onglet Transitions");
res(tp.includes("application/x-pp-audio"), "zone de drop audio depuis la Bibliothèque");
res(tp.includes("application/x-pp-video"), "zone de drop vidéo depuis la Bibliothèque");
res(tp.includes("mute") || tp.includes("Rendre muette"), "bouton muet par piste audio");
res(tp.includes("forme d'onde"), "motif forme d'onde sur les blocs audio");
res(tp.includes("DropAudioData"), "contrat DropAudioData exporté");
res(tp.includes("DropVideoData"), "contrat DropVideoData exporté");

console.log("── 3) Templates intégrés personnalisables ──");
res(ti.includes("TEMPLATES_INTEGRES"), "catalogue TEMPLATES_INTEGRES exporté");
const nbTpl = (ti.match(/id: "[a-z-]+",\s*\n?\s*nom:/g) || []).length;
res(nbTpl >= 8, `≥ 8 templates intégrés (${nbTpl})`);
for (const t of ["intro-titre-dore", "intro-gospel-cine", "outro-abonne-capcut", "lower-third", "compte-rebours", "ecran-fin-louange", "intro-vhs-retro", "habillage-social"]) {
  res(ti.includes(`id: "${t}"`), `template ${t}`);
}
res(ti.includes("100 % PERSONNALISABLES") || ti.includes("100 % personnalisables"), "positionnement CapCut (éditable après application)");
res(ti.includes("stickersSvg"), "stickers du catalogue V3.60 réutilisés");
res(ti.includes("resultat.videoFilter") || ti.includes("videoFilter?:"), "filtres V3.60 appliquables par template");
res(ti.includes("colorAdjust"), "étalonnage V3.60 appliquable par template");
res(ti.includes("transitions?:"), "transitions appliquables par template");
// stickers référencés existent VRAIMENT dans le catalogue
const cat = fs.readFileSync(path.join(ROOT, "src/components/post-production/sticker-catalog.ts"), "utf8");
const idsUtilises = [...ti.matchAll(/sticker\("([a-z-]+)"\)/g)].map((m) => m[1]);
res(idsUtilises.length > 0, `stickers référencés par les templates (${idsUtilises.length})`);
for (const id of idsUtilises) {
  res(cat.includes(`id: "${id}"`), `sticker « ${id} » existe dans le catalogue`);
}

console.log("── 4) Intégration post-production.tsx ──");
res(pp.includes("TimelinePro"), "composant TimelinePro importé");
res(pp.includes("<TimelinePro"), "TimelinePro rendu (remplace l'ancienne timeline)");
res(!pp.includes('widthPercent = totalDuration > 0'), "ancienne timeline proportionnelle SUPPRIMÉE");
res(pp.includes("reordonnerClip"), "handler réordonnerClip");
res(pp.includes("majTrimClip"), "handler majTrimClip (dureeSource)");
res(pp.includes("dureeSource?: number"), "champ dureeSource (rogner en plusieurs fois)");
res(pp.includes("majPisteAudio"), "handler majPisteAudio");
res(pp.includes("deposerAudio"), "handler deposerAudio (drop audio)");
res(pp.includes("deposerVideo"), "handler deposerVideo (drop vidéo)");
res(pp.includes("appliquerTemplateIntegre"), "handler appliquerTemplateIntegre");
res(pp.includes("TEMPLATES_INTEGRES.map"), "templates intégrés dans le menu Templates");
res(pp.includes("mesurer la durée des pistes audio") || (pp.includes("Mesurer la durée") && pp.includes("audio")), "mesure automatique des durées audio");
res(pp.includes("setTotalDuration(next.reduce"), "totalDuration = somme des clips après trim/insertion");
res(pp.includes("format propriétaire") || pp.includes("logiciels de bureau"), "explication honnête sur les templates Mixkit (formats bureau)");

console.log("── 5) Bibliothèque draggable ──");
res(lp.includes("draggable"), "items de bibliothèque draggables");
res(lp.includes("application/x-pp-audio"), "dataTransfer audio (sons + musiques)");
res(lp.includes("application/x-pp-video"), "dataTransfer vidéo");
res(lp.includes("effectAllowed"), "effectAllowed copy");

console.log("── 6) Correctif export audio (video-render.ts) ──");
res(vr.includes("adelay="), "adelay appliqué (startTime honoré)");
res(vr.includes("all=1"), "adelay toutes voies (stéréo)");
res(vr.includes("audioDurees"), "durées audio sondées (probeFile)");
res(vr.includes("fadeOutSt"), "fondu de sortie calé sur la durée réelle");
res(vr.includes("const fadeOutSt = duree > 0 ? Math.max(0, duree - fadeOut) : 9999"), "ancien st=9999 magique remplacé (repli conditionnel)");
// ⚠️ ORDRE des filtres : afade/volume AVANT adelay
const debut = vr.indexOf("let aFilter = `[${audioIdx}:a]`");
const fin = vr.indexOf("audioChains.push(aFilter);", debut);
res(debut >= 0 && fin > debut, "chaîne audio localisée");
if (debut >= 0 && fin > debut) {
  const bloc = vr.slice(debut, fin);
  const idxFade = bloc.indexOf("afade=");
  const idxVol = bloc.indexOf("volume=${vol}");
  const idxDelay = bloc.indexOf("adelay=");
  res(idxFade >= 0 && idxVol >= 0 && idxDelay > idxFade && idxDelay > idxVol, "ordre correct : afade → volume → adelay (sinon les fonds s'appliquent au silence)");
}
res(ty.includes("duration?: number;") && /duration\?: number/.test(ty.split("AudioTrack")[1] || ""), "AudioTrack.duration (client) déclaré");

console.log(`\n════ RÉSULTAT : ${ok} ✅ / ${ko} ❌ ════`);
process.exit(ko === 0 ? 0 : 1);
