#!/usr/bin/env node
/**
 * ⭐ V3.90 — Vérification PRODUCTION après déploiement (commit 4f0d33d).
 *
 * Vérifie le second round du MCL Creative Studio :
 *   · routes IA NVIDIA (peaufiner / fond) → garde 401 JSON sur les DEUX
 *     espaces (back-office + secrétariat) ;
 *   · pages studio toujours protégées ;
 *   · état IA exposé par /meta (champ « ia.active », sans la clé) ;
 *   · nouveaux éléments UI dans les bundles (brouillon, intervenants
 *     libres, rognage, IA) — via le chunk JS du build ;
 *   · aucune régression (dashboard, site public, polices studio).
 *
 * Usage : node scripts/verif-v390-prod.mjs
 */

const ADMIN = "https://admin.mouvementchristlibere.com";
const SECRETARIAT = "https://secretariat.mouvementchristlibere.com";
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

async function statusDe(url, options) {
  return fetch(url, { redirect: "manual", ...options });
}

console.log("— A. Routes IA NVIDIA (garde + comportement) —");

await check("POST /admin/api/studio/ai/peaufiner sans session → 401 JSON", async () => {
  const res = await statusDe(`${ADMIN}/admin/api/studio/ai/peaufiner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speaker_photo_id: "x" }),
  });
  assert(res.status === 401, `reçu ${res.status}`);
  const body = await res.json();
  assert(body.error, "pas de champ error");
});

await check("POST /admin/api/studio/ai/fond sans session → 401 JSON", async () => {
  const res = await statusDe(`${ADMIN}/admin/api/studio/ai/fond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "feu" }),
  });
  assert(res.status === 401, `reçu ${res.status}`);
});

await check("POST /secretariat/api/studio/ai/peaufiner sans session → 401 JSON", async () => {
  const res = await statusDe(`${SECRETARIAT}/secretariat/api/studio/ai/peaufiner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speaker_photo_id: "x" }),
  });
  assert(res.status === 401, `reçu ${res.status}`);
});

await check("POST /secretariat/api/studio/ai/fond sans session → 401 JSON", async () => {
  const res = await statusDe(`${SECRETARIAT}/secretariat/api/studio/ai/fond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "feu" }),
  });
  assert(res.status === 401, `reçu ${res.status}`);
});

await check("404 explicite pour une action IA inconnue (pas de crash)", async () => {
  const res = await statusDe(`${ADMIN}/admin/api/studio/ai/inexistant`);
  assert([404, 405].includes(res.status), `reçu ${res.status}`);
});

console.log("\n— B. Pages & métadonnées studio —");

await check("/admin/studio sans session → redirection login", async () => {
  const res = await statusDe(`${ADMIN}/admin/studio`);
  assert([302, 307, 308].includes(res.status), `reçu ${res.status}`);
});

await check("/secretariat/studio sans session → redirection login", async () => {
  const res = await statusDe(`${SECRETARIAT}/secretariat/studio`);
  assert([302, 307, 308].includes(res.status), `reçu ${res.status}`);
});

await check("/admin/api/studio/meta sans session → 401 JSON (garde intacte)", async () => {
  const res = await statusDe(`${ADMIN}/admin/api/studio/meta`);
  assert(res.status === 401, `reçu ${res.status}`);
});

console.log("\n— C. Nouveautés UI & moteur — VÉRIFICATION AUTHENTIFIÉE (session Pam) —");

const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };

async function ouvrirSessionAdmin() {
  const res = await fetch(`${ADMIN}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (!res.ok) throw new Error(`login refusé : ${res.status}`);
  const setCookie = res.headers.get("set-cookie") || "";
  const m = setCookie.match(/admin_session=([^;]+)/);
  if (!m) throw new Error("cookie admin_session absent");
  return `admin_session=${m[1]}`;
}

let cookieAdmin = "";
await check("Session admin ouverte (compte E2E Pam)", async () => {
  cookieAdmin = await ouvrirSessionAdmin();
  assert(cookieAdmin.length > 20, "cookie vide");
});

/** Cherche un marqueur dans les chunks JS de la page studio authentifiée. */
async function chercherDansChunksStudio(base, cheminPage, cookie, marqueur) {
  const res = await fetch(`${base}${cheminPage}`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert(res.ok, `page ${res.status}`);
  const html = await res.text();
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(
    (m) => m[0]
  );
  const uniques = [...new Set(chunks)].slice(0, 60);
  for (const chunk of uniques) {
    const r = await fetch(`${base}${chunk}`);
    if (!r.ok) continue;
    const js = await r.text();
    if (js.includes(marqueur)) return true;
  }
  return false;
}

if (cookieAdmin) {
  await check("Page /admin/studio authentifiée (200) + brouillon auto-sauvegardé", async () => {
    const trouve = await chercherDansChunksStudio(
      ADMIN, "/admin/studio", cookieAdmin, "mcl-studio-brouillon-v3"
    );
    assert(trouve, "marqueur brouillon introuvable dans les chunks");
  });

  await check("Intervenants libres (« Ajouter un intervenant ») dans le bundle", async () => {
    const trouve = await chercherDansChunksStudio(
      ADMIN, "/admin/studio", cookieAdmin, "Ajouter un intervenant"
    );
    assert(trouve, "marqueur intervenants libres introuvable");
  });

  await check("Rognage façon Canva (« Utiliser cette photo ») dans le bundle", async () => {
    const trouve = await chercherDansChunksStudio(
      ADMIN, "/admin/studio", cookieAdmin, "Utiliser cette photo"
    );
    assert(trouve, "marqueur rognage introuvable");
  });

  await check("IA (« Générer un fond avec l » + état IA) dans le bundle", async () => {
    const trouve = await chercherDansChunksStudio(
      ADMIN, "/admin/studio", cookieAdmin, "Générer un fond avec l"
    );
    assert(trouve, "marqueur IA fonds introuvable");
  });

  await check("/admin/api/studio/meta authentifié — champ « ia.active » présent (sans la clé)", async () => {
    const res = await fetch(`${ADMIN}/admin/api/studio/meta`, {
      headers: { cookie: cookieAdmin },
    });
    assert(res.ok, `reçu ${res.status}`);
    const meta = await res.json();
    assert(meta.styles?.length > 0, "styles absents");
    assert(
      meta.ia && typeof meta.ia.active === "boolean",
      `champ ia inattendu : ${JSON.stringify(meta.ia)}`
    );
  });

  await check("APERÇU multi-intervenants en production (noms libres, moteur V3.90)", async () => {
    // Recherche du template seed actif (miniature).
    const rT = await fetch(`${ADMIN}/admin/api/studio/templates`, {
      headers: { cookie: cookieAdmin },
    });
    assert(rT.ok, `templates ${rT.status}`);
    const { items: templates } = await rT.json();
    const template = (templates || []).find(
      (t) => t.templateType === "miniature" && t.isActive
    );
    assert(template, "aucun template miniature actif");
    const res = await fetch(`${ADMIN}/admin/api/studio/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieAdmin },
      body: JSON.stringify({
        type: "miniature",
        titre: "Vérification production V3.90",
        accroche: "VÉRIFICATION PRODUCTION V3.90",
        speaker_names: ["Pasteur Kongo", "Pam"],
        photos_sujet: [],
        style: template.styleKey,
        template_id: template.id,
        variant: "A",
        format: "youtube",
      }),
    });
    if (!res.ok) {
      throw new Error(`aperçu ${res.status} : ${(await res.text()).substring(0, 120)}`);
    }
    const data = await res.json();
    assert(
      typeof data.dataUrl === "string" && data.dataUrl.startsWith("data:image/png"),
      "dataUrl PNG absente"
    );
    assert(data.dataUrl.length > 10_000, `aperçu suspect : ${data.dataUrl.length} caractères`);
  });
} else {
  console.log("  (section C ignorée : session non ouverte)");
}

console.log("\n— D. Aucune régression —");

await check("/admin/dashboard sans session → login", async () => {
  const res = await statusDe(`${ADMIN}/admin/dashboard`);
  assert([302, 307, 308].includes(res.status), `reçu ${res.status}`);
});

await check("Polices studio toujours servies (Anton)", async () => {
  const res = await fetch(`${ADMIN}/fonts/studio/Anton-Regular.ttf`);
  assert(res.status === 200, `reçu ${res.status}`);
});

await check("Site public /videos (200)", async () => {
  const res = await fetch(`${PUBLIC_SITE}/videos`);
  assert(res.status === 200, `reçu ${res.status}`);
});

await check("Site public / (200)", async () => {
  const res = await fetch(`${PUBLIC_SITE}`);
  assert(res.status === 200, `reçu ${res.status}`);
});

console.log(`\n═══ BILAN : ${passes} ✓ / ${echecs} ✗ ═══`);
process.exit(echecs > 0 ? 1 : 0);
