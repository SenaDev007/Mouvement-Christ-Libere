#!/usr/bin/env node
/**
 * ⭐ V3.89 — Vérification PRODUCTION après déploiement.
 *
 * Vérifie les trois chantiers :
 *   A. Annonces back-office (page + API garde JSON + fix 404 pages publiques) ;
 *   B. PWA secrétariat & trésorerie (manifests dédiés accessibles) ;
 *   C. Studio Créatif (API garde JSON + seed templates + pages).
 *
 * Usage : node scripts/verif-v389-prod.mjs
 */

const ADMIN = "https://admin.mouvementchristlibere.com";
const SECRETARIAT = "https://secretariat.mouvementchristlibere.com";
const TRESORERIE = "https://tresorerie.mouvementchristlibere.com";
const PUBLIC_SITE = "https://www.mouvementchristlibere.com";

let passes = 0;
let echecs = 0;

async function check(nom, fn) {
  try {
    await fn();
    passes++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom} — ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── A. Annonces back-office ───────────────────────────────────────────

async function statusDe(url, options) {
  const res = await fetch(url, { redirect: "manual", ...options });
  return res;
}

console.log("— A. Annonces du back-office (super admins) —");

await check("GET /admin/api/annonces sans session → 401 JSON", async () => {
  const res = await statusDe(`${ADMIN}/admin/api/annonces`);
  assert(res.status === 401, `reçu ${res.status}`);
  const body = await res.json();
  assert(body.error, "pas de champ error");
});

await check("POST /admin/api/annonces sans session → 401 JSON", async () => {
  const res = await statusDe(`${ADMIN}/admin/api/annonces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x", content: "y" }),
  });
  assert(res.status === 401, `reçu ${res.status}`);
});

await check("/admin/annonces sans session → redirection login (page protégée)", async () => {
  const res = await statusDe(`${ADMIN}/admin/annonces`);
  assert([302, 307, 308].includes(res.status), `reçu ${res.status}`);
  assert(
    (res.headers.get("location") || "").includes("/admin/login"),
    "ne redirige pas vers le login"
  );
});

await check("FIX 404 : /rendez-vous sur admin → site public", async () => {
  const res = await statusDe(`${ADMIN}/rendez-vous`);
  assert([301, 302, 307, 308].includes(res.status), `reçu ${res.status}`);
  const loc = res.headers.get("location") || "";
  assert(
    loc.startsWith(PUBLIC_SITE.replace("www.", "")) || loc.includes("mouvementchristlibere.com/rendez-vous"),
    `location inattendue : ${loc}`
  );
});

await check("FIX 404 : /rendez-vous sur secrétariat → site public", async () => {
  const res = await statusDe(`${SECRETARIAT}/rendez-vous`);
  assert([301, 302, 307, 308].includes(res.status), `reçu ${res.status}`);
});

await check("FIX 404 : /annonces sur admin → module /admin/annonces", async () => {
  const res = await statusDe(`${ADMIN}/annonces`);
  assert([307, 302].includes(res.status), `reçu ${res.status}`);
  assert(
    (res.headers.get("location") || "").includes("/admin/annonces"),
    "ne redirige pas vers /admin/annonces"
  );
});

await check("/secretariat/annonces (login requis — page du module)", async () => {
  const res = await statusDe(`${SECRETARIAT}/secretariat/annonces`);
  assert([302, 307, 308].includes(res.status), `reçu ${res.status}`);
});

// ─── B. PWA secrétariat & trésorerie ───────────────────────────────────

console.log("— B. PWA espaces secrétariat & trésorerie —");

await check("manifest-secretariat.webmanifest servi (200, JSON)", async () => {
  const res = await fetch(`${SECRETARIAT}/manifest-secretariat.webmanifest`);
  assert(res.status === 200, `reçu ${res.status}`);
  const manifest = await res.json();
  assert(manifest.name === "Secrétariat Christ Libère", "nom incorrect");
  assert(manifest.start_url === "/secretariat/dashboard", "start_url incorrect");
});

await check("manifest-tresorerie.webmanifest servi (200, JSON)", async () => {
  const res = await fetch(`${TRESORERIE}/manifest-tresorerie.webmanifest`);
  assert(res.status === 200, `reçu ${res.status}`);
  const manifest = await res.json();
  assert(manifest.name === "Trésorerie Christ Libère", "nom incorrect");
});

await check("Le layout secrétariat référence SON manifest", async () => {
  const res = await fetch(`${SECRETARIAT}/secretariat/login`);
  const html = await res.text();
  assert(
    html.includes("manifest-secretariat.webmanifest"),
    "manifest non lié dans le HTML du secrétariat"
  );
});

await check("Le layout trésorerie référence SON manifest", async () => {
  const res = await fetch(`${TRESORERIE}/tresorerie/login`);
  const html = await res.text();
  assert(
    html.includes("manifest-tresorerie.webmanifest"),
    "manifest non lié dans le HTML de la trésorerie"
  );
});

// ─── C. Studio Créatif ────────────────────────────────────────────────

console.log("— C. MCL Creative Studio —");

await check("GET /admin/api/studio/templates sans session → 401 JSON", async () => {
  const res = await statusDe(`${ADMIN}/admin/api/studio/templates`);
  assert(res.status === 401, `reçu ${res.status}`);
});

await check("GET /secretariat/api/studio/templates sans session → 401 JSON", async () => {
  const res = await statusDe(`${SECRETARIAT}/secretariat/api/studio/templates`);
  assert(res.status === 401, `reçu ${res.status}`);
});

await check("POST /admin/api/studio/generate sans session → 401 JSON", async () => {
  const res = await statusDe(`${ADMIN}/admin/api/studio/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert(res.status === 401, `reçu ${res.status}`);
});

await check("Polices studio servies (Anton TTF)", async () => {
  const res = await fetch(`${ADMIN}/fonts/studio/Anton-Regular.ttf`);
  assert(res.status === 200, `reçu ${res.status}`);
  const tampon = await res.arrayBuffer();
  assert(tampon.byteLength > 50000, `taille suspecte : ${tampon.byteLength}`);
});

await check("/admin/studio sans session → redirection login", async () => {
  const res = await statusDe(`${ADMIN}/admin/studio`);
  assert([302, 307, 308].includes(res.status), `reçu ${res.status}`);
});

await check("/secretariat/studio sans session → redirection login", async () => {
  const res = await statusDe(`${SECRETARIAT}/secretariat/studio`);
  assert([302, 307, 308].includes(res.status), `reçu ${res.status}`);
});

await check("Aucune régression : /admin/dashboard sans session → login", async () => {
  const res = await statusDe(`${ADMIN}/admin/dashboard`);
  assert([302, 307, 308].includes(res.status), `reçu ${res.status}`);
});

await check("Aucune régression : site public /annonces (200)", async () => {
  const res = await fetch(`${PUBLIC_SITE}/annonces`);
  assert(res.status === 200, `reçu ${res.status}`);
});

console.log(`\n═══ BILAN : ${passes} ✓ / ${echecs} ✗ ═══`);
process.exit(echecs > 0 ? 1 : 0);
