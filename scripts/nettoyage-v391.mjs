#!/usr/bin/env node
/** Nettoyage des fonds de test V391 + vérification des DEUX espaces + bundles UI. */
const ADMIN = "https://admin.mouvementchristlibere.com";
const SECRETARIAT = "https://secretariat.mouvementchristlibere.com";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };

const login = await fetch(`${ADMIN}/admin/api/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify(IDENTIFIANTS), redirect: "manual",
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
console.log("login:", login.status);

// ① Nettoyage des fonds de test.
const rFonds = await fetch(`${ADMIN}/admin/api/studio/backgrounds?tous=1`, {
  headers: { cookie }, redirect: "manual",
});
const fonds = ((await rFonds.json()).items) || [];
const tests = fonds.filter((f) => /^(diag|verif-v391|IA — )/i.test(f.name) || f.name === "verif-v391");
console.log(`fonds de test à nettoyer : ${tests.length}`);
for (const f of tests) {
  const del = await fetch(`${ADMIN}/admin/api/studio/backgrounds/${f.id}`, {
    method: "DELETE", headers: { cookie }, redirect: "manual",
  });
  console.log(`  supprimé « ${f.name} » : ${del.status}`);
}

// ② Garde secrétariat (nouvelle route directeur).
const rSecr = await fetch(`${SECRETARIAT}/secretariat/api/studio/ai/directeur`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}), redirect: "manual",
});
console.log("secretariat /ai/directeur sans session :", rSecr.status, rSecr.headers.get("content-type"));

// ③ Page studio back-office : le bundle contient les NOUVEAUX panneaux.
const rPage = await fetch(`${ADMIN}/admin/studio`);
const html = await rPage.text();
console.log("page /admin/studio :", rPage.status);
const scripts = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]);
console.log(`chunks chargés par la page : ${scripts.length}`);

let trouves = { directeur: false, calques: false, palette: false, itération: false };
for (const src of scripts.slice(0, 14)) {
  const r = await fetch(`${ADMIN}${src}`);
  if (!r.ok) continue;
  const js = await r.text();
  if (js.includes("Décrire le visuel")) trouves.directeur = true;
  if (js.includes("Ordre des calques") || js.includes("Calques (superpositions)")) trouves.calques = true;
  if (js.includes("Palette personnalisée")) trouves.palette = true;
  if (js.includes("Affinez avec une correction") || js.includes("Corriger")) trouves["itération"] = true;
}
console.log("panneaux UI dans les bundles :", JSON.stringify(trouves));
process.exit(Object.values(trouves).every(Boolean) ? 0 : 1);
