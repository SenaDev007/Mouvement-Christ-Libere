#!/usr/bin/env node
/**
 * ⭐ TEST END-TO-END de la suppression d'une vidéo LIEN (YouTube) en
 * production — reproduit EXACTEMENT ce que fait le back-office :
 *   1. login admin (cookie de session) ;
 *   2. POST /admin/api/videos — création d'une vidéo LIEN YouTube ;
 *   3. vérification GET ;
 *   4. DELETE /admin/api/videos/{id} SANS redirect:manual — c'est le
 *      comportement du navigateur (fetch suit les redirections) ;
 *   5. re-vérifications : GET par id, liste publique /api/videos ;
 *   6. nettoyage (re-delete si le test échoue).
 *
 * Usage : node scripts/test-suppression-video.mjs
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

async function req(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookieJar.size > 0 && !headers.cookie) {
    headers.cookie = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const res = await fetch(url, { ...opts, headers });
  retenirCookies(res);
  return res;
}

async function main() {
  console.log("── ① Connexion admin ──");
  const login = await req(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (login.status !== 200) {
    console.error(`Échec login (${login.status}).`);
    process.exit(1);
  }
  console.log("Connecté ✓  cookies:", [...cookieJar.keys()].join(", "), "\n");

  // Serviteur Pam (pour servantId)
  const servRes = await req(`${BASE}/admin/api/servants?limit=50&offset=0`);
  const servData = await servRes.json();
  const pam = servData.items.find((s) => ["afrika", "pam"].includes((s.code || "").toLowerCase()));
  if (!pam) {
    console.error("Serviteur Pam introuvable — serviteurs:", servData.items.map((s) => s.code).join(", "));
    process.exit(1);
  }
  console.log(`Serviteur : ${pam.shortName} (${pam.code}) — id=${pam.id}\n`);

  // ─── ② Création d'une vidéo LIEN YouTube (comme le ferait le pasteur) ───
  console.log("── ② Création vidéo TEST (lien YouTube) ──");
  const horodatage = new Date().toISOString();
  const payload = {
    servantId: pam.id,
    title: `TEST SUPPRESSION — à ignorer ${horodatage}`,
    description: "Vidéo de test technique — sera supprimée immédiatement.",
    duration: "1:00",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isLive: false,
    publishedAt: new Date().toISOString(),
  };
  const createRes = await req(`${BASE}/admin/api/videos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log(`POST /admin/api/videos → ${createRes.status}`);
  if (createRes.status !== 201) {
    console.error("Corps:", await createRes.text());
    process.exit(1);
  }
  const { item: cree } = await createRes.json();
  console.log(`Créée : id=${cree.id}  titre="${cree.title.slice(0, 50)}"\n`);

  // ─── ③ Vérification GET ───
  const get1 = await req(`${BASE}/admin/api/videos/${cree.id}`);
  console.log(`GET /admin/api/videos/{id} → ${get1.status} (attendu 200)`);

  // ─── ④ DELETE (comportement navigateur : suit les redirections) ───
  console.log("\n── ③ DELETE (fetch navigateur : redirect par défaut) ──");
  const del1 = await fetch(`${BASE}/admin/api/videos/${cree.id}`, {
    method: "DELETE",
    headers: { cookie: [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  console.log(`DELETE → ${del1.status} ${del1.statusText}`);
  const del1Body = await del1.text();
  console.log(`Corps réponse : ${del1Body.slice(0, 300)}`);

  // ─── ⑤ Vérification post-suppression ───
  console.log("\n── ④ Vérifications post-suppression ──");
  const get2 = await req(`${BASE}/admin/api/videos/${cree.id}`);
  console.log(`GET /admin/api/videos/{id} → ${get2.status} (attendu 404 = supprimée)`);

  // Liste publique (déclenche AUSSI la récupération de replays — aucun risque ici)
  const pub = await fetch(`${BASE}/api/videos`);
  const pubData = await pub.json();
  const encoreLa = (pubData.videos || []).filter((v) => v.id === cree.id);
  console.log(`Site public /api/videos : ${encoreLa.length === 0 ? "ABSENTE ✓" : `ENCORE PRÉSENTE ✗ (titre: ${encoreLa[0]?.title})`}`);

  // ─── ⑥ Test complémentaire : DELETE SANS cookie (que renvoie le proxy ?) ───
  console.log("\n── ⑤ Test : DELETE sans cookie de session (comportement proxy) ──");
  const del2 = await fetch(`${BASE}/admin/api/videos/${cree.id}`, { method: "DELETE", redirect: "manual" });
  console.log(`DELETE sans cookie → ${del2.status} ${del2.statusText}  Location: ${del2.headers.get("location") || "-"}`);
  if (del2.status === 307 || del2.status === 302 || del2.status === 301) {
    const cible = del2.headers.get("location");
    // Le navigateur suivrait cette redirection avec la MÉTHODE DELETE conservée
    const suivi = await fetch(cible.startsWith("http") ? cible : `${BASE}${cible}`, { method: "DELETE", redirect: "manual" });
    console.log(`   → le navigateur suivrait vers ${cible}`);
    console.log(`   → réponse finale : ${suivi.status} ${suivi.statusText}`);
    console.log(`   → res.ok serait ${suivi.ok} → ${suivi.ok ? "❗ SUPPRESSION SILENCIEUSEMENT IGNORÉE (pas d'alerte)" : "alerte « Erreur lors de la suppression » affichée"}`);
  }

  // ─── Nettoyage de sécurité ───
  if (get2.status === 200 || encoreLa.length > 0) {
    console.log("\n── NETTOYAGE : la vidéo test existe encore, re-suppression ──");
    const del3 = await req(`${BASE}/admin/api/videos/${cree.id}`, { method: "DELETE" });
    console.log(`Re-DELETE → ${del3.status}`);
    const get3 = await req(`${BASE}/admin/api/videos/${cree.id}`);
    console.log(`Vérification finale → ${get3.status} (404 = supprimée)`);
  }

  console.log("\n═══ FIN DU TEST ═══");
}

main().catch((e) => {
  console.error("Erreur inattendue :", e);
  process.exit(1);
});
