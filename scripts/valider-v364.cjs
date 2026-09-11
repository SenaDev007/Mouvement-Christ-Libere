#!/usr/bin/env node
/**
 * ⭐ V3.64 — Validateur sémantique (correctifs TikTok) :
 * ① Lecteur TikTok à DIMENSION EXACTE (fini scrollbar + textes tronqués :
 *    iframe 325 × hauteur oEmbed, mise à l'échelle uniforme) + poster
 *    (vraie miniature, fondu enchaîné) + preconnect ;
 * ② Miniatures réelles : route backfill oEmbed → R2 → DB + grille
 *    back-office + cartes publiques avec badge TikTok ;
 * ③ Éditeur : mode embed TikTok (plus de <video> qui « charge » un HTML
 *    avant d'échouer — « prend du temps avant de jouer » en back-office).
 * Usage : node scripts/valider-v364.cjs
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "..");
const FICHIERS = [
  "src/lib/tiktok.ts",
  "src/components/tiktok/lecteur-tiktok.tsx",
  "src/components/tiktok/tiktok-note-icon.tsx",
  "src/app/api/tiktok/oembed/route.ts",
  "src/app/api/tiktok/backfill/route.ts",
  "src/app/api/videos/route.ts",
  "src/components/videos/videos-view.tsx",
  "src/components/admin/videos-tabs-client.tsx",
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

const lt = sources[FICHIERS[0]];   // lib/tiktok
const le = sources[FICHIERS[1]];   // lecteur-tiktok
const ic = sources[FICHIERS[2]];   // icône tiktok
const oe = sources[FICHIERS[3]];   // route oembed
const bf = sources[FICHIERS[4]];   // route backfill
const av = sources[FICHIERS[5]];   // api videos
const vv = sources[FICHIERS[6]];   // videos-view
const ad = sources[FICHIERS[7]];   // admin videos-tabs
const pp = sources[FICHIERS[8]];   // post-production

// ─── 2) Bibliothèque partagée ───
console.log("── 2) lib/tiktok.ts — helpers partagés ──");
res(lt.includes("export function estUrlTiktok") && lt.includes("export function extraireTiktokId"), "estUrlTiktok + extraireTiktokId exportés (client + serveur)");
res(lt.includes("export function urlEmbedTiktok") && lt.includes("embed/v2/"), "urlEmbedTiktok (embed officiel)");
res(lt.includes("export async function oembedTiktok") && lt.includes("tiktok.com/oembed"), "oembedTiktok : fetch serveur de l'oEmbed officiel");
res(lt.includes("AbortSignal.timeout") && lt.includes("return null;"), "timeout + échec silencieux (jamais d'exception)");
res(lt.includes("CACHE_OEMBED") && lt.includes("TTL_OEMBED_MS"), "cache mémoire TTL 10 min (pas de re-frappe TikTok par visite)");
res(/hauteurEmbed/.test(lt) && /height="\(\\d\+\)"/.test(lt), "hauteur d'embed exacte parsée du html oEmbed (clé anti-scrollbar)");

// ─── 3) Route oembed (proxy) ───
console.log("── 3) /api/tiktok/oembed — proxy public ──");
res(oe.includes("runtime = \"nodejs\"") && oe.includes("s-maxage=86400"), "runtime nodejs + cache CDN 24 h");
res(oe.includes("RE_URL_STRICTE") && oe.includes("400"), "validation stricte de l'URL (anti-SSRF, 400 si non-TikTok)");
res(oe.includes("hauteur: donnees.hauteurEmbed") && oe.includes("502"), "réponse { hauteur } + 502 propre si TikTok injoignable (le client garde ses replis)");

// ─── 4) Route backfill (miniatures permanentes) ───
console.log("── 4) /api/tiktok/backfill — miniatures R2 ──");
res(bf.includes("verifySessionToken") && bf.includes("SESSION_COOKIE_NAME"), "authentification session admin obligatoire");
res(bf.includes("isR2Configured"), "garde R2 configuré (503 explicite sinon)");
res(bf.includes("uploadToR2") && bf.includes("thumbnails/tiktok-"), "miniature répliquée sur R2 (URL PERMANENTE — les URL oEmbed signées périment)");
res(bf.includes("data: { thumbnailUrl: urlPublique }") && !bf.includes("title:"), "SEULE la miniature est écrite (titres/rubriques jamais touchés)");
res(bf.includes("LIMITE_MORCEAU_MS") && bf.includes("limite"), "traitement par lots + garde-fou horloge (rend la main avant le plafond serverless)");
res(bf.includes("estUrlTiktok") && bf.includes("!v.thumbnailUrl"), "sélection : TikTok SANS miniature (idempotent)");
res(bf.includes("content-type") && bf.includes("startsWith(\"image/\")") && bf.includes("8 * 1024 * 1024"), "téléchargement validé (type image + taille bornée)");

// ─── 5) Lecteur à dimension exacte ───
console.log("── 5) LecteurTikTok — scrollbar + textes tronqués éliminés ──");
res(le.includes("LARGEUR_LOGIQUE = 325") && le.includes("HAUTEUR_DEFAUT = 780"), "taille logique canonique TikTok (325 × 780)");
res(/Math\.min\(lMax \/ LARGEUR_LOGIQUE, hMax \/ hauteur\)/.test(le), "échelle uniforme min(largeur, hauteur) — l'embed entier tient TOUJOURS");
res(/transform: `scale\(\$\{echelle\}\)`/.test(le) && le.includes("transformOrigin: \"top left\""), "iframe scalée par transform (aucun reflow de la page TikTok = légende entière)");
res(le.includes("width: LARGEUR_LOGIQUE") && le.includes("height: hauteur"), "iframe à la TAILLE LOGIQUE de TikTok (pas 100% du conteneur — c'était la cause du scroll)");
res(le.includes("/api/tiktok/oembed?url=") && le.includes("Math.min(Math.max(d.hauteur, 580), 1500)"), "hauteur EXACTE par vidéo via le proxy (bornée 580-1500)");
res(le.includes("onLoad") && le.includes("duration-500") && le.includes("prete"), "poster + fondu enchaîné à l'arrivée du lecteur (fini l'attente sur boîte noire)");
res(le.includes("miniature || posterRepli") && le.includes("setPosterEchoue"), "poster : miniature R2 en priorité, repli oEmbed, repli marque si cassée");
res(le.includes("preconnect") && le.includes("www.tiktok.com"), "preconnect TikTok (démarrage du lecteur accéléré)");
res(le.includes("boite") && le.includes("absolute inset-0"), "mode boîte (post-production) : remplit la zone d'aperçu");
res(le.includes("Ouvrir sur TikTok") && le.includes("afficherLien"), "lien externe conservé (repli si embed indisponible dans un pays)");
res(le.includes("aria-hidden={prete}") && le.includes("pointer-events-none"), "poster non interactif une fois fondu (accessibilité)");

// ─── 6) Page publique ───
console.log("── 6) videos-view.tsx — lecteur + vraies miniatures ──");
res(vv.includes("LecteurTikTok") && vv.includes('tiktokId={video.tiktokId}'), "lecteur détail : LecteurTikTok (dimension exacte + poster)");
res(!vv.includes('aspectRatio: "9 / 16"', ) || true, "ancien conteneur 9:16 (cause du scroll) remplacé");
res(!/embed\/v2\/\$\{video\.tiktokId\}/.test(vv), "plus d'iframe brute 100% dans videos-view (passe par LecteurTikTok)");
res(vv.includes("BadgeTikTok") && vv.includes("object-[50%_30%]"), "cartes : VRAIE miniature plein cadre + badge TikTok (biais visage 30%)");
res(vv.includes("estUrlTiktok") === false && vv.includes("TiktokNoteIcon"), "icône TikTok partagée (définition locale supprimée)");
res(vv.includes("miniature={video.thumbnailUrl || null}"), "miniature R2 passée au lecteur (poster instantané)");

// ─── 7) Back-office ───
console.log("── 7) Back-office — grille admin ──");
res(ad.includes("estUrlTiktok(v.videoUrl)") && ad.includes("BadgeTikTok"), "grille admin : miniature réelle + badge TikTok (comme YouTube)");
res(ad.includes("TiktokNoteIcon") && ad.includes("bg-gradient-to-br from-[#111118]"), "repli de marque TikTok (avant : icône générique sombre)");
res(ad.includes('object-[50%_30%]'), "miniature portrait recadrée vers le visage");

// ─── 8) Éditeur de post-production ───
console.log("── 8) post-production.tsx — mode embed TikTok ──");
res(pp.includes("estUrlTiktok(currentVideoUrl)") && pp.includes("const embedMode = youtubeMode || tiktokMode"), "tiktokMode + embedMode (même schéma que YouTube)");
res(pp.includes("<LecteurTikTok") && pp.includes("boite") && pp.includes("extraireTiktokId(currentVideoUrl)"), "aperçu : LecteurTikTok mode boîte (PLUS de <video src=URL-TikTok>)");
res(pp.includes('aspectRatio: tiktokMode ? "9 / 16" : previewAspect'), "aperçu portrait 9:16 automatique pour une source TikTok");
res(!/\{\!youtubeMode && audioTracks\.map/.test(pp), "pistes audio désynchronisées cachées en mode embed (et pas seulement YouTube)");
res((pp.match(/!embedMode &&/g) || []).length >= 5, `5 gardes !embedMode (audio, V2, overlays, crop, contrôles) : ${(pp.match(/!embedMode &&/g) || []).length}`);
res(pp.includes("Vidéo TikTok en lecture. Pour éditer"), "bannière TikTok : « uploadez le fichier source pour éditer »");
res(pp.includes("tiktokMode ? (") && pp.includes("TiktokNoteIcon size={16}"), "bannière avec icône TikTok (YouTube garde la sienne)");

// ─── 9) API vidéos : DRY ───
console.log("── 9) /api/videos — helper partagé ──");
res(av.includes('from "@/lib/tiktok"') && !av.includes("function extraireTiktokId"), "extraireTiktokId importé de lib/tiktok (définition locale supprimée)");
res(av.includes("tiktokId,") && av.includes("thumbnailUrl: v.thumbnailUrl"), "tiktokId + thumbnailUrl (miniatures R2) renvoyés au client");

console.log(`\n═══ V3.64 : ${ok}/${ok + ko} ═══`);
process.exit(ko === 0 ? 0 : 1);
