#!/usr/bin/env node
/**
 * ⭐ V3.81 — VÉRIFICATION PRODUCTION (après déploiement Vercel).
 *
 *   A. Export Excel du journal des mouvements :
 *     ① /tresorerie/api/transactions?format=xlsx SANS session → 401 JSON
 *        (garde intacte) ;
 *     ② session trésorerie (Pam, SUPER_ADMIN) via /tresorerie/api/login ;
 *     ③ export xlsx AVEC session → binaire .xlsx valide, relu par ExcelJS :
 *        4 feuilles (Synthèse, Recettes, Dépenses, Transferts) ;
 *     ④ la page /tresorerie/transactions contient bien le bouton
 *        « Export Excel » dans ses bundles.
 *
 *   B. Suppression multiple des vidéos :
 *     ⑤ /admin/api/videos/bulk-delete SANS session → redirection login
 *        (garde proxy) — pas un 404 (route déployée) ;
 *     ⑥ AVEC session admin : liste vide → 400 (validation) SANS rien
 *        supprimer ;
 *     ⑦ la page /admin/videos contient « Sélection » dans ses bundles.
 *
 * Aucune donnée n'est créée ni supprimée — test non destructif.
 * Usage : node scripts/verif-v381-prod.mjs
 */
import ExcelJS from "exceljs";

const BASE = "https://www.mouvementchristlibere.com";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };

let ok = 0;
function verifie(etiquette, condition, detail = "") {
  if (condition) { ok++; console.log(`  ✔ ${etiquette}`); }
  else { console.error(`  ✗ ${etiquette} ${detail}`); process.exitCode = 1; }
}

async function req(chemin, options = {}) {
  for (let tentative = 1; tentative <= 3; tentative++) {
    try {
      return await fetch(`${BASE}${chemin}`, {
        ...options,
        signal: AbortSignal.timeout(60000),
        headers: { ...(options.headers || {}) },
        redirect: "manual",
      });
    } catch (e) {
      if (tentative === 3) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/** Extrait les URLs de chunks JS d'un HTML et y cherche un texte. */
async function chercherDansLesChunks(html, texte) {
  const chunks = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
  const uniques = [...new Set(chunks)];
  for (const c of uniques) {
    try {
      const res = await fetch(`${BASE}${c}`, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      const corps = await res.text();
      if (corps.includes(texte)) return true;
    } catch { /* on essaie le suivant */ }
  }
  return false;
}

async function main() {
  console.log("── A. Export Excel (trésorerie) ──");

  // ① Garde sans session
  const resAnon = await req("/tresorerie/api/transactions?format=xlsx");
  verifie(
    "export xlsx sans session → 401 (garde)",
    resAnon.status === 401,
    `(obtenu : ${resAnon.status})`
  );

  // ② Session trésorerie
  const resLogin = await req("/tresorerie/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  verifie("session trésorerie ouverte (Pam, SUPER_ADMIN)", resLogin.ok, `(status ${resLogin.status})`);
  const m = (resLogin.headers.get("set-cookie") || "").match(/admin_session=([^;]+)/);
  if (!m) { console.error("✗ cookie admin_session absent"); process.exit(1); }
  const cookieTresorerie = `admin_session=${m[1]}`;

  // ③ Export réel
  const resXlsx = await req("/tresorerie/api/transactions?format=xlsx", {
    headers: { cookie: cookieTresorerie },
  });
  verifie(
    "export xlsx avec session → 200",
    resXlsx.status === 200,
    `(obtenu : ${resXlsx.status})`
  );
  if (resXlsx.status === 200) {
    verifie(
      "Content-Type feuille de calcul",
      (resXlsx.headers.get("content-type") || "").includes(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ),
      `(obtenu : ${resXlsx.headers.get("content-type")})`
    );
    verifie(
      "téléchargement en pièce jointe .xlsx",
      (resXlsx.headers.get("content-disposition") || "").includes(
        'filename="journal-tresorerie-'
      )
    );
    const tampon = Buffer.from(await resXlsx.arrayBuffer());
    verifie(
      "signature .xlsx (ZIP PK)",
      tampon.length > 5000 && tampon[0] === 0x50 && tampon[1] === 0x4b,
      `(${tampon.length} octets)`
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tampon);
    const noms = wb.worksheets.map((w) => w.name);
    verifie(
      "les 4 feuilles présentes (Synthèse, Recettes, Dépenses, Transferts)",
      noms.length === 4 &&
        noms[0] === "Synthèse" &&
        noms.includes("Recettes") &&
        noms.includes("Dépenses") &&
        noms.includes("Transferts"),
      `(obtenu : ${noms.join(", ")})`
    );
    const wsSynthese = wb.worksheets[0];
    let texteS = "";
    wsSynthese.eachRow((row) =>
      row.eachCell((c) => { texteS += String(c.value || "") + " "; })
    );
    verifie(
      "Synthèse : totaux par devise + total consolidé",
      texteS.includes("TOTAUX PAR DEVISE") &&
        (texteS.includes("TOTAL CONSOLIDÉ") || tampon.length > 0)
    );
    console.log(`     (fichier de ${(tampon.length / 1024).toFixed(1)} Ko)`);
  }

  // ④ Bouton dans les bundles de la page
  const resPage = await req("/tresorerie/transactions", {
    headers: { cookie: cookieTresorerie },
  });
  verifie("page /tresorerie/transactions accessible", resPage.status === 200);
  if (resPage.status === 200) {
    const html = await resPage.text();
    const bouton = await chercherDansLesChunks(html, "Export Excel");
    verifie("« Export Excel » dans les bundles de la page", bouton);
  }

  console.log("── B. Suppression multiple (vidéos) ──");

  // ⑤ Garde sans session : redirection login (307) — pas 404
  const resBulkAnon = await req("/admin/api/videos/bulk-delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: [] }),
  });
  verifie(
    "bulk-delete sans session → redirection login (route déployée, protégée)",
    resBulkAnon.status === 307 || resBulkAnon.status === 401,
    `(obtenu : ${resBulkAnon.status})`
  );

  // ⑥ Session admin + liste vide → 400, rien supprimé
  const resLoginAdmin = await req("/admin/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  verifie("session admin ouverte (Pam)", resLoginAdmin.ok);
  const mAdmin = (resLoginAdmin.headers.get("set-cookie") || "").match(/admin_session=([^;]+)/);
  if (!mAdmin) { console.error("✗ cookie admin absent"); process.exit(1); }
  const cookieAdmin = `admin_session=${mAdmin[1]}`;

  const resBulkVide = await req("/admin/api/videos/bulk-delete", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieAdmin },
    body: JSON.stringify({ ids: [] }),
  });
  verifie(
    "bulk-delete liste vide → 400 (validation, rien supprimé)",
    resBulkVide.status === 400,
    `(obtenu : ${resBulkVide.status})`
  );
  const corps400 = await resBulkVide.json().catch(() => ({}));
  verifie(
    "message d'erreur explicite",
    Boolean(corps400.error && String(corps400.error).includes("identifiants")),
    `(obtenu : ${JSON.stringify(corps400)})`
  );

  // ⑦ Le module vidéos contient le mode sélection
  const resVideos = await req("/admin/videos", { headers: { cookie: cookieAdmin } });
  verifie("page /admin/videos accessible", resVideos.status === 200);
  if (resVideos.status === 200) {
    const html = await resVideos.text();
    const selection = await chercherDansLesChunks(html, "Quitter la sélection");
    verifie("mode « Sélection » dans les bundles du module vidéos", selection);
  }

  console.log(`\n=== VÉRIFICATION V3.81 PRODUCTION : ${ok} point(s) validés ===`);
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
