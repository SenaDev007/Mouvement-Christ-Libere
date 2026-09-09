/**
 * Validation V3.59 — Bibliothèque Mixkit intégrée à la post-production.
 *
 * ① Syntaxe : @babel/parser (typescript+jsx) sur les fichiers créés/modifiés
 *    (tsc complet OOM en conteneur — méthode éprouvée depuis V3.33).
 * ② Sémantique : vérifications ciblées (wiring du panneau, route API,
 *    catalogues JSON, gardes-fous d'import).
 */
const parser = require("@babel/parser");
const fs = require("fs");
const path = require("path");

const FICHIERS = [
  "src/components/post-production/post-production.tsx",
  "src/components/post-production/library-panel.tsx",
  "src/app/api/post-production/assets/import/route.ts",
  "src/lib/data/mixkit-library/index.ts",
  "scripts/scrape-mixkit-library.mjs",
];

let ok = 0;
let echecs = 0;

console.log("━━━ ① SYNTAXE (babel/parser) ━━━");
for (const f of FICHIERS) {
  try {
    const code = fs.readFileSync(f, "utf8");
    const plugins = f.endsWith(".mjs") ? [] : ["typescript", "jsx"];
    if (!f.endsWith(".mjs")) {
      parser.parse(code, { sourceType: "module", plugins });
    } else {
      // .mjs : le parser typescript accepte aussi du JS pur
      parser.parse(code, { sourceType: "module", plugins: ["typescript"] });
    }
    console.log(`✓ ${f}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${f} — ${e.message}`);
    echecs++;
  }
}

console.log("\n━━━ ② SÉMANTIQUE ━━━");
function check(nom, cond) {
  if (cond) {
    console.log(`✓ ${nom}`);
    ok++;
  } else {
    console.error(`✗ ${nom}`);
    echecs++;
  }
}

const pp = fs.readFileSync("src/components/post-production/post-production.tsx", "utf8");
const lp = fs.readFileSync("src/components/post-production/library-panel.tsx", "utf8");
const route = fs.readFileSync("src/app/api/post-production/assets/import/route.ts", "utf8");
const index = fs.readFileSync("src/lib/data/mixkit-library/index.ts", "utf8");

// Wiring dans post-production.tsx
check("import LibraryPanel présent", /import \{ LibraryPanel/.test(pp));
check('TabType contient "library"', /"library"/.test(pp.split("type TabType")[1]?.split(";")[0] || ""));
check("TABS : entrée library + icône Library", /\{ id: "library", label: "Bibliothèque", icon: LibraryIcon \}/.test(pp));
check('Rendu conditionnel activeTab === "library"', /activeTab === "library" && \(\s*<LibraryPanel/.test(pp));
check("handler onAddAudio câblé", /onAddAudio=\{handleAddLibraryAudio\}/.test(pp));
check("handler onAddVideoClip câblé", /onAddVideoClip=\{handleAddLibraryVideoClip\}/.test(pp));
check("import LibraryIcon (lucide)", /Library as LibraryIcon/.test(pp));

// library-panel.tsx
check("5 vues présentes", /"sfx" \| "music" \| "videos" \| "templates" \| "url"/.test(lp));
check("import paresseux des 4 catalogues", /chargerSfx\(\)/.test(lp) && /chargerTemplates\(\)/.test(lp));
check("route import appelée", /\/api\/post-production\/assets\/import/.test(lp));
check("Pixabay : 3 lanceurs de recherche", (lp.match(/PIXABAY_RECHERCHE\./g) || []).length >= 3);
check("fallbackUrl transmis pour le repli qualité", /fallbackUrl/.test(lp));
check("pas de requête réseau au montage (catalogue local)", !/useEffect\(\(\) => \{[^}]*fetch\(/.test(lp));

// Route API
check("auth session vérifiée", /verifySessionToken/.test(route));
check("anti-SSRF : https uniquement", /u\.protocol !== "https:"/.test(route));
check("anti-SSRF : IP privées bloquées", /a === 192 && b === 168/.test(route));
check("plafond 100 Mo", /TAILLE_MAX = 100 \* 1024 \* 1024/.test(route));
check("types MIME filtrés (audio/video/zip)", /typeAutorise/.test(route));
check("repli fallbackUrl", /fallbackBrute/.test(route));
check("uploadToR2 utilisé", /uploadToR2\(/.test(route));
check("runtime nodejs", /runtime = "nodejs"/.test(route));

// Module catalogue
check("4 chargeurs paresseux exportés", /export async function chargerSfx/.test(index) && /chargerMusiques/.test(index) && /chargerVideos/.test(index) && /chargerTemplates/.test(index));

// Catalogues JSON
const attendus = { "sfx.json": 465, "music.json": 759, "videos.json": 258, "templates.json": 313 };
for (const [nom, min] of Object.entries(attendus)) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join("src/lib/data/mixkit-library", nom), "utf8"));
    check(`${nom} : ${data.length} items (>= ${min})`, Array.isArray(data) && data.length >= min);
    const tousComplets = data.every((d) => d.n && d.p);
    check(`${nom} : tous les items ont nom + preview`, tousComplets);
  } catch (e) {
    console.error(`✗ ${nom} illisible : ${e.message}`);
    echecs++;
  }
}

// Les URLs du catalogue pointent uniquement vers le CDN Mixkit (https)
for (const nom of Object.keys(attendus)) {
  const data = JSON.parse(fs.readFileSync(path.join("src/lib/data/mixkit-library", nom), "utf8"));
  const urlsSures = data.every((d) => {
    const urls = [d.p, d.w, d.f, d.z, d.th, d.u].filter(Boolean);
    return urls.every((u) => /^https:\/\/(assets\.mixkit\.co|mixkit\.co)\//.test(u));
  });
  check(`${nom} : URLs https mixkit.co uniquement`, urlsSures);
}

console.log(`\n${ok}/${ok + echecs} vérifications réussies`);
process.exit(echecs > 0 ? 1 : 0);
