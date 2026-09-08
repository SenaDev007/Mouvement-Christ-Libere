/**
 * Validation V3.52 — @babel/parser (typescript+jsx) sur les fichiers modifiés
 * (tsc OOM en conteneur, méthode éprouvée V3.33+).
 */
const parser = require("@babel/parser");
const fs = require("fs");

const FICHIERS = [
  "src/lib/r2.ts",
  "src/lib/multipart-shared.ts",
  "src/app/api/admin/r2-test/route.ts",
  "src/app/admin/r2-test/page.tsx",
];

let ok = 0;
let echecs = 0;
for (const f of FICHIERS) {
  try {
    const code = fs.readFileSync(f, "utf8");
    parser.parse(code, { sourceType: "module", plugins: ["typescript", "jsx"] });
    console.log(`✓ ${f}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${f} — ${e.message}`);
    echecs++;
  }
}

// ─── Vérifications sémantiques V3.52 ───
const checks = [];
const add = (nom, cond) => checks.push({ nom, ok: !!cond });

const r2 = fs.readFileSync("src/lib/r2.ts", "utf8");
const mp = fs.readFileSync("src/lib/multipart-shared.ts", "utf8");
const route = fs.readFileSync("src/app/api/admin/r2-test/route.ts", "utf8");
const page = fs.readFileSync("src/app/admin/r2-test/page.tsx", "utf8");

add("r2.ts : HeadObjectCommand importé", /HeadObjectCommand/.test(r2.split("\n")[0]));
add("r2.ts : estAccesRefuse exporté", /export function estAccesRefuse/.test(r2));
add("r2.ts : sonde lecture (canRead + readErrorCode)", /canRead/.test(r2) && /readErrorCode/.test(r2));
add("r2.ts : sonde multipart (canMultipart + sonde-multipart)", /canMultipart/.test(r2) && /sonde-multipart/.test(r2));
add("r2.ts : abort immédiat après sonde multipart", /await annulerMultipartR2\(multipartKey, uploadId\)/.test(r2));
add("r2.ts : PutBucketCors silencieux sur AccessDenied", /PutBucketCors refusé/.test(r2));
add("r2.ts : pas de double accolade }{", !/\}>\s*\{\s*\{/.test(r2));

add("multipart-shared : import estAccesRefuse", /estAccesRefuse,/.test(mp));
add("multipart-shared : create → 403 actionnable sur AccessDenied", /estAccesRefuse\(error\)/.test(mp) && /, 403/.test(mp));
add("multipart-shared : message pointe /admin/r2-test", /\/admin\/r2-test/.test(mp));
add("multipart-shared : message 500 générique conservé", /Création de la session d'upload impossible/.test(mp));

add("route : canRead + canMultipart exposés", /canRead: diag\.canRead/.test(route) && /canMultipart: diag\.canMultipart/.test(route));
add("route : message pincé selon verdict", /diag\.canRead\n/.test(route) || /diag\.canRead\s*\?/.test(route) || /diag\.canRead\b/.test(route));

add("page : interface étendue canRead/canMultipart", /canRead\?: boolean/.test(page) && /canMultipart\?: boolean/.test(page));
add("page : lignes Permission lecture + multipart affichées", /Permission lecture/.test(page) && /Upload vidéo \(multipart\)/.test(page));
add("page : panneau réparation procédures A et B", /Procédure A/.test(page) && /Procédure B/.test(page));
add("page : icône KeyRound (pas d'emoji)", /KeyRound/.test(page) && !/🔑/.test(page));
add("page : XCircle toujours utilisé (import intact)", /XCircle/.test(page));

let okSem = 0;
for (const c of checks) {
  console.log(`${c.ok ? "✓" : "✗"} [sémantique] ${c.nom}`);
  if (c.ok) okSem++;
}

console.log(`\nSyntaxe : ${ok}/${FICHIERS.length} fichiers valides`);
console.log(`Sémantique : ${okSem}/${checks.length} vérifications OK`);
process.exit(echecs > 0 || okSem < checks.length ? 1 : 0);
