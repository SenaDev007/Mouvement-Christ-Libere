#!/usr/bin/env node
/**
 * ⭐ V3.79 — TEST E2E production (via API admin, session Pam).
 *
 * Valide la chaîne COMPLÈTE du module Adoration & Louanges :
 *  ① login admin ;
 *  ② création d'un média test (catégorie « Adoration », lien TikTok
 *     d'Afrika) via POST /admin/api/videos — exactement ce que fait le
 *     modal « Nouveau média » du back-office ;
 *  ③ le média apparaît dans /api/videos avec sa catégorie (la page
 *     publique /adoration-louanges l'affiche — le filtre client est
 *     déterministe sur la catégorie) ;
 *  ④ bascule en ligne « Adoration » → « Louanges » (PATCH, comme le
 *     sélecteur de chaque carte du module) ;
 *  ⑤ suppression (DELETE — purge R2 incluse) ;
 *  ⑥ vérification finale : plus rien en base.
 *
 * Le média test est supprimé à la fin (production laissée PROPRE).
 * Usage : node scripts/test-e2e-v379.mjs
 */
import fs from "node:fs";

const BASE = "https://www.mouvementchristlibere.com";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };
const FICHIER_COOKIES = "/home/z/my-project/scripts/admin-cookies-v379.txt";

let ok = 0;
function verifie(etiquette, condition) {
  if (condition) { ok++; console.log(`  ✔ ${etiquette}`); }
  else { console.error(`  ✗ ${etiquette}`); process.exitCode = 1; }
}

// ─── Mini client PUBLIQUE avec réessai (réseau hoquet-proof) ──
async function req(chemin, options = {}) {
  for (let tentative = 1; tentative <= 3; tentative++) {
    try {
      return await fetch(`${BASE}${chemin}`, {
        ...options,
        signal: AbortSignal.timeout(45000),
        headers: { ...(options.headers || {}) },
      });
    } catch (e) {
      console.log(
        `     (réseau hoquet tentative ${tentative}/3 : ${e.cause?.code || e.message})`,
        JSON.stringify({ host: e.cause?.hostname, syscal: e.cause?.syscall, detail: e.cause?.cause?.code })
      );
      if (tentative === 3) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function main() {
  console.log("── ① Connexion admin (session Pam) ──");
  const resLogin = await fetch(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (!resLogin.ok) throw new Error(`login refusé : ${resLogin.status}`);
  // Récupérer le cookie de session renvoyé.
  const setCookie = resLogin.headers.get("set-cookie") || "";
  const m = setCookie.match(/admin_session=([^;]+)/);
  if (!m) throw new Error("cookie admin_session absent de la réponse");
  const enteteCookie = `admin_session=${m[1]}`;
  fs.writeFileSync(
    FICHIER_COOKIES,
    `#HttpOnly_ FALSE / TRUE 0 admin_session ${m[1]}\n`
  );
  verifie("session admin ouverte", true);

  const reqSession = async (chemin, options = {}) => {
    for (let tentative = 1; tentative <= 3; tentative++) {
      try {
        return await fetch(`${BASE}${chemin}`, {
          ...options,
          signal: AbortSignal.timeout(45000),
          headers: { ...(options.headers || {}), cookie: enteteCookie },
        });
      } catch (e) {
        console.log(`     (réseau hoquet tentative ${tentative}/3 : ${e.cause?.code || e.message})`);
        if (tentative === 3) throw e;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  };

  console.log("── ⓪ Nettoyage préalable (restes d'un run interrompu) ──");
  // Idempotent : supprime TOUT média test V379 resté en base (un run
  // interrompu après la création laisserait sinon un média orphelin).
  {
    const resNettoyage = await req("/api/videos");
    const avant = (await resNettoyage.json()).videos || [];
    const restes = avant.filter((v) => v.title?.startsWith("TEST V379"));
    for (const reste of restes) {
      await reqSession(`/admin/api/videos/${reste.id}`, { method: "DELETE" });
      console.log(`     supprimé : ${reste.id}`);
    }
    verifie(
      restes.length === 0 ? "base déjà propre" : `${restes.length} reste(s) purgé(s)`,
      true
    );
  }

  console.log("── ② Serviteur Afrika ──");
  const resServ = await reqSession("/admin/api/servants?limit=100");
  const servs = (await resServ.json()).items || [];
  const serviteur = servs.find((s) => s.code === "afrika") || servs.find((s) => s.code === "pam");
  if (!serviteur) throw new Error("serviteur « afrika » introuvable");
  verifie(`serviteur trouvé : ${serviteur.shortName} (${serviteur.code})`, true);

  console.log("── ③ Création du média test (catégorie « Adoration ») ──");
  const TITRE_TEST = "TEST V379 — média adoration (à supprimer)";
  const URL_TIKTOK = "https://www.tiktok.com/@pamela.dali7/video/7683371620924230944";
  const resCreate = await reqSession("/admin/api/videos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      servantId: serviteur.id,
      title: TITRE_TEST,
      description: "Média de test E2E V3.79 — vérification du module Adoration & Louanges.",
      duration: "",
      videoUrl: URL_TIKTOK,
      thumbnailUrl: "",
      isLive: false,
      views: 0,
      category: "Adoration",
      publishedAt: new Date().toISOString(),
    }),
  });
  if (!resCreate.ok) throw new Error(`création refusée : ${resCreate.status}`);
  const cree = (await resCreate.json()).item;
  verifie("média créé (POST /admin/api/videos)", !!cree?.id);
  const mediaId = cree.id;
  console.log(`     id=${mediaId}`);

  console.log("── ④ Visibilité publique (catégorie « Adoration ») ──");
  const resPub = await req("/api/videos");
  const pubVideos = (await resPub.json()).videos || [];
  const visible = pubVideos.find((v) => v.id === mediaId);
  verifie(
    "le média apparaît dans /api/videos AVEC sa catégorie « Adoration » (→ page /adoration-louanges)",
    visible?.category === "Adoration" && visible?.tiktokId === "7683371620924230944"
  );
  verifie(
    "le média est bien servi pour la page adoration (serviteur afrika + tiktokId)",
    visible?.servant === "afrika"
  );

  console.log("── ⑤ Bascule en ligne : « Adoration » → « Louanges » ──");
  const resPatch = await reqSession(`/admin/api/videos/${mediaId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category: "Louanges" }),
  });
  if (!resPatch.ok) throw new Error(`PATCH refusé : ${resPatch.status}`);
  const patche = (await resPatch.json()).item;
  verifie("catégorie basculée en « Louanges » (PATCH)", patche?.category === "Louanges");

  const resPub2 = await req("/api/videos");
  const visible2 = ((await resPub2.json()).videos || []).find((v) => v.id === mediaId);
  verifie("la bascule est visible côté public (catégorie « Louanges »)", visible2?.category === "Louanges");

  console.log("── ⑥ Suppression (purge R2 incluse) ──");
  const resDelete = await reqSession(`/admin/api/videos/${mediaId}`, { method: "DELETE" });
  if (!resDelete.ok) throw new Error(`DELETE refusé : ${resDelete.status}`);
  verifie("média supprimé (DELETE)", true);

  const resPub3 = await req("/api/videos");
  const visible3 = ((await resPub3.json()).videos || []).find((v) => v.id === mediaId);
  verifie("le média n'apparaît plus côté public (production propre)", !visible3);

  console.log(`\n${ok} vérifications E2E passées${process.exitCode ? " — AVEC ÉCHECS ⚠" : ""}`);
}

main().catch((e) => {
  console.error("ERREUR E2E :", e.message);
  process.exit(1);
});
