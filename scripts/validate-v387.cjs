/**
 * ⭐ V3.87 — Validation syntaxique des fichiers modifiés/créés.
 * @babel/parser (typescript + jsx) — tsc n'est pas exécutable dans ce
 * conteneur (node_modules absent), même garde-fou que V3.33→V3.86.
 */
const parser = require("@babel/parser");
const fs = require("fs");
const path = require("path");

const RACINE = path.resolve(__dirname, "..");
const FICHIERS = [
  "src/components/site/contribuer-view.tsx",
  "src/app/api/dons/fedapay/confirmation/route.ts",
  "src/app/api/dons/statut/[reference]/route.ts",
  "src/lib/payments/fedapay.service.ts",
  "src/lib/payments/recuperation-dons.ts",
  "src/app/api/cron/recuperer-dons-fedapay/route.ts",
  "scripts/v387-tests-fedapay.ts",
];

let ok = 0;
let ko = 0;
for (const relatif of FICHIERS) {
  const absolu = path.join(RACINE, relatif);
  try {
    const code = fs.readFileSync(absolu, "utf8");
    parser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
    ok++;
    console.log(`✔ ${relatif}`);
  } catch (e) {
    ko++;
    console.error(`✘ ${relatif} — ${e.message}`);
  }
}
console.log(`${"\n".repeat(1)}${ok}/${ok + ko} fichiers valides`);
process.exit(ko > 0 ? 1 : 0);
