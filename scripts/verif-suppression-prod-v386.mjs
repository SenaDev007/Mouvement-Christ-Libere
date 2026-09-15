#!/usr/bin/env node
/**
 * ⭐ V3.86 — VÉRIFICATION PRODUCTION de la suppression définitive.
 *
 * Scénario complet (le même que le nettoyage du pasteur) :
 *   ① création d'une vidéo LIEN YouTube (comme le modal du back-office) ;
 *   ② suppression → ligne physiquement supprimée (GET 404, absente du site
 *      public /api/videos) ;
 *   ③ TENTATIVE DE RÉSURRECTION n°1 : POST de la MÊME URL (ce que faisait
 *      un script d'import) → 409 VIDEO_SUPPRIMEE attendu ;
 *   ④ TENTATIVE n°2 : POST sous UNE AUTRE FORME d'URL (youtu.be au lieu de
 *      watch?v=) → 409 attendu (clé canonique — impossible de contourner) ;
 *   ⑤ TENTATIVE n°3 : PATCH d'une AUTRE vidéo vers l'URL supprimée → 409 ;
 *   ⑥ RÉINTÉGRATION EXPLICITE : POST avec reintegration:true → 201 (la
 *      vidéo revient UNIQUEMENT parce que c'est confirmé) ;
 *   ⑦ re-suppression → définitive (GET 404) ;
 *   ⑧ non-régression : une vidéo JAMAIS supprimée se crée normalement (201).
 *
 * Usage : node scripts/verif-suppression-prod-v386.mjs
 */
const BASE = "https://www.mouvementchristlibere.com";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };

const cookieJar = new Map();
let passes = 0, echecs = 0;
const verifie = (libelle, ok, detail = "") => {
  if (ok) { passes++; console.log(`  ✔ ${libelle}`); }
  else { echecs++; console.error(`  ✘ ${libelle}${detail ? " — " + detail : ""}`); }
};

function retenirCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) cookieJar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

async function req(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookieJar.size > 0 && !headers.cookie) {
    headers.cookie = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  retenirCookies(res);
  return res;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("── ① Connexion admin ──");
  const login = await req(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (login.status !== 200) {
    console.error(`Login échoué (${login.status}) — arrêt.`);
    process.exit(1);
  }
  console.log("Connecté ✓");

  const servRes = await req(`${BASE}/admin/api/servants?limit=50&offset=0`);
  const { items: servs } = await servRes.json();
  const afrika = servs.find((s) => ["afrika", "pam"].includes((s.code || "").toLowerCase()));

  const HORODATAGE = new Date().toISOString();
  // Identifiants YouTube FICTIFS mais CONFORMES (11 caractères alphanum)
  // — la clé canonique youtube:<id> doit matcher entre les deux formes.
  const idA = ("v386a" + Date.now().toString(36)).slice(0, 11).padEnd(11, "0");
  const idB = ("v386b" + Date.now().toString(36)).slice(0, 11).padEnd(11, "0");
  const idD = ("v386d" + Date.now().toString(36)).slice(0, 11).padEnd(11, "0");
  const URL_A = `https://www.youtube.com/watch?v=${idA}`;
  const URL_B = `https://www.youtube.com/watch?v=${idB}`;
  const URL_D = `https://youtu.be/${idD}`;
  const URL_A_ALT = `https://youtu.be/${idA}`; // AUTRE FORME du MÊME média

  const corps = (url, titre) => ({
    servantId: afrika.id,
    title: titre,
    description: "Test V3.86 — suppression définitive (supprimé immédiatement).",
    duration: "1:00",
    videoUrl: url,
    isLive: false,
    publishedAt: new Date().toISOString(),
  });

  // ─── ① Création ───
  console.log("\n── ① Création de la vidéo test (lien YouTube) ──");
  const c1 = await req(`${BASE}/admin/api/videos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps(URL_A, `TEST V386 A ${HORODATAGE}`)),
  });
  verifie("création 201", c1.status === 201, `status=${c1.status}`);
  const { item: videoA } = await c1.json();

  // ─── ② Suppression ───
  console.log("\n── ② Suppression (bouton Corbeille du back-office) ──");
  const d1 = await req(`${BASE}/admin/api/videos/${videoA.id}`, { method: "DELETE" });
  verifie("suppression 200", d1.status === 200, `status=${d1.status}`);
  const g1 = await req(`${BASE}/admin/api/videos/${videoA.id}`);
  verifie("ligne physiquement supprimée (GET 404)", g1.status === 404, `status=${g1.status}`);
  const pub1 = await (await fetch(`${BASE}/api/videos`)).json();
  verifie(
    "absente du site public /api/videos",
    !(pub1.videos || []).some((v) => v.id === videoA.id)
  );

  // ─── ③ Résurrection tentée (même URL — comme un script d'import) ───
  console.log("\n── ③ Tentative de résurrection : même URL (comportement script d'import) ──");
  const c2 = await req(`${BASE}/admin/api/videos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps(URL_A, `TEST V386 résurrection ${HORODATAGE}`)),
  });
  let corps409 = null;
  if (c2.status === 409) corps409 = await c2.json();
  verifie(
    "refusée : 409 VIDEO_SUPPRIMEE",
    c2.status === 409 && corps409?.code === "VIDEO_SUPPRIMEE",
    `status=${c2.status} code=${corps409?.code}`
  );
  verifie(
    "le message cite la date de suppression",
    typeof corps409?.supprimeLe === "string",
    `supprimeLe=${corps409?.supprimeLe}`
  );

  // ─── ④ Autre forme d'URL du même média ───
  console.log("\n── ④ Tentative : AUTRE forme d'URL du même média (clé canonique) ──");
  const c3 = await req(`${BASE}/admin/api/videos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps(URL_A_ALT, `TEST V386 alt ${HORODATAGE}`)),
  });
  verifie(
    "refusée aussi (youtube:ID identique sous forme youtu.be)",
    c3.status === 409,
    `status=${c3.status}`
  );

  // ─── ⑤ PATCH d'une autre vidéo vers l'URL supprimée ───
  console.log("\n── ⑤ Tentative : PATCH d'une AUTRE vidéo vers l'URL supprimée ──");
  const c4 = await req(`${BASE}/admin/api/videos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps(URL_B, `TEST V386 B ${HORODATAGE}`)),
  });
  verifie("vidéo B créée (URL jamais supprimée → 201)", c4.status === 201, `status=${c4.status}`);
  const { item: videoB } = await c4.json();
  const p1 = await req(`${BASE}/admin/api/videos/${videoB.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoUrl: URL_A }),
  });
  verifie("PATCH vers l'URL supprimée → refusé (409)", p1.status === 409, `status=${p1.status}`);

  // PATCH sans changement de média (même URL) → autorisé
  const p2 = await req(`${BASE}/admin/api/videos/${videoB.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: `TEST V386 B renommé ${HORODATAGE}` }),
  });
  verifie("PATCH du titre seul → autorisé (200)", p2.status === 200, `status=${p2.status}`);

  // ─── ⑥ Réintégration explicite ───
  console.log("\n── ⑥ Réintégration EXPLICITE (reintegration: true) ──");
  const c5 = await req(`${BASE}/admin/api/videos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...corps(URL_A, `TEST V386 réintégrée ${HORODATAGE}`),
      reintegration: true,
    }),
  });
  verifie("réintégration confirmée → 201 (et UNIQUEMENT parce que confirmée)", c5.status === 201, `status=${c5.status}`);
  let videoC = null;
  if (c5.status === 201) videoC = (await c5.json()).item;

  // ─── ⑦ Re-suppression → définitive ───
  console.log("\n── ⑦ Re-suppression → définitive ──");
  if (videoC) {
    const d2 = await req(`${BASE}/admin/api/videos/${videoC.id}`, { method: "DELETE" });
    verifie("re-suppression 200", d2.status === 200, `status=${d2.status}`);
    const g2 = await req(`${BASE}/admin/api/videos/${videoC.id}`);
    verifie("définitivement supprimée (GET 404)", g2.status === 404, `status=${g2.status}`);
    // La mémoire est re-posée → une nouvelle tentative est re-refusée.
    const c6 = await req(`${BASE}/admin/api/videos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps(URL_A_ALT, `TEST V386 post-réint ${HORODATAGE}`)),
    });
    verifie("nouvelle tentative après re-suppression → re-refusée (409)", c6.status === 409, `status=${c6.status}`);
  } else {
    verifie("re-suppression (sans objet — la création ⑥ a échoué)", false);
  }

  // ─── ⑧ Non-régression : création normale ───
  console.log("\n── ⑧ Nettoyage + non-régression ──");
  const d3 = await req(`${BASE}/admin/api/videos/${videoB.id}`, { method: "DELETE" });
  verifie("vidéo B supprimée (nettoyage)", d3.status === 200, `status=${d3.status}`);
  const c7 = await req(`${BASE}/admin/api/videos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps(URL_D, `TEST V386 C ${HORODATAGE}`)),
  });
  verifie("une URL JAMAIS supprimée se crée normalement (201)", c7.status === 201, `status=${c7.status}`);
  if (c7.status === 201) {
    const { item: videoD } = await c7.json();
    await req(`${BASE}/admin/api/videos/${videoD.id}`, { method: "DELETE" });
    console.log("  (vidéo D de non-régression supprimée — nettoyage)");
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  RÉSULTAT PRODUCTION : ${passes} ✔ · ${echecs} ✘`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Erreur inattendue :", e);
  process.exit(1);
});
