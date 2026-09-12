/**
 * ⭐ V3.68 — Validation statique : REFONTE PALETTE « LOGO » (noir / or / feu).
 *
 * Spécification pasteur :
 *   ① Aucune occurrence résiduelle de #2A0E3D (ni famille violette) ;
 *   ② Or #C9A227 CONSERVÉ tel quel (valeur réelle en usage) ;
 *   ③ Feu #FF7A1A défini comme variable réutilisable + hovers or→feu ;
 *   ④ Base noire : globals tokens, HSL shadcn, meta theme-color, manifest ;
 *   ⑤ Neutres fonctionnels : #F0E9DE (texte) / #8A857C (muted) ;
 *   ⑥ Badges « en direct » + CTA « Rejoindre » en accent feu ;
 *   ⑦ Halo feu discret derrière le logo ;
 *   ⑧ PDF (calendrier + espaces staff) alignés noir/or ;
 *   ⑨ Assets de partage régénérés sur fond noir.
 *
 * Usage : node scripts/valider-v368.cjs
 */
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "..");
let ok = 0, ko = 0;

function verifie(nom, condition) {
  condition ? (ok++, console.log(`  ✓ ${nom}`)) : (ko++, console.log(`  ✗ ${nom}`));
}
function lit(p) {
  try { return fs.readFileSync(path.join(racine, p), "utf8"); } catch { return ""; }
}

function tousFichiers(dir, exts, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !["node_modules", ".next", ".git"].includes(e.name)) {
      tousFichiers(p, exts, acc);
    } else if (exts.some((x) => e.name.endsWith(x))) {
      acc.push(p);
    }
  }
  return acc;
}

console.log("═══ ① Aucun violet résiduel ═══");
const srcFiles = tousFichiers(path.join(racine, "src"), [".tsx", ".ts", ".css"]);
const VIOLETS = ["#2A0E3D", "#1A0826", "#1E0F2B", "#3D1A54", "#3A1E4D", "#8C5FA8",
  "#7C5CB8", "#7C4A9A", "#7A4E96", "#7B4FA0", "#6B4485", "#6B4480", "#A878C4",
  "#7C3AED", "#6D28D9", "#8B5CF6", "#D946EF", "#A855F7", "#C084FC", "#A78BFA",
  "#A18CD1", "#5B21B6", "#3B0FB5", "#4C1D95", "#E9D5FF", "#EDE9FE", "#FBC2EB",
  "#2E1065", "#FAF6EF", "#8A8378", "#E8CE74", "#111118", "#16162a", "#0d0d16"];
let residus = 0;
for (const f of srcFiles) {
  const t = fs.readFileSync(f, "utf8");
  for (const v of VIOLETS) {
    const n = (t.match(new RegExp(v.replace("#", "#"), "gi")) || []).length;
    if (n) { residus += n; console.log(`    ${path.relative(racine, f)} : ${v} ×${n}`); }
  }
}
verifie(`Aucun hex violet/ancien dans src/ (résidus: ${residus})`, residus === 0);

let rgbaRes = 0;
for (const f of srcFiles) {
  const t = fs.readFileSync(f, "utf8");
  if (/rgba?\(\s*42\s*,\s*14\s*,\s*61/.test(t) || /rgba?\(\s*26\s*,\s*8\s*,\s*38/.test(t) ||
      /rgba?\(\s*30\s*,\s*15\s*,\s*43/.test(t) || /rgba?\(\s*140\s*,\s*95\s*,\s*168/.test(t) ||
      /rgba?\(\s*250\s*,\s*246\s*,\s*239/.test(t) || /rgba?\(\s*138\s*,\s*131\s*,\s*120/.test(t)) {
    rgbaRes++; console.log(`    rgba violet : ${path.relative(racine, f)}`);
  }
}
verifie("Aucun rgba violet/ancien dans src/", rgbaRes === 0);

const manifest = lit("public/manifest.webmanifest");
verifie("manifest sans #2A0E3D", !/2A0E3D/i.test(manifest));
verifie("manifest theme_color noir", manifest.includes('"theme_color": "#000000"'));
verifie("manifest background_color noir", manifest.includes('"background_color": "#000000"'));

console.log("═══ ② Or conservé (couleur de repos) ═══");
let orTotal = 0;
for (const f of srcFiles) orTotal += (fs.readFileSync(f, "utf8").match(/#C9A227/gi) || []).length;
verifie(`Or #C9A227 présent et dominant en repos (${orTotal} occurrences)`, orTotal > 1500);

console.log("═══ ③ Feu : variable + hovers ═══");
const globals = lit("src/app/globals.css");
verifie("Token --color-fire: #FF7A1A défini (@theme)", /--color-fire:\s*#FF7A1A/.test(globals));
verifie("Alias --color-coal: #161513 (surface neutre)", /--color-coal:\s*#161513/.test(globals));
let hoverFeu = 0, hoverOrRes = 0;
for (const f of srcFiles) {
  const t = fs.readFileSync(f, "utf8");
  hoverFeu += (t.match(/(hover|group-hover):(bg|text|border|from|to|via|ring)-\[#FF7A1A\]/g) || []).length;
  // Vrais hovers or (bg/text/border/from) interdits ; les stops de GRADIENT
  // to/via restent licites UNIQUEMENT si la ligne contient from-[#FF7A1A] (le
  // feu mène le dégradé) — ex. CTA RDV : repos or->or clair, hover feu->or.
  hoverOrRes += (t.match(/(hover|group-hover):(bg|text|border|from)-\[#(C9A227|DDBE55)\]/g) || []).length;
  for (const ligne of t.split("\n")) {
    if (/(hover|group-hover):(to|via)-\[#(C9A227|DDBE55)\]/.test(ligne) && !ligne.includes("from-[#FF7A1A]")) {
      hoverOrRes++;
    }
  }
}
verifie(`Hovers convertis vers le feu (${hoverFeu} classes)`, hoverFeu > 350);
verifie(`Aucun hover or résiduel (${hoverOrRes})`, hoverOrRes === 0);

console.log("═══ ④ Base noire structurelle ═══");
verifie("globals : --color-imperial = #000000", /--color-imperial:\s*#000000/.test(globals));
verifie("globals : .dark --background = 0 0% 0% (noir pur)", /\.dark\s*\{[^}]*--background:\s*0 0% 0%/.test(globals));
verifie("globals : .dark --accent = feu HSL(25 100% 55%)", /\.dark\s*\{[^}]*--accent:\s*25 100% 55%/.test(globals));
verifie("globals : --foreground ivoire HSL(37 38% 91%)", /--foreground:\s*37 38% 91%/.test(globals));
verifie("globals : muted gris chaud HSL(39 6% 51%)", /--muted-foreground:\s*39 6% 51%/.test(globals));
const layout = lit("src/app/layout.tsx");
verifie('layout : themeColor "#000000"', layout.includes('themeColor: "#000000"'));
verifie("layout : cache-bust ?v=noir-2026-09 (icônes + OG)", (layout.match(/\?v=noir-2026-09/g) || []).length >= 5);
verifie("layout : html className=\"dark\" conservé", layout.includes('className="dark"'));

console.log("═══ ⑤ Neutres fonctionnels ═══");
let ivoire = 0, gris = 0;
for (const f of srcFiles) {
  const t = fs.readFileSync(f, "utf8");
  ivoire += (t.match(/#F0E9DE/g) || []).length;
  gris += (t.match(/#8A857C/g) || []).length;
}
verifie(`Blanc cassé #F0E9DE en place (${ivoire})`, ivoire > 800);
verifie(`Gris chaud #8A857C en place (${gris})`, gris > 1500);

console.log("═══ ⑥ Feu appliqué (badges direct, Rejoindre, hero) ═══");
const barre = lit("src/components/site/live-announcement-bar.tsx");
verifie("Barre live : dégradé FEU en direct", barre.includes("#FF7A1A 0%, rgba(255, 122, 26, 0.88)"));
verifie("Barre live : bouton Rejoindre noir + feu", barre.includes('backgroundColor: "#000000"') && barre.includes('color: "#FF7A1A"'));
verifie("Barre live : plus de vert (#16a34a/#15803d)", !/#16a34a|#15803d/.test(barre));
const cinematic = lit("src/components/magic/cinematic-hero.tsx");
verifie("Hero cinématique : badge direct en feu", /bg-\[#FF7A1A\]\/15/.test(cinematic) && !/state-danger/.test(cinematic));
const aurora = lit("src/components/magic/aurora-background.tsx");
verifie("Aurora « dawn » = noir + FEU + or", aurora.includes('dawn: ["#000000", "#FF7A1A", "#C9A227"]'));
const adminLive = lit("src/components/admin/live-studio-client.tsx");
verifie("Éditeur/live admin : badge PROGRAMMÉ or conservé (repos)", /PROGRAMMÉ/.test(adminLive));

console.log("═══ ⑦ Halo feu logo + hero ═══");
verifie("globals : classe .logo-halo-feu (glow radial feu)", /\.logo-halo-feu/.test(globals) && /rgba\(255, 122, 26, 0\.22\)/.test(globals));
verifie("globals : .hero-imperial = noir + glow feu", /\.hero-imperial[^{]*\{[^}]*rgba\(255, 122, 26, 0\.09\)[^}]*#000000/s.test(globals));
const nav = lit("src/components/ui/navigation-menu-4.tsx");
verifie("Header : halo feu appliqué derrière le logo", nav.includes("logo-halo-feu"));

console.log("═══ ⑧ PDF alignés ═══");
const pdfStaff = lit("src/lib/staff-space/pdf/base.ts");
verifie("PDF staff : NUIT = rgb(0, 0, 0) + FEU exporté", /NUIT = rgb\(0, 0, 0\)/.test(pdfStaff) && /FEU = rgb\(1, 0\.478, 0\.102\)/.test(pdfStaff));
verifie("PDF staff : CREME = blanc cassé #F0E9DE", /CREME = rgb\(0\.941, 0\.914, 0\.871\)/.test(pdfStaff));
const pdfCal = lit("src/lib/calendrier/pdf/generer-pdf.ts");
verifie("PDF calendrier : NUIT = rgb(0, 0, 0)", /NUIT = rgb\(0, 0, 0\)/.test(pdfCal));

console.log("═══ ⑨ Assets de partage ═══");
for (const f of ["public/og-image.png", "public/favicon.ico", "public/icon.png",
  "public/icon-32.png", "public/apple-icon.png", "public/manifest-192.png", "public/manifest-512.png"]) {
  const st = fs.statSync(path.join(racine, f));
  const frais = Date.now() - st.mtimeMs < 24 * 3600 * 1000;
  verifie(`${f} régénéré (${Math.round(st.size / 1024)} Ko)`, st.size > 300 && frais);
}

console.log(`\n═══ RÉSULTAT : ${ok} ✓ / ${ko} ✗ ═══`);
process.exit(ko === 0 ? 0 : 1);
