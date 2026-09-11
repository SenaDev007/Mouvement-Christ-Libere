#!/usr/bin/env node
/**
 * ⭐ V3.65 — Validateur sémantique « lecteur TikTok trop petit » :
 * ① Dimensionnement VIDEO-FIRST : la zone vidéo 9:16 (578 px logiques)
 *    agrandie au max (≤ 486 px, ≤ min(vh−140, 960)) — la contrainte de
 *    hauteur de l'embed COMPLET (V3.64 : vidéo + légende = 780 px)
 *    étranglait la largeur à ~298 px (capture pasteur) ;
 * ② Garde anti-scrollbar V3.64 INTACTE : l'iframe garde sa hauteur
 *    logique exacte (oEmbed) — le clip de la légende est purement
 *    visuel (overflow-hidden de la boîte), jamais un redimensionnement
 *    du viewport de l'iframe ;
 * ③ Replis : diaporamas /photo/ et proxy 502 → dimensionnement V3.64 ;
 * ④ Page publique : conteneur noir pleine largeur SUPPRIMÉ (bandes
 *    mortes ~72 px de chaque côté du lecteur) ;
 * ⑤ Éditeur (mode boîte) : la vidéo remplit la zone d'aperçu portrait.
 * Usage : node scripts/valider-v365.cjs
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "..");
const FICHIERS = [
  "src/components/tiktok/lecteur-tiktok.tsx",
  "src/components/videos/videos-view.tsx",
  "src/components/post-production/post-production.tsx",
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

const le = sources[FICHIERS[0]];   // lecteur-tiktok
const vv = sources[FICHIERS[1]];   // videos-view
const pp = sources[FICHIERS[2]];   // post-production

// ─── 2) Video-first : la vidéo, pas la légende, dimensionne ───
console.log("── 2) LecteurTikTok — dimensionnement video-first ──");
res(le.includes("LARGEUR_LOGIQUE = 325") && le.includes("HAUTEUR_DEFAUT = 780"), "taille logique canonique TikTok conservée (325 × 780)");
res(le.includes("HAUTEUR_VIDEO_LOGIQUE = Math.round((LARGEUR_LOGIQUE * 16) / 9)"), "zone VIDÉO 9:16 définie (578 px logiques — la légende n'entre plus dans le budget)");
res(le.includes("LARGEUR_MAX_PAGE = 486"), "largeur max 486 px (colonne lecteur de TikTok web)");
res(le.includes("const videoFirst = !diaporama && !embedIndisponible"), "video-first activé pour les /video/ et désactivé pour les replis");
res(le.includes('videoUrl.includes("/photo/")'), "diaporamas /photo/ détectés (carrousel ≠ zone vidéo 9:16)");
res(/largAffichee = Math\.max\(180, Math\.floor\(Math\.min\(lMaxZone, \(hMaxZone \* 9\) \/ 16\)\)\)/.test(le), "largeur = min(zone, 486, hauteur×9/16) — la vidéo prend le MAXIMUM de place");
res(le.includes("Math.min(hauteurFenetre - 140, 960)"), "hauteur max mode page = min(vh − 140, 960) (place pour titre + actions)");
res(/hautAffichee = Math\.round\(HAUTEUR_VIDEO_LOGIQUE \* echelle\)/.test(le), "hauteur de boîte = zone vidéo scalée (clip de la légende)");

// ─── 3) Garde anti-scrollbar V3.64 ───
console.log("── 3) Garde anti-scrollbar V3.64 intacte ──");
res(le.includes("width: LARGEUR_LOGIQUE") && le.includes("height: hauteur"), "iframe TOUJOURS à la taille logique exacte (325 × oEmbed) — jamais redimensionnée par le clip");
res(/transform: `scale\(\$\{echelle\}\)`/.test(le) && le.includes("transformOrigin: \"top left\""), "échelle par transform uniforme (aucun reflow de la page TikTok)");
res(/Math\.min\(lMax \/ LARGEUR_LOGIQUE, hMax \/ hauteur\)/.test(le), "repli V3.64 : échelle uniforme de l'embed complet conservée");
res(le.includes("Math.min(Math.max(d.hauteur, 580), 1500)"), "hauteur oEmbed par vidéo bornée 580-1500 (clé anti-scrollbar)");
res(le.includes('Math.min((zone?.l ?? LARGEUR_LOGIQUE) - 24, 425)'), "repli V3.64 mode page : cap 425 conservé");
res(le.includes("hauteurFenetre * 0.78"), "repli V3.64 mode page : 0.78 vh conservé");
res(le.includes("setEmbedIndisponible(true)"), "proxy 502 → repli V3.64 (dimensionnement prouvé, jamais cassé)");

// ─── 4) Poster / chargement (acquis V3.64 conservés) ───
console.log("── 4) Poster + chargement (acquis V3.64) ──");
res(le.includes("miniature || posterRepli") && le.includes("setPosterEchoue"), "poster : miniature R2 prioritaire, repli oEmbed, repli marque");
res(le.includes("onLoad") && le.includes("duration-500") && le.includes("prete"), "fondu enchaîné à l'arrivée du lecteur");
res(le.includes("preconnect") && le.includes("www.tiktok.com"), "preconnect TikTok conservé");
res(le.includes("Ouvrir sur TikTok") && le.includes("afficherLien"), "lien externe conservé (légende clippée → accès direct à la publication)");

// ─── 5) Page publique ───
console.log("── 5) videos-view.tsx — fin des bandes noires ──");
const debutTiktok = vv.indexOf("video.tiktokId ? (");
const finTiktok = vv.indexOf(") : (", debutTiktok);
const brancheTiktok = vv.slice(debutTiktok, finTiktok);
res(brancheTiktok.includes("<LecteurTikTok") && !brancheTiktok.includes("bg-black"), "conteneur noir pleine largeur SUPPRIMÉ autour du lecteur TikTok (capture : 298 px dans 442 px de noir)");
res(brancheTiktok.includes("tiktokId={video.tiktokId}") && brancheTiktok.includes("miniature={video.thumbnailUrl || null}"), "lecteur alimenté : id + URL + miniature R2 (poster instantané)");
res(!/w-full bg-black[^"]*">\s*<LecteurTikTok/.test(vv), "aucun wrapper w-full noir immédiat autour de LecteurTikTok");
res(vv.includes('aspectRatio: "16 / 9"'), "les lecteurs YouTube/vidéo gardent leur cadre 16:9 noir (inchangé)");

// ─── 6) Éditeur post-production ───
console.log("── 6) post-production.tsx — mode boîte video-first ──");
res(pp.includes("<LecteurTikTok") && pp.includes("boite") && pp.includes("extraireTiktokId(currentVideoUrl)"), "aperçu : LecteurTikTok mode boîte conservé");
res(pp.includes('aspectRatio: tiktokMode ? "9 / 16" : previewAspect'), "zone d'aperçu portrait 9:16 pour une source TikTok (la vidéo la remplit désormais)");
res(pp.includes("LARGEUR_MAX_PAGE") === false, "aucune constante lecteur dupliquée dans l'éditeur (source unique : lecteur-tiktok.tsx)");

console.log(`\n═══ V3.65 : ${ok}/${ok + ko} ═══`);
process.exit(ko === 0 ? 0 : 1);
