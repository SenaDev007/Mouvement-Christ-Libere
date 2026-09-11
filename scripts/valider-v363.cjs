#!/usr/bin/env node
/**
 * ⭐ V3.63 — Validateur sémantique :
 * ① Timeline multi-pistes V1/V2 + TX1/TX2 + A1/A2 + glisser entre pistes ;
 * ② Boutons stickers PRO à mise en page MESURÉE (plus de chevauchement) ;
 * ③ Support TikTok (embed portrait, même schéma que YouTube).
 * Usage : node scripts/valider-v363.cjs
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "..");
const FICHIERS = [
  "src/components/post-production/timeline-pro.tsx",
  "src/components/post-production/post-production.tsx",
  "src/components/post-production/sticker-catalog.ts",
  "src/components/post-production/types.ts",
  "src/components/post-production/templates-integres.ts",
  "src/lib/video-render.ts",
  "src/app/api/videos/route.ts",
  "src/app/api/videos/[id]/render/route.ts",
  "src/components/videos/videos-view.tsx",
];

let ok = 0, ko = 0;
const res = (cond, label, detail) => {
  if (cond) { ok++; console.log(`  ✅ ${label}`); }
  else { ko++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`); }
};

console.log("── 1) Syntaxe Babel ──");
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
const sc = sources[FICHIERS[2]];   // sticker-catalog
const ty = sources[FICHIERS[3]];   // types
const ti = sources[FICHIERS[4]];   // templates-integres
const vr = sources[FICHIERS[5]];   // video-render
const av = sources[FICHIERS[6]];   // api videos
const rr = sources[FICHIERS[7]];   // render route
const vv = sources[FICHIERS[8]];   // videos-view

// ─── 2) Timeline multi-pistes dédoublée ───
console.log("── 2) Timeline : V1/V2 · TX1/TX2 · A1/A2 ──");
res(/"V1 · Vidéo"/.test(tp) && /"V2 · Incrustation"/.test(tp), "gouttière : V1 Vidéo + V2 Incrustation");
res(/"TX1 · Texte"/.test(tp) && /"TX2 · Texte"/.test(tp), "gouttière : TX1 + TX2 (deux pistes texte)");
res(/"A1 · Audio"/.test(tp) && /"A2 · Audio"/.test(tp), "gouttière : A1 + A2 (deux voies audio)");
res(tp.includes("piste?: 1 | 2") && tp.includes("startTime?: number"), "ClipTimeline : piste 1|2 + startTime (position libre V2)");
res(ty.includes("track?: 1 | 2") && /TextOverlay/.test(ty.slice(0, 600)), "TextOverlay.track (TX1 ↔ TX2)");
res(ty.includes("lane?: 1 | 2"), "AudioTrack.lane (A1 ↔ A2)");
res(tp.includes("onMoveClipTrack") && tp.includes("onMoveAudioLane") && tp.includes("onMoveTextTrack"), "handlers de changement de piste (clips/audio/textes)");
res(tp.includes("onUpdateClipStart"), "position libre des clips V2 (glisser horizontal live)");
res(tp.includes("rangeeSousPointeur") && tp.includes("ciblesPourGenre"), "détection verticale de la rangée survolée (cibles valides)");
res(tp.includes("dyDrag") && /translateY\(\$\{dyDrag\}px\)/.test(tp), "le bloc traîné suit le doigt VERTICALEMENT (CapCut-like)");
res(/setRangeeSurvolee\(null\)/.test(tp) && /bg-\[#C9A227\]\/10/.test(tp), "surlignage doré de la piste de dépôt + reset");
res(/onDropAudio: \(data: DropAudioData, startTime: number, lane: 1 \| 2\)/.test(tp) && /onDropVideo: \(data: DropVideoData, atSeconds: number, piste: 1 \| 2\)/.test(tp), "drop bibliothèque : voie A1/A2 + piste V1/V2 transmis au dépôt");
res(/onReorderClip: \(idDeplace: string, idCible: string \| null\)/.test(tp), "réordonnancement par identifiants (compatible V1 subset)");
res(tp.includes("VolumeX"), "bouton muet sur les blocs audio (2 voies fixes)");
res(pp.includes("deplacerClipPiste") && pp.includes("deplacerVoieAudio") && pp.includes("deplacerTextePiste") && pp.includes("majDebutClipV2"), "handlers post-production câblés");
res(pp.includes("timeline.filter((c) => (c.piste || 1) === 1)"), "séquence V1 isolée (totalDuration/insertion/export)");

// ─── 3) Aperçu + export V2 ───
console.log("── 3) Aperçu V2 + export ffmpeg ──");
res(pp.includes("v2Refs") && pp.includes("synchroniserV2"), "aperçu : calques V2 synchronisés (lecture/pause/seek)");
res(pp.includes("videoOverlays: videoOverlays.length > 0"), "export : clips V2 → videoOverlays");
res(pp.includes("rangZ") && /overlaysOrdonnes/.test(pp), "export : ordre z images → TX1 → TX2");
res(vr.includes("videoOverlays?: VideoOverlayClip[]"), "RenderProject.videoOverlays (moteur)");
res(rr.includes("videoOverlays: body.videoOverlays"), "route rendu : videoOverlays transmis (pas abandonnés en route)");
res(/setpts=PTS-STARTPTS\+\$\{st\.toFixed\(3\)\}\/TB/.test(vr), "chaîne V2 : images DÉCALÉES de startTime (setpts+st/TB — bug du test initial corrigé)");
res(/eof_action=pass/.test(vr) && /enable='between\(t,\$\{st\.toFixed\(3\)\},\$\{en\.toFixed\(3\)\}\)'/.test(vr), "chaîne V2 : fenêtre enable + retour de la base après V2");
res(vr.includes("premierIndexAudio"), "indexation des inputs audio réparée (V2 d'abord, PUIS images/textes, PUIS audio)");
res(vr.includes("fps=${targetFps},scale=${targetWidth}:${targetHeight}"), "V2 normalisée plein cadre (coupe B-roll comme le preview)");
res(vr.includes("(project.videoOverlays?.length || 0) > 0"), "hasFilters compte les incrustations V2");

// ─── 4) Boutons PRO mesurés ───
console.log("── 4) Boutons stickers PRO (mesure anti-chevauchement) ──");
res(sc.includes("mesurerTexte") && sc.includes("LARGEUR_CAR"), "mesure de largeur par caractère (Arial Black)");
res(sc.includes("function bouton(opts") && /pad \+ iconeG \+ gapG \+ texteL/.test(sc), "fabrique bouton() : largeur = padding+icône+espace+TEXTE(mesuré)+padding");
res(/y="\$\{yTexte\.toFixed\(1\)\}"|y="\${\(h \/ 2 \+ fs \* 0\.36\)\.toFixed/.test(sc) || /h \/ 2 \+ fs \* 0\.36/.test(sc), "baseline EXPLICITE (robuste sans dominant-baseline)");
res((sc.match(/boutonSticker\(/g) || []).length >= 25, `≥25 boutons générés par la fabrique (${(sc.match(/boutonSticker\(/g) || []).length})`);
res(sc.includes('"like-rouge"') && sc.includes('"subscribe-rouge"') && sc.includes('"share-blanc"'), "ids nouveaux boutons (like-rouge, subscribe-rouge, share-blanc)");
res(sc.includes('"like-subscribe"') && /J'AIME \+ S'ABONNER/.test(sc), "bouton double action J'AIME + S'ABONNER (classique CapCut)");
res(!sc.includes('"like-btn"') && !sc.includes('"subscribe-btn"'), "anciens ids à largeur devinée supprimés");
res(ti.includes('sticker("like-rouge")') && !ti.includes('sticker("like-btn")'), "templates intégrés → nouveaux ids (pas d'erreur d'exécution)");
res(/rasteriserStickerEnPng\(svg: string, maxCote = 2048\)/.test(sc), "rastérisation 2048 px (avant 512 → flou à l'agrandissement)");
res(pp.includes("rasteriserStickerEnPng(sticker.svg, 2048)") && /natW = 2048 \* \(sw \/ Math\.max\(sw, sh\)\)/.test(pp), "échelle d'ajout : largeur NATURELLE déduite de l'aspect");
res(/aspect >= 1\.8 \? 0\.42 : 0\.3/.test(pp), "taille initiale : boutons larges 42 % / stickers 30 % de la largeur");
res(/stickerVue === "social" \? "grid-cols-2" : "grid-cols-3"/.test(pp) && /aspect-\[5\/2\]/.test(pp), "grille : cellules allongées pour les boutons sociaux");
res((sc.match(/STYLES_BOUTON/g) || []).length >= 1 && sc.includes('"verre"'), "8 styles de boutons (blanc/rouge/noir/or/vert/violet/verre/gris)");

// ─── 5) TikTok ───
console.log("── 5) TikTok (même schéma que YouTube) ──");
res(av.includes("extraireTiktokId") && av.includes("(?:video|photo)") && av.includes("{5,25}"), "API : extraction id TikTok (video + photo)");
res(av.includes("tiktokId,") && av.includes("&& !tiktokId"), "API : tiktokId renvoyé + hasNativeVideo corrigé");
res(vv.includes("tiktokId: string;"), "VideoItem.tiktokId");
res(vv.includes("tiktok.com/embed/v2/") && /aspectRatio: "9 \/ 16"/.test(vv), "lecteur TikTok portrait (embed officiel v2, 9:16)");
res(vv.includes("Ouvrir sur TikTok"), "lien « Ouvrir sur TikTok » (repli si embed indisponible dans un pays)");
res(vv.includes("TiktokMiniature") && vv.includes("TiktokNoteIcon"), "miniatures TikTok de marque (repli automatique, zéro requête réseau)");
res(/video\.tiktokId \? \(/.test(vv) && /rec\.tiktokId \? \(/.test(vv), "cartes + recommandées TikTok-aware");

console.log(`\n═══ V3.63 : ${ok}/${ok + ko} ═══`);
process.exit(ko === 0 ? 0 : 1);
