#!/usr/bin/env node
/**
 * ⭐ V3.98 — Vérification PRODUCTION après déploiement (commit 019e7d7).
 *
 * 1. NAVBAR : absente de TOUTES les pages /admin/* (session authentifiée),
 *    toujours présente sur le site public.
 * 2. THÈME WIN AGRO : fond violet nuit, panneaux sombres, classe bo-winagro,
 *    titres serif — sur les modules admin (dashboard, serviteurs,
 *    enseignements…) et les pages staff (secrétariat, trésorerie).
 * 3. PAGES PUBLIQUES : héros Win Agro sur afrika, pasteur-kongo, disperses,
 *    adoration, vidéos (badge ping, serif, halos).
 * 4. TEMPS DE RÉPONSE : le site public répond vite (retour « trop de temps
 *    pour répondre » du pasteur).
 *
 * Usage : node scripts/verif-v398-prod.mjs
 */

const ADMIN = "https://admin.mouvementchristlibere.com";
const SECRETARIAT = "https://secretariat.mouvementchristlibere.com";
const TRESORERIE = "https://tresorerie.mouvementchristlibere.com";
const PUBLIC_SITE = "https://www.mouvementchristlibere.com";

let passes = 0, echecs = 0;

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
function assert(c, m) { if (!c) throw new Error(m); }

async function page(url, opts = {}) {
  const t0 = Date.now();
  const res = await fetch(url, { redirect: "manual", ...opts });
  const html = await res.text();
  return { res, html, ms: Date.now() - t0 };
}

// ── Session admin (compte E2E Pam) ─────────────────────────────────────
const IDENTIFIANTS = { name: "pam@christlibere.org", password: "PamChristLibere2026!" };

async function ouvrirSession(base, champ = "admin_session") {
  const res = await fetch(`${base}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (!res.ok) throw new Error(`login refusé : ${res.status}`);
  const setCookie = res.headers.get("set-cookie") || "";
  const m = setCookie.match(new RegExp(`${champ}=([^;]+)`));
  if (!m) throw new Error(`cookie ${champ} absent`);
  return `${champ}=${m[1]}`;
}

console.log("— A. Session & navbar —");

let cookieAdmin = "";
await check("Session admin ouverte (compte E2E Pam)", async () => {
  cookieAdmin = await ouvrirSession(ADMIN);
});

// Le wrapper public LayoutShell ajoute pt-16 md:pt-20 quand la navbar
// est affichée ; le ContextualNav rend le lien « Rendez-vous ».
const MARQUEURS_NAVBAR = ['pt-16 md:pt-20'];

for (const chemin of ["/admin/dashboard", "/admin/servants", "/admin/teachings", "/admin/videos", "/admin/testimonies"]) {
  await check(`navbar publique ABSENTE de ${chemin}`, async () => {
    const { res, html } = await page(`${ADMIN}${chemin}`, { headers: { cookie: cookieAdmin } });
    assert(res.ok, `page ${res.status}`);
    for (const m of MARQUEURS_NAVBAR) {
      assert(!html.includes(m), `marqueur navbar « ${m} » trouvé !`);
    }
  });
}

await check("navbar publique PRÉSENTE sur l'accueil public", async () => {
  const { html } = await page(`${PUBLIC_SITE}/`);
  const avec = MARQUEURS_NAVBAR.some((m) => html.includes(m)) || html.includes('id="contextual-nav"') || html.includes("Rendez-vous");
  assert(avec, "aucun marqueur navbar sur l'accueil");
});

console.log("\n— B. Thème Win Agro des modules admin (authentifié) —");

for (const chemin of ["/admin/dashboard", "/admin/servants", "/admin/teachings", "/admin/videos", "/admin/donations", "/admin/users", "/admin/lives"]) {
  await check(`${chemin} : violet nuit + panneaux sombres + serif`, async () => {
    const { res, html } = await page(`${ADMIN}${chemin}`, { headers: { cookie: cookieAdmin } });
    assert(res.ok, `page ${res.status}`);
    assert(html.includes("bo-winagro"), "classe bo-winagro absente (shell)");
    assert(html.includes("bg-[#150920]") || html.includes("150920"), "fond violet nuit absent");
    assert(html.includes("#1A0826]/70") || html.includes("1A0826", ), "panneaux sombres absents");
    assert(html.includes("font-serif"), "typographie serif absente");
  });
}

await check("dashboard admin : hero Win Agro (badge ping + grain + soulignement)", async () => {
  const { html } = await page(`${ADMIN}/admin/dashboard`, { headers: { cookie: cookieAdmin } });
  assert(html.includes("animate-ping"), "badge ping absent");
  assert(html.includes("bg-grain-dark"), "grain sombre absent");
  assert(html.includes("animate-pulse-slow"), "halo pulsant absent");
  assert(html.includes("font-black font-serif") || html.includes("font-serif font-black"), "KPI serif black absent");
});

console.log("\n— C. Espaces staff (secrétariat & trésorerie) —");

for (const [nom, base] of [["Secrétariat", SECRETARIAT], ["Trésorerie", TRESORERIE]]) {
  await check(`${nom} : login 200`, async () => {
    const { res } = await page(`${base}${nom === "Secrétariat" ? "/secretariat" : "/tresorerie"}/login`);
    assert(res.status === 200, `reçu ${res.status}`);
  });
}

console.log("\n— D. Pages publiques : héros Win Agro —");

const HEROS = [
  ["/afrika", ["animate-ping", "animate-pulse-slow", "scaleX"]],
  ["/pasteur-kongo", ["animate-ping", "animate-pulse-slow"]],
  ["/disperses", ["animate-ping", "animate-pulse-slow"]],
  ["/adoration-louanges", ["animate-ping", "font-serif"]],
  ["/videos", ["animate-ping", "font-serif"]],
  ["/enseignements", ["page-hero-min-h"]],
  ["/temoignages", ["page-hero-min-h"]],
  ["/contribuer", ["page-hero-min-h"]],
  ["/bible", ["page-hero-min-h"]],
];
for (const [chemin, marqueurs] of HEROS) {
  await check(`${chemin} : héros Win Agro`, async () => {
    const { res, html } = await page(`${PUBLIC_SITE}${chemin}`);
    assert(res.ok, `page ${res.status}`);
    for (const m of marqueurs) assert(html.includes(m), `marqueur « ${m} » absent`);
  });
}

console.log("\n— E. Temps de réponse (retour « trop de temps pour répondre ») —");

for (const chemin of ["/", "/enseignements", "/videos", "/contribuer", "/afrika", "/disperses"]) {
  await check(`${chemin} répond < 3 s`, async () => {
    const { ms, res } = await page(`${PUBLIC_SITE}${chemin}`);
    assert(res.status === 200, `reçu ${res.status}`);
    assert(ms < 3000, `${ms} ms`);
  });
}

console.log(`\n═══════ RÉSULTAT : ${passes} ✓ / ${echecs} ✗ ═══════`);
process.exit(echecs > 0 ? 1 : 0);
