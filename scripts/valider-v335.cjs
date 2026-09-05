/**
 * Validation syntaxique V3.35 — @babel/parser (typescript+jsx) sur les
 * fichiers modifiés (tsc OOM en conteneur, méthode éprouvée V3.33/V3.34).
 */
const parser = require("@babel/parser");
const fs = require("fs");

const FICHIERS = [
  "src/lib/r2.ts",
  "src/lib/youtube.ts",
  "src/lib/live-replay-recovery.ts",
  "src/app/api/admin/r2-test/route.ts",
  "src/app/admin/r2-test/page.tsx",
  "src/app/admin/videos/page.tsx",
  "src/components/admin/videos-tabs-client.tsx",
  "src/components/admin/live-studio-client.tsx",
];

let ok = 0;
let echecs = 0;
for (const f of FICHIERS) {
  try {
    const code = fs.readFileSync(f, "utf8");
    parser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
    console.log(`✓ ${f}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${f} — ${e.message}`);
    echecs++;
  }
}
console.log(`\n${ok}/${FICHIERS.length} fichiers valides syntaxiquement`);
process.exit(echecs > 0 ? 1 : 0);
