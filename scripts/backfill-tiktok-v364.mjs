#!/usr/bin/env node
/**
 * ⭐ V3.64 — Backfill des miniatures TikTok en PRODUCTION.
 *
 * Usage :
 *   node scripts/backfill-tiktok-v364.mjs            → jusqu'à 16 lots
 *   node scripts/backfill-tiktok-v364.mjs --lots 8   → 8 lots maximum
 *   node scripts/backfill-tiktok-v364.mjs --fin      → boucle complète
 *
 * Les 336 vidéos TikTok (rubrique « Saint-Esprit réponds-moi ») n'ont pas
 * de miniature : l'oEmbed TikTok est inaccessible depuis le bac de
 * développement (région bloquée) mais la PRODUCTION (Vercel, cdg1/Paris)
 * joint TikTok normalement. Ce script appelle donc la route
 * /api/tiktok/backfill SUR LA PRODUCTION (le fetch TikTok + le téléversement
 * R2 tournent côté Vercel) jusqu'à ce que TOUTES les vidéos TikTok aient
 * une miniature PERMANENTE (R2, prefixe thumbnails/tiktok-<id>).
 *
 * ① connexion admin (cookie de session) ;
 * ② boucle : POST { limite: 15, exclure: [échecs connus] } — chaque appel
 *    traite ≤ 15 vidéos (~1-2 s chacune) ; les ids en échec (vidéos
 *    supprimées/privées côté TikTok) sont mémorisés dans
 *    scripts/backfill-echecs-v364.json et EXCLUS des lots suivants (ils ne
 *    consomment plus aucun slot) ;
 * ③ arrêt : restantes = 0, OU compte stable, OU plafond de lots de CET
 *    exécution (recommencer relance là où la base s'est arrêtée — la route
 *    est idempotente) ;
 * ④ contrôle final : compte des TikTok avec miniature via /api/videos.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.mouvementchristlibere.com";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };
const FICHIER_ECHECS = path.resolve(import.meta.dirname, "backfill-echecs-v364.json");

// Arguments : --lots N (défaut 16) ou --fin (plafond 40).
const args = process.argv.slice(2);
let MAX_LOTS = 16;
if (args.includes("--fin")) MAX_LOTS = 40;
else {
  const idx = args.indexOf("--lots");
  if (idx >= 0 && Number.isFinite(Number(args[idx + 1]))) {
    MAX_LOTS = Math.max(1, Math.trunc(Number(args[idx + 1])));
  }
}

const cookieJar = new Map();

function retenirCookies(res) {
  const brutes = res.headers.getSetCookie?.() || [];
  for (const c of brutes) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) cookieJar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

function entetesJson() {
  const h = { "content-type": "application/json" };
  if (cookieJar.size > 0) {
    h.cookie = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  return h;
}

function chargerEchecs(): string[] {
  try {
    const d = JSON.parse(fs.readFileSync(FICHIER_ECHECS, "utf8"));
    return Array.isArray(d) ? d.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function sauverEchecs(ids: string[]) {
  fs.writeFileSync(FICHIER_ECHECS, JSON.stringify([...new Set(ids)], null, 2));
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const echecs = chargerEchecs();
  if (echecs.length > 0) {
    console.log(`  ℹ️ ${echecs.length} ids déjà en échec (exclus — vidéos sans miniature oEmbed)`);
  }

  console.log("── ① Connexion admin ──");
  const login = await fetch(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  retenirCookies(login);
  if (!login.ok) throw new Error(`login refusé : ${login.status}`);
  console.log("  ✅ session admin ouverte");

  console.log(`── ② Boucle de backfill (lots de 15, plafond ${MAX_LOTS} lots) ──`);
  let totalMAJ = 0;
  let restantes = null;
  let precedentRestantes = -1;
  let echecsConsecutifs = 0;

  for (let i = 1; i <= MAX_LOTS; i++) {
    const res = await fetch(`${BASE}/api/tiktok/backfill`, {
      method: "POST",
      headers: entetesJson(),
      body: JSON.stringify({ limite: 15, exclure: echecs }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`backfill HTTP ${res.status} ${msg.slice(0, 200)}`);
    }
    const d = await res.json();
    totalMAJ += d.misesAJour || 0;
    restantes = d.restantes ?? null;

    // Mémorisation des échecs de CE lot (exclus aux suivants + persistés).
    if (Array.isArray(d.idsEchecs) && d.idsEchecs.length > 0) {
      echecs.push(...d.idsEchecs);
      sauverEchecs(echecs);
    }

    console.log(
      `  lot ${String(i).padStart(2)} : ${d.traitées} traitées · ${d.misesAJour} miniatures ✅ · restantes ≈ ${restantes} · échecs connus ${echecs.length}`
    );
    if (d.erreurs?.length) {
      console.log(`    ⚠️ ${d.erreurs.length} erreurs (ex. : ${d.erreurs[0]})`);
    }

    if (restantes === 0) {
      console.log("  🎉 plus aucune miniature manquante");
      break;
    }
    // Échecs récurrents : le compte ne baisse plus → arrêt propre.
    if (restantes === precedentRestantes) {
      echecsConsecutifs++;
      if (echecsConsecutifs >= 2) {
        console.log(`  ⏹️ compte stable (${restantes}) — arrêt propre`);
        break;
      }
    } else {
      echecsConsecutifs = 0;
    }
    precedentRestantes = restantes;
    await attendre(700);
  }

  console.log("── ③ Contrôle final (/api/videos) ──");
  const resVideos = await fetch(`${BASE}/api/videos`);
  const data = await resVideos.json();
  const tiktok = (data.videos || []).filter((v) => v.tiktokId);
  const avecMini = tiktok.filter((v) => v.thumbnailUrl);
  console.log(
    `  ${tiktok.length} vidéos TikTok · ${avecMini.length} avec miniature (${tiktok.length ? Math.round((100 * avecMini.length) / tiktok.length) : 0} %)`
  );
  if (restantes !== 0 && restantes !== null) {
    console.log(`  ℹ️ ${restantes} restantes — relancer ce script pour continuer (idempotent)`);
  }
  const sans = tiktok.filter((v) => !v.thumbnailUrl).slice(0, 8);
  for (const v of sans) {
    console.log(`    • sans miniature : ${v.title} (${v.videoUrl || v.tiktokId})`);
  }
  console.log(`\n✅ Exécution terminée : ${totalMAJ} miniatures répliquées sur R2 au total`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
