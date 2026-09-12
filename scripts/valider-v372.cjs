#!/usr/bin/env node
/**
 * ⭐ V3.72 — Validation locale (avant push).
 *
 * 1. Backend blindé : écoute multi-ports ($PORT + 3001 + 3000), gardes
 *    anti-crash, /api/health enrichi, heartbeat, Dockerfile EXPOSE corrigé.
 * 2. Trésorerie : sélecteur de caisses prédéfinies (principale, don,
 *    offrande, dîme, subvention + autre) + champ nom libre + transferts
 *    entre caisses depuis la situation de caisse.
 *
 * Usage : node scripts/valider-v372.cjs
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const racine = path.resolve(__dirname, "..");
const backend = path.join(racine, "backend");

let ok = 0;
const total = (compteur => () => `✔ ${ok}/${++compteur && compteur}`)(0);
function verifie(etiquette, condition) {
  if (condition) {
    ok++;
    console.log(`  ✔ ${etiquette}`);
  } else {
    console.error(`  ✗ ${etiquette}`);
    process.exitCode = 1;
  }
}

console.log("── V3.72 · Backend blindé (fichiers) ────────────────────");
const indexTs = fs.readFileSync(path.join(backend, "src/index.ts"), "utf8");
const dockerfile = fs.readFileSync(path.join(backend, "Dockerfile"), "utf8");
const toml = fs.readFileSync(path.join(backend, "railway.toml"), "utf8");

verifie(
  "écoute multi-ports : PORTS_CANDIDATS = [$PORT, 3001, 3000] dédupliqués",
  /PORTS_CANDIDATS\s*=\s*Array\.from\(\s*new Set\(\[PORT_INJECTE,\s*3001,\s*3000\]/.test(
    indexTs
  )
);
verifie(
  "lecture de $PORT injecté (process.env.PORT) pour le serveur principal",
  /PORT_INJECTE\s*=\s*parseInt\(process\.env\.PORT\s*\|\|\s*"3000"/.test(indexTs)
);
verifie(
  "gardes anti-crash : uncaughtException loggé SANS exit",
  /process\.on\(\s*"uncaughtException"[\s\S]*?console\.error/.test(indexTs) &&
    !/process\.on\(\s*"uncaughtException"[\s\S]{0,400}?process\.exit/.test(indexTs)
);
verifie(
  "gardes anti-crash : unhandledRejection loggée SANS exit",
  /process\.on\(\s*"unhandledRejection"[\s\S]*?console\.error/.test(indexTs) &&
    !/process\.on\(\s*"unhandledRejection"[\s\S]{0,400}?process\.exit/.test(indexTs)
);
verifie(
  "/api/health enrichi : ports écoutés + RSS + env (booléens)",
  /ports:\s*portsEcoutes/.test(indexTs) &&
    /rssMo:\s*Math\.round\(process\.memoryUsage\(\)\.rss/.test(indexTs) &&
    /resend:\s*Boolean\(process\.env\.RESEND_API_KEY\)/.test(indexTs)
);
verifie(
  "heartbeat de vie toutes les 5 min (logs Railway)",
  /\[heartbeat\]/.test(indexTs) && /5 \* 60 \* 1000/.test(indexTs)
);
verifie(
  "sortie explicite UNIQUEMENT si AUCUN port écouté",
  /portsEcoutes\.length === 0[\s\S]{0,200}?process\.exit\(1\)/.test(indexTs)
);
verifie(
  "Dockerfile : EXPOSE 3000 (fini le 3001 historique faussant le routage)",
  /EXPOSE 3000/.test(dockerfile) && !/EXPOSE 3001/.test(dockerfile)
);
verifie(
  "railway.toml : PORT toujours non épinglé (leçon V3.71)",
  !/^\s*PORT\s*=/m.test(toml)
);

console.log("── V3.72 · Trésorerie : caisses prédéfinies ─────────────");
const constants = fs.readFileSync(
  path.join(racine, "src/lib/staff-space/constants.ts"),
  "utf8"
);
const pageCaisse = fs.readFileSync(
  path.join(racine, "src/app/tresorerie/caisse/page.tsx"),
  "utf8"
);

const NOMS_ATTENDUS = [
  "Caisse principale",
  "Caisse don",
  "Caisse offrande",
  "Caisse dîme",
  "Caisse subvention",
];
verifie(
  "constante CAISSES_PREDEFINIES avec les 5 caisses demandées",
  NOMS_ATTENDUS.every((n) => constants.includes(`nom: "${n}"`)) &&
    /CAISSES_PREDEFINIES = \[/.test(constants)
);
verifie(
  "valeur « Autre — nom personnalisé » du sélecteur (CAISSE_PREDEFINIE_AUTRE)",
  constants.includes("CAISSE_PREDEFINIE_AUTRE") &&
    pageCaisse.includes("Autre — nom personnalisé")
);
verifie(
  "formulaire : sélecteur « Caisse prédéfinie » AU-DESSUS du champ nom",
  pageCaisse.indexOf("Caisse prédéfinie") <
    pageCaisse.indexOf("Nom de la caisse") &&
    /changerPredefinie/.test(pageCaisse)
);
verifie(
  "sélection d'une prédéfinie → nom pré-rempli PUIS ajustable (changerNom)",
  /if \(valeur !== CAISSE_PREDEFINIE_AUTRE\) \{\s*setNom\(valeur\);/.test(
    pageCaisse
  ) && /changerNom/.test(pageCaisse)
);
verifie(
  "édition d'une caisse : la prédéfinie est retrouvée si le nom correspond",
  /CAISSES_PREDEFINIES_NOMS\.includes\(caisseInitiale\.name\)/.test(pageCaisse)
);
verifie(
  "le champ nom libre est conservé et requis (validation inchangée)",
  /Le nom de la caisse est requis\./.test(pageCaisse)
);

console.log("── V3.72 · Trésorerie : transferts entre caisses ────────");
verifie(
  "composant FormulaireTransfert sur la situation de caisse",
  /function FormulaireTransfert\(/.test(pageCaisse)
);
verifie(
  "contrainte de devise respectée côté UI (destinations filtrées sur la devise source)",
  /c\.currency === source\.currency/.test(pageCaisse)
);
verifie(
  "contrôles UI : source ≠ destination, libellé requis, montant > 0",
  /La source et la destination doivent être différentes\./.test(pageCaisse) &&
    /Le libellé est requis\./.test(pageCaisse) &&
    /nombre strictement positif/.test(pageCaisse)
);
verifie(
  "POST /tresorerie/api/transactions avec type TRANSFERT (API V3.67 réutilisée)",
  /effectuerTransfert/.test(pageCaisse) &&
    /"\/tresorerie\/api\/transactions"/.test(pageCaisse) &&
    /type: "TRANSFERT"/.test(pageCaisse)
);
verifie(
  "bouton « Transfert » dans l'en-tête (désactivé si moins de 2 caisses actives)",
  /ouvrirTransfert\(\)/.test(pageCaisse) &&
    /Créez au moins deux caisses actives pour transférer/.test(pageCaisse) &&
    /Déplacer de l'argent d'une caisse vers une autre/.test(pageCaisse)
);
verifie(
  "bouton rapide « transférer depuis cette caisse » sur chaque carte active",
  /ouvrirTransfert\(c\)/.test(pageCaisse) &&
    /Transférer depuis \$\{c\.name\}/.test(pageCaisse)
);
verifie(
  "affichage du solde source + alerte fonds insuffisants (contrôle serveur doublé)",
  /Solde disponible/.test(pageCaisse) && /fondsInsuffisants/.test(pageCaisse)
);
verifie(
  "API V3.67 inchangée : POST TRANSFERT + audit TRESORERIE_TRANSFERT toujours en place",
  (() => {
    const route = fs.readFileSync(
      path.join(racine, "src/app/tresorerie/api/transactions/route.ts"),
      "utf8"
    );
    return (
      /type === "TRANSFERT"/.test(route) &&
      /caisseDestinationId/.test(route) &&
      /TRESORERIE_TRANSFERT/.test(route)
    );
  })()
);

console.log("── V3.72 · Boot multi-ports (exécution réelle) ──────────");
function attendre(ok_, ko, delaiMax = 15000) {
  return new Promise((resoudre, rejeter) => {
    const debut = Date.now();
    const tick = setInterval(async () => {
      try {
        const res = await fetch(ok_);
        if (res.ok) {
          clearInterval(tick);
          resoudre(await res.json());
        } else if (Date.now() - debut > delaiMax) {
          clearInterval(tick);
          rejeter(new Error(`HTTP ${res.status} sur ${ok_}`));
        }
      } catch (e) {
        if (Date.now() - debut > delaiMax) {
          clearInterval(tick);
          rejeter(e);
        }
      }
    }, 500);
    setTimeout(() => {
      clearInterval(tick);
      ko && ko();
    }, delaiMax + 2000);
  });
}

(async () => {
  const proc = spawn("node", ["dist/index.js"], {
    cwd: backend,
    env: { ...process.env, PORT: "7901", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  proc.stdout.on("data", (d) => (logs += d.toString()));
  proc.stderr.on("data", (d) => (logs += d.toString()));

  try {
    const health = await attendre("http://localhost:7901/api/health", () =>
      proc.kill("SIGKILL")
    );
    verifie(
      "boot réel : /api/health répond sur le PORT injecté (7901)",
      health.status === "ok" && health.ports.includes(7901)
    );
    verifie(
      "health enrichi : version V3.72 + ports + rssMo + env",
      health.version === "V3.72" &&
        Array.isArray(health.ports) &&
        typeof health.rssMo === "number" &&
        typeof health.env?.resend === "boolean"
    );
    // Ports secondaires 3001 et 3000 écoutés aussi.
    for (const port of [3001, 3000]) {
      try {
        const res = await fetch(`http://localhost:${port}/api/health`);
        verifie(`port candidat ${port} : l'app y répond aussi (200)`, res.ok);
      } catch {
        verifie(`port candidat ${port} : l'app y répond aussi (200)`, false);
      }
    }
    verifie(
      "logs de boot : « écoute active » sur chaque port + récapitulatif EN LIGNE",
      logs.includes("écoute active") &&
        logs.includes("Backend V3.72 EN LIGNE") &&
        logs.includes("ports écoutés : 7901, 3001, 3000")
    );
  } catch (e) {
    verifie(`boot réel du backend : ${e.message}`, false);
  } finally {
    proc.kill("SIGKILL");
  }

  console.log(
    `\n${
      process.exitCode ? "✗ ÉCHEC" : "✔ SUCCÈS"
    } — ${ok} vérifications réussies`
  );
})();
