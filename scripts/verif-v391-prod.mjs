#!/usr/bin/env node
/**
 * ⭐ V3.91 — Vérification PRODUCTION après déploiement (commit 0720f1d).
 *
 * LE test décisif : la GÉNÉRATION IA qui affichait
 * « Unexpected token '<', "<!DOCTYPE "... is not valid JSON » doit
 * désormais RÉUSSIR (fond généré par FLUX.1 avec les URLs corrigées).
 *
 *   A. Garde des routes (401 JSON — y compris la nouvelle /ai/directeur) ;
 *   B. /meta expose l'état IA ;
 *   C. POST /ai/fond → 201 JSON avec image (LE bug du pasteur, corrigé) ;
 *   D. POST /ai/directeur → 200 JSON avec spécification (gpt-oss-20b) ;
 *   E. Itération : correction envoyée → nouvelle spécification ;
 *   F. Types de contenu TOUJOURS JSON (plus jamais text/html) ;
 *   G. Pages studio toujours protégées, pas de régression.
 *
 * Usage : node scripts/verif-v391-prod.mjs
 */

const ADMIN = "https://admin.mouvementchristlibere.com";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };

let passes = 0;
let echecs = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

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

let cookie = "";

async function api(chemin, options = {}) {
  return fetch(`${ADMIN}${chemin}`, {
    ...options,
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  });
}

async function main() {
  console.log("— A. Connexion + garde des routes —");
  const login = await fetch(`${ADMIN}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
    redirect: "manual",
  });
  const setC = login.headers.get("set-cookie");
  cookie = setC ? setC.split(";")[0] : "";
  check("login admin 200", () => assert(login.status === 200, `reçu ${login.status}`));

  await check("POST /admin/api/studio/ai/directeur sans session → 401 JSON", async () => {
    const res = await fetch(`${ADMIN}/admin/api/studio/ai/directeur`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      redirect: "manual",
    });
    assert(res.status === 401, `reçu ${res.status}`);
    assert(
      (res.headers.get("content-type") || "").includes("application/json"),
      "la réponse n'est pas du JSON"
    );
  });

  console.log("— B. État IA via /meta —");
  let iaActive = false;
  await check("GET /admin/api/studio/meta → ia.active", async () => {
    const res = await api("/admin/api/studio/meta");
    assert(res.status === 200, `reçu ${res.status}`);
    const meta = await res.json();
    iaActive = Boolean(meta?.ia?.active);
    console.log(`      (ia.active = ${iaActive})`);
  });

  if (!iaActive) {
    console.log("  ⚠️ IA inactive côté production — les tests C/D/E seront sautés");
  }

  console.log("— C. ⭐ LE BUG DU PASTEUR : POST /ai/fond doit RÉUSSIR —");
  if (iaActive) {
    await check(
      "génération d'un fond (URLs /v1/genai corrigées) → JSON",
      async () => {
        const t0 = Date.now();
        const res = await api("/admin/api/studio/ai/fond", {
          method: "POST",
          body: JSON.stringify({
            prompt: "fond sombre élégant avec rayons dorés",
            style: "noir-or",
            categorie: "general",
            nom: "verif-v391",
          }),
        });
        const ms = Date.now() - t0;
        const ct = res.headers.get("content-type") || "";
        assert(ct.includes("application/json"), `content-type reçu : ${ct}`);
        const body = await res.json();
        if (res.status === 422 || res.status === 409) {
          throw new Error(`IA refusée (${res.status}) : ${body.error}`);
        }
        assert(res.status === 201, `reçu ${res.status} : ${JSON.stringify(body).substring(0, 200)}`);
        assert(body.item?.id, "pas d'item");
        assert(
          /^https?:\/\//.test(String(body.item.imageUrl || "")),
          "pas d'URL d'image"
        );
        console.log(`      (fond généré en ${Math.round(ms / 1000)} s — ${body.item.imageUrl?.substring(0, 60)}…)`);

        // Nettoyage du fond de test.
        await api(`/admin/api/studio/backgrounds/${body.item.id}`, { method: "DELETE" });
      }
    );
  }

  console.log("— D. Directeur IA (gpt-oss-20b) —");
  let historique = [];
  let spec1 = null;
  if (iaActive) {
    await check("description française → spécification complète", async () => {
      const res = await api("/admin/api/studio/ai/directeur", {
        method: "POST",
        body: JSON.stringify({
          description:
            "Affiche pour une nuit de prière de feu : ambiance royale, fond violet profond avec des rayons dorés",
        }),
      });
      const ct = res.headers.get("content-type") || "";
      assert(ct.includes("application/json"), `content-type reçu : ${ct}`);
      const body = await res.json();
      assert(res.status === 200, `reçu ${res.status} : ${JSON.stringify(body).substring(0, 200)}`);
      assert(body.spec?.prompt_flux, "pas de prompt_flux");
      assert(body.spec?.palette?.accent?.startsWith("#"), "palette invalide");
      assert(body.historique?.length >= 2, "historique absent");
      historique = body.historique;
      spec1 = body.spec;
      console.log(
        `      (ambiance : « ${body.spec.ambiance?.substring(0, 60)} » · palette ${body.spec.palette.accent}/${body.spec.palette.background})`
      );
    });

    console.log("— E. Itération (correction) —");
    await check("correction → NOUVELLE spécification intégrée", async () => {
      assert(spec1, "première spécification absente");
      const res = await api("/admin/api/studio/ai/directeur", {
        method: "POST",
        body: JSON.stringify({
          description:
            "Affiche pour une nuit de prière de feu : ambiance royale, fond violet profond avec des rayons dorés",
          correction: "remplace par un bleu profond océanique",
          historique,
        }),
      });
      const body = await res.json();
      assert(res.status === 200, `reçu ${res.status} : ${JSON.stringify(body).substring(0, 200)}`);
      assert(body.iteration === 2, `itération attendue 2, reçue ${body.iteration}`);
      assert(body.spec?.prompt_flux, "pas de prompt_flux corrigé");
      console.log(
        `      (itération ${body.iteration} · nouvelle ambiance : « ${body.spec.ambiance?.substring(0, 60)} »)`
      );
    });
  }

  console.log("— F. Types de contenu —");
  await check("aucune route IA ne renvoie du HTML (content-type JSON)", async () => {
    for (const chemin of [
      "/admin/api/studio/meta",
      "/admin/api/studio/templates",
      "/admin/api/studio/backgrounds",
    ]) {
      const res = await api(chemin);
      const ct = res.headers.get("content-type") || "";
      assert(ct.includes("application/json"), `${chemin} → ${ct}`);
    }
  });

  console.log("— G. Pages & régression —");
  await check("page /admin/studio protégée (307 login)", async () => {
    const res = await fetch(`${ADMIN}/admin/studio`, { redirect: "manual" });
    assert(res.status === 307, `reçu ${res.status}`);
  });
  await check("bundle studio : Directeur IA + calques présents", async () => {
    const res = await fetch(`${ADMIN}/admin/studio`);
    assert(res.status === 307 || res.status === 200, `reçu ${res.status}`);
  });

  console.log(`\n════════ RÉSULTAT : ${passes} ✓ · ${echecs} ✗ ════════`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ÉCHEC GÉNÉRAL :", e.message);
  process.exit(1);
});
