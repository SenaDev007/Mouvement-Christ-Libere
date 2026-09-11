#!/usr/bin/env node
/**
 * ⭐ V3.64 — Backfill des miniatures TikTok en PRODUCTION.
 *
 * Usage : node scripts/backfill-tiktok-v364.mjs
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
 * ② boucle : POST { limite: 15 } — chaque appel traite ≤ 15 vidéos
 *    (~1-2 s chacune : oEmbed + téléchargement + upload R2) ;
 * ③ arrêt : restantes = 0, OU compte stable (échecs récurrents), OU
 *    plafond d'itérations ;
 * ④ contrôle final : compte des TikTok avec miniature via /api/videos.
 *
 * Idempotent : les vidéos déjà pourvues sont exclues par la route.
 */
const BASE = "https://www.mouvementchristlibere.com";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };

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

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("── ① Connexion admin ──");
  const login = await fetch(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  retenirCookies(login);
  if (!login.ok) throw new Error(`login refusé : ${login.status}`);
  console.log("  ✅ session admin ouverte");

  console.log("── ② Boucle de backfill (lots de 15) ──");
  let totalMAJ = 0;
  let restantes = null;
  let precedentRestantes = -1;
  let echecsConsecutifs = 0;
  const MAX_ITERATIONS = 40;

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const res = await fetch(`${BASE}/api/tiktok/backfill`, {
      method: "POST",
      headers: entetesJson(),
      body: JSON.stringify({ limite: 15 }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`backfill HTTP ${res.status} ${msg.slice(0, 200)}`);
    }
    const d = await res.json();
    totalMAJ += d.misesAJour || 0;
    restantes = d.restantes ?? null;
    console.log(
      `  lot ${String(i).padStart(2)} : ${d.traitées} traitées · ${d.misesAJour} miniatures ✅ · restantes ≈ ${restantes}`
    );
    if (d.erreurs?.length) {
      console.log(`    ⚠️ ${d.erreurs.length} erreurs (ex. : ${d.erreurs[0]})`);
    }

    if (restantes === 0) {
      console.log("  🎉 plus aucune miniature manquante");
      break;
    }
    // Échecs récurrents : le compte ne baisse plus → on arrête proprement
    // (les URLs concernées resteront sans miniature — repli de marque).
    if (restantes === precedentRestantes) {
      echecsConsecutifs++;
      if (echecsConsecutifs >= 3) {
        console.log(`  ⏹️ compte stable (${restantes}) — échecs récurrents, arrêt`);
        break;
      }
    } else {
      echecsConsecutifs = 0;
    }
    precedentRestantes = restantes;
    await attendre(800);
  }

  console.log("── ③ Contrôle final (/api/videos) ──");
  const resVideos = await fetch(`${BASE}/api/videos`);
  const data = await resVideos.json();
  const tiktok = (data.videos || []).filter((v) => v.tiktokId);
  const avecMini = tiktok.filter((v) => v.thumbnailUrl);
  console.log(
    `  ${tiktok.length} vidéos TikTok · ${avecMini.length} avec miniature (${tiktok.length ? Math.round((100 * avecMini.length) / tiktok.length) : 0} %)`
  );
  if (tiktok.length > 0 && avecMini.length < tiktok.length) {
    const sans = tiktok.filter((v) => !v.thumbnailUrl).slice(0, 5);
    for (const v of sans) {
      console.log(`    • sans miniature : ${v.title} (${v.videoUrl || v.tiktokId})`);
    }
  }
  console.log(`\n✅ Terminé : ${totalMAJ} miniatures répliquées sur R2 au total`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
