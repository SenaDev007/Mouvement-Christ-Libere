#!/usr/bin/env node
/**
 * ⭐ V3.71 — Validation du correctif « API Railway 502 ».
 *
 * Contexte (diagnostic production du 2026-09-12) :
 *   - api.mouvementchristlibere.com → Cloudflare 502 ;
 *   - mais port 80 → Railway (x-railway-67) + certificat Let's Encrypt
 *     CN=api.mouvementchristlibere.com VALIDE → domaine + custom domain OK ;
 *   - même l'URL directe *.up.railway.app → 502 « Application failed to
 *     respond » → AUCUN process n'écoute sur le port que Railway sonde ;
 *   - builds Railway « Success » + boot local parfait + /api/health sans DB.
 *
 * Cause racine : `PORT = "3001"` épinglé dans backend/railway.toml
 * [variables] — Railway injecte son propre PORT au runtime et son proxy
 * route vers CE port ; l'app écoutait sur 3001 pendant que Railway sondait
 * le port injecté → 502 permanent « build Success ».
 *
 * Correctifs validés ici :
 *   A. railway.toml : PORT épinglé SUPPRIMÉ (commentaire anti-régression) ;
 *   B. package.json : postinstall "prisma generate" (ceinture-bretelles pour
 *      le relais email — db.user.findFirst à l'exécution) ;
 *   C. boot réel du backend compilé + /api/health + /api/email/health.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const RACINE = path.resolve(__dirname, "..");
const BACKEND = path.join(RACINE, "backend");

let ok = 0, ko = 0;
function verifie(libelle, condition, detail = "") {
  if (condition) { ok++; console.log(`  ✓ ${libelle}`); }
  else { ko++; console.log(`  ✗ ${libelle}${detail ? " — " + detail : ""}`); }
}

(async () => {

console.log("\n════ V3.71 — Correctif API Railway (502 Application failed to respond) ════\n");

// ── A. railway.toml : plus aucun PORT épinglé ───────────────────────────
console.log("① railway.toml — suppression du PORT épinglé");
const toml = fs.readFileSync(path.join(BACKEND, "railway.toml"), "utf8");
const lignesPort = toml
  .split("\n")
  .map((l, i) => ({ i: i + 1, t: l.trim() }))
  .filter((l) => /^PORT\s*=/.test(l.t) && !l.t.startsWith("#"));
verifie("aucune ligne `PORT = …` active dans [variables]", lignesPort.length === 0,
  lignesPort.map((l) => `ligne ${l.i}: ${l.t}`).join(" | "));
verifie("commentaire anti-régression présent (NE JAMAIS épingler PORT)",
  toml.includes("NE JAMAIS épingler PORT"));
verifie("NODE_ENV=production conservé (runtime)",
  /^NODE_ENV\s*=\s*"production"/m.test(toml));
verifie("healthcheckPath /api/health conservé",
  /healthcheckPath\s*=\s*"\/api\/health"/.test(toml));
verifie("startCommand npm run start conservé",
  /startCommand\s*=\s*"npm run start"/.test(toml));

// ── B. package.json : prisma generate DANS le build ────────────────────
console.log("\n② package.json — prisma generate intégré au script build");
const pkg = JSON.parse(fs.readFileSync(path.join(BACKEND, "package.json"), "utf8"));
verifie('script "build": "prisma generate && tsc" (phase qui réussit sur Railway)',
  pkg.scripts && pkg.scripts.build === "prisma generate && tsc");
verifie("postinstall supprimé (suspect de l'échec de déploiement 763dd55)",
  !(pkg.scripts && pkg.scripts.postinstall));
verifie("prisma CLI disponible au build (devDependencies)",
  pkg.devDependencies && "prisma" in pkg.devDependencies);
verifie("@prisma/client en dependencies (runtime)",
  pkg.dependencies && "@prisma/client" in pkg.dependencies);

// ── C. index.ts : écoute sur process.env.PORT (Railway) ────────────────
console.log("\n③ index.ts — écoute sur le PORT injecté par Railway");
const index = fs.readFileSync(path.join(BACKEND, "src", "index.ts"), "utf8");
verifie("const PORT = parseInt(process.env.PORT || \"3000\", 10)",
  /parseInt\(process\.env\.PORT \|\| "3000", 10\)/.test(index));
verifie("httpServer.listen(PORT) — écoute dynamique",
  /httpServer\.listen\(PORT/.test(index));

// ── D. Boot réel + endpoints ───────────────────────────────────────────
console.log("\n④ Boot réel du backend compilé (port de test 3171)");
const distIndex = path.join(BACKEND, "dist", "index.js");
verifie("dist/index.js compilé présent", fs.existsSync(distIndex));

if (fs.existsSync(distIndex)) {
  {
    const proc = spawn("node", [distIndex], {
      cwd: BACKEND,
      env: { ...process.env, PORT: "3171", NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let pret = false;
    const attente = new Promise((res) => {
      proc.stdout.on("data", (d) => { if (String(d).includes("Backend listening")) { pret = true; res(); } });
      setTimeout(() => res(), 8000);
    });
    await attente;
    verifie("process démarré (« Backend listening »)", pret);

    const get = async (p) => {
      try {
        const r = await fetch(`http://127.0.0.1:3171${p}`, { signal: AbortSignal.timeout(5000) });
        return { status: r.status, body: await r.json().catch(() => ({})) };
      } catch { return { status: 0, body: {} }; }
    };

    const sante = await get("/api/health");
    verifie("GET /api/health → 200 status ok",
      sante.status === 200 && sante.body.status === "ok",
      JSON.stringify(sante).slice(0, 120));

    const email = await get("/api/email/health");
    verifie("GET /api/email/health → 200 service email (route V3.70 vivante)",
      email.status === 200 && email.body.service === "email",
      JSON.stringify(email).slice(0, 120));
    verifie("expéditeur fixe noreply@mouvementchristlibere.com",
      typeof email.body.expediteur === "string" && email.body.expediteur.includes("noreply@mouvementchristlibere.com"));

    proc.kill("SIGTERM");
    await new Promise((r) => { proc.on("exit", r); setTimeout(r, 1500); });
    verifie("process arrêté proprement (SIGTERM)", true);
  }
}

// ── Bilan ──────────────────────────────────────────────────────────────
console.log(`\n════ BILAN V3.71 : ${ok} ✓ / ${ko} ✗ ════`);
if (ko > 0) {
  console.log("ÉCHEC — corriger avant commit/push.\n");
  process.exit(1);
}
console.log("Correctif validé — prêt pour commit + push (auto-déploiement Railway).\n");
})();
