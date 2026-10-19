#!/usr/bin/env node
/**
 * ⭐ V4.18 — Validation locale : plafond du stockage gratuit Cloudflare R2.
 *
 * 1) Parse Babel des 4 fichiers touchés :
 *    - src/lib/r2.ts (usagePrefixeR2 + listerObjetsR2)
 *    - src/lib/tiktok-video.ts (plafond 9 Go + gardes)
 *    - src/app/api/tiktok/pont/route.ts (presign plafonné)
 *    - src/app/admin/api/r2-usage/route.ts (NOUVEAU : mesure + retrait)
 * 2) Vérifications structurelles clés.
 */
const fs = require("fs");
const babel = require("/home/z/my-project/.tmp-babel/node_modules/@babel/parser");

const BASE = "/home/z/my-project/mouvement-christ-libere";
const FICHIERS = [
  ["r2.ts", `${BASE}/src/lib/r2.ts`],
  ["tiktok-video.ts", `${BASE}/src/lib/tiktok-video.ts`],
  ["pont/route.ts", `${BASE}/src/app/api/tiktok/pont/route.ts`],
  ["r2-usage/route.ts", `${BASE}/src/app/admin/api/r2-usage/route.ts`],
];

let ok = 0, ko = 0;
const check = (label, cond) => {
  if (cond) { ok++; console.log(`  ✔ ${label}`); }
  else { ko++; console.log(`  ✘ ${label}`); }
};

console.log("① Parse Babel :");
const sources = {};
for (const [nom, chemin] of FICHIERS) {
  const src = fs.readFileSync(chemin, "utf8");
  sources[nom] = src;
  let message = null;
  try {
    babel.parse(src, {
      sourceType: "module",
      plugins: ["typescript"],
    });
  } catch (e) {
    message = e.message;
  }
  check(`parse ${nom}${message ? " — " + message : ""}`, !message);
}

console.log("② Structure :");
const r2 = sources["r2.ts"];
check("r2.ts exporte usagePrefixeR2", /export async function usagePrefixeR2/.test(r2));
check("r2.ts exporte listerObjetsR2", /export async function listerObjetsR2/.test(r2));
check("r2.ts usagePrefixeR2 somme les Size", /objet\.Size \?\? 0/.test(r2));
check("r2.ts liste paginée (ContinuationToken)", r2.includes("ContinuationToken"));

const tv = sources["tiktok-video.ts"];
check("tiktok-video.ts PLAFOND 9 Go", tv.includes("9 * 1024 * 1024 * 1024"));
check("tiktok-video.ts exporte plafondMp4TiktokAtteint", /export async function plafondMp4TiktokAtteint/.test(tv));
check("tiktok-video.ts sauvegarde vérifie le plafond AVANT", /usageAvant\.octets \+ octets\.length > PLAFOND_MP4_TIKTOK_OCTETS/.test(tv));
check("tiktok-video.ts sauvegarde refuse si usage ≥ plafond", /usageAvant\.octets >= PLAFOND_MP4_TIKTOK_OCTETS/.test(tv));
check("tiktok-video.ts backfill break sur plafond", /plafondMp4TiktokAtteint\(\)\) \{\s*\n\s*plafondAtteint = true;\s*\n\s*break;/.test(tv));
check("tiktok-video.ts importe usagePrefixeR2 depuis r2", /usagePrefixeR2 \} from "@\/lib\/r2"/.test(tv));

const pont = sources["pont/route.ts"];
check("pont presign vérifie le plafond", pont.includes("usagePrefixeR2(PREFIXE_MP4_TIKTOK)"));
check("pont importe les constantes du plafond", pont.includes("PLAFOND_MP4_TIKTOK_OCTETS"));
check("pont refuser avec 503", /status: 503/.test(pont));

const usage = sources["r2-usage/route.ts"];
check("r2-usage GET authentifié (verifySessionToken)", usage.includes("verifySessionToken"));
check("r2-usage POST mode retirer-mp4", usage.includes('"retirer-mp4"'));
check("r2-usage garde clé videos/tiktok-", usage.includes("cle.startsWith(PREFIXE_MP4_TIKTOK)"));
check("r2-usage remet tiktokMp4Url à null", /tiktokMp4Url: null/.test(usage));
check("r2-usage limite 200 par appel", usage.includes("200"));
check("r2-usage borne gratuite 10 Go", usage.includes("10 * 1024 * 1024 * 1024"));

console.log(`\nRésultat : ${ok} ✔ / ${ko} ✘`);
process.exit(ko > 0 ? 1 : 0);
