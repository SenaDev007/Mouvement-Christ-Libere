/**
 * ⭐ V3.66 — Validation statique du Secrétariat & Trésorerie.
 *
 * Vérifie la présence et la cohérence de tous les livrables :
 *   ① schéma Prisma (rôles + 3 modèles) ;
 *   ② proxy (sous-domaines + gardes) ;
 *   ③ back-office /admin/staff (accréditation) ;
 *   ④ espace secrétariat (login, pages, API) ;
 *   ⑤ espace trésorerie (login, pages, API) ;
 *   ⑥ page publique /rendez-vous + API ;
 *   ⑦ PDF (polices avec €, générateurs) ;
 *   ⑧ layout-shell (nav publique masquée).
 *
 * Usage : node scripts/valider-v366.cjs
 */

const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "..");
let ok = 0;
let ko = 0;

function verifie(nom, condition) {
  if (condition) {
    ok++;
    console.log(`  ✓ ${nom}`);
  } else {
    ko++;
    console.log(`  ✗ ${nom}`);
  }
}

function lit(p) {
  try {
    return fs.readFileSync(path.join(racine, p), "utf8");
  } catch {
    return "";
  }
}

function existe(p) {
  return fs.existsSync(path.join(racine, p));
}

console.log("⭐ V3.66 — Validation Secrétariat & Trésorerie\n");

// ── ① Schéma Prisma ──────────────────────────────────────────────────────
console.log("① Schéma Prisma");
const schema = lit("prisma/schema.prisma");
verifie("rôle SECRETARY dans UserRole", /SECRETARY/.test(schema));
verifie("rôle TREASURER dans UserRole", /TREASURER/.test(schema));
verifie("modèle MeetingRequest", /model MeetingRequest/.test(schema));
verifie("modèle MinistryAnnouncement", /model MinistryAnnouncement/.test(schema));
verifie("modèle TreasuryTransaction", /model TreasuryTransaction/.test(schema));

// ── ② Auto-création BDD (ensure-schema) ──────────────────────────────────
console.log("② ensure-schema (auto-réparation prod)");
const ensure = lit("src/lib/ensure-schema.ts");
verifie("ensureStaffSpaces exporté", /export function ensureStaffSpaces/.test(ensure));
verifie("enum UserRole SECRETARY (DDL)", /ADD VALUE IF NOT EXISTS 'SECRETARY'/.test(ensure));
verifie("enum UserRole TREASURER (DDL)", /ADD VALUE IF NOT EXISTS 'TREASURER'/.test(ensure));
verifie("CREATE TABLE MeetingRequest", /CREATE TABLE IF NOT EXISTS "MeetingRequest"/.test(ensure));
verifie("CREATE TABLE MinistryAnnouncement", /CREATE TABLE IF NOT EXISTS "MinistryAnnouncement"/.test(ensure));
verifie("CREATE TABLE TreasuryTransaction", /CREATE TABLE IF NOT EXISTS "TreasuryTransaction"/.test(ensure));

// ── ③ Proxy & next.config ────────────────────────────────────────────────
console.log("③ Sous-domaines (proxy + noindex)");
const proxy = lit("src/proxy.ts");
verifie("hôte secretariat.mouvementchristlibere.com", /secretariat\.mouvementchristlibere\.com/.test(proxy));
verifie("hôte tresorerie.mouvementchristlibere.com", /tresorerie\.mouvementchristlibere\.com/.test(proxy));
verifie("redirection /secretariat (redirigerVersEspace)", /redirigerVersEspace\(request, "\/secretariat"\)/.test(proxy));
verifie("redirection /tresorerie (redirigerVersEspace)", /redirigerVersEspace\(request, "\/tresorerie"\)/.test(proxy));
verifie("garde session /secretariat (login)", /\/secretariat\/login/.test(proxy));
verifie("garde session /tresorerie (login)", /\/tresorerie\/login/.test(proxy));
const nextconfig = lit("next.config.ts");
verifie("noindex secretariat", /secretariat\.mouvementchristlibere\.com/.test(nextconfig) && /X-Robots-Tag/.test(nextconfig));
verifie("noindex tresorerie", /tresorerie\.mouvementchristlibere\.com/.test(nextconfig));

// ── ④ Back-office accréditation ──────────────────────────────────────────
console.log("④ Accréditation back-office /admin/staff");
verifie("route /admin/api/staff", existe("src/app/admin/api/staff/route.ts"));
verifie("page /admin/staff", existe("src/app/admin/staff/page.tsx"));
verifie("client staff", existe("src/app/admin/staff/staff-client.tsx"));
const staffRoute = lit("src/app/admin/api/staff/route.ts");
verifie("réservé SUPER_ADMIN", /exigerSession\(request, \["SUPER_ADMIN"\]\)/.test(staffRoute));
verifie("actions reset-password/revoke/reactivate", /reset-password/.test(staffRoute) && /revoke/.test(staffRoute));
verifie("AuditLog STAFF_CREATE", /STAFF_CREATE/.test(staffRoute));
const adminLayout = lit("src/app/admin/layout.tsx");
verifie("section « Espaces du ministère » (sidebar)", /Espaces du ministère/.test(adminLayout) && /\/admin\/staff/.test(adminLayout));

// ── ⑤ Espace Secrétariat ─────────────────────────────────────────────────
console.log("⑤ Espace Secrétariat");
const pagesSecretariat = [
  "src/app/secretariat/login/page.tsx",
  "src/app/secretariat/layout.tsx",
  "src/app/secretariat/dashboard/page.tsx",
  "src/app/secretariat/demandes/page.tsx",
  "src/app/secretariat/annonces/page.tsx",
  "src/app/secretariat/rapports/page.tsx",
  "src/app/secretariat/api/login/route.ts",
  "src/app/secretariat/api/logout/route.ts",
  "src/app/secretariat/api/stats/route.ts",
  "src/app/secretariat/api/demandes/route.ts",
  "src/app/secretariat/api/demandes/[id]/route.ts",
  "src/app/secretariat/api/annonces/route.ts",
  "src/app/secretariat/api/annonces/[id]/route.ts",
  "src/app/secretariat/api/rapports/route.ts",
];
for (const p of pagesSecretariat) verifie(p.replace("src/app/secretariat/", ""), existe(p));
const loginSec = lit("src/app/secretariat/api/login/route.ts");
verifie("rôles SECRETARY+SUPER_ADMIN (login)", /ROLES_SECRETARIAT/.test(loginSec));
const demandesId = lit("src/app/secretariat/api/demandes/[id]/route.ts");
verifie("actions transmettre/traiter/archiver/rouvrir", /transmettre/.test(demandesId) && /traiter/.test(demandesId) && /rouvrir/.test(demandesId));
verifie("audit DEMANDE_TRANSMETTRE", /DEMANDE_/.test(demandesId));
verifie("relais Yeshua Connect (annonces)", /relayerAnnonceMinistere/.test(lit("src/lib/staff-space/annonce-relay.ts")));

// ── ⑥ Espace Trésorerie ──────────────────────────────────────────────────
console.log("⑥ Espace Trésorerie");
const pagesTresorerie = [
  "src/app/tresorerie/login/page.tsx",
  "src/app/tresorerie/layout.tsx",
  "src/app/tresorerie/dashboard/page.tsx",
  "src/app/tresorerie/transactions/page.tsx",
  "src/app/tresorerie/caisse/page.tsx",
  "src/app/tresorerie/rapports/page.tsx",
  "src/app/tresorerie/api/login/route.ts",
  "src/app/tresorerie/api/logout/route.ts",
  "src/app/tresorerie/api/stats/route.ts",
  "src/app/tresorerie/api/transactions/route.ts",
  "src/app/tresorerie/api/transactions/[id]/route.ts",
  "src/app/tresorerie/api/caisse/route.ts",
  "src/app/tresorerie/api/rapports/route.ts",
];
for (const p of pagesTresorerie) verifie(p.replace("src/app/tresorerie/", ""), existe(p));
const loginTreso = lit("src/app/tresorerie/api/login/route.ts");
verifie("rôles TREASURER+SUPER_ADMIN (login)", /ROLES_TRESORERIE/.test(loginTreso));
const transactions = lit("src/app/tresorerie/api/transactions/route.ts");
verifie("validations RECETTE/DEPENSE + catégories", /RECETTE/.test(transactions) && /DEPENSE/.test(transactions));
verifie("audit TRESORERIE_CREATE", /TRESORERIE_CREATE/.test(transactions));
verifie("graphes recharts (dashboard)", /recharts/.test(lit("src/components/staff-space/tresorerie-graphes.tsx")));

// ── ⑦ Public /rendez-vous ────────────────────────────────────────────────
console.log("⑦ Entrée publique /rendez-vous");
verifie("page publique", existe("src/app/rendez-vous/page.tsx"));
verifie("vue formulaire", existe("src/app/rendez-vous/rendez-vous-view.tsx"));
verifie("API publique", existe("src/app/api/rendez-vous/route.ts"));
const apiRdv = lit("src/app/api/rendez-vous/route.ts");
verifie("rate-limit public", /MAX_PAR_FENETRE/.test(apiRdv));
verifie("honeypot anti-robots", /site/.test(apiRdv) && /honeypot/i.test(apiRdv));

// ── ⑧ PDF ────────────────────────────────────────────────────────────────
console.log("⑧ Génération PDF");
verifie("polices staff (base64)", existe("src/lib/staff-space/pdf/fonts.ts"));
const fontsStaff = lit("src/lib/staff-space/pdf/fonts.ts");
verifie("symbole € dans le sous-ensemble", fontsStaff.includes("20AC") || /€/.test(fontsStaff));
const pdfDocs = lit("src/lib/staff-space/pdf/documents.ts");
verifie("registre demandes", /genererRegistreDemandes/.test(pdfDocs));
verifie("registre annonces", /genererRegistreAnnonces/.test(pdfDocs));
verifie("rapport financier (solde cumulé)", /genererRapportFinancier/.test(pdfDocs) && /cumul/.test(pdfDocs));
const pdfBase = lit("src/lib/staff-space/pdf/base.ts");
verifie("montants sans U+202F (Intl contourné)", /formaterMontantPdf/.test(pdfBase));

// ── ⑨ Layout public ──────────────────────────────────────────────────────
console.log("⑨ Nav publique masquée");
const shell = lit("src/components/site/layout-shell.tsx");
verifie("/secretariat dans HIDDEN_ROUTES", /"\/secretariat"/.test(shell));
verifie("/tresorerie dans HIDDEN_ROUTES", /"\/tresorerie"/.test(shell));

// ── Récapitulatif ────────────────────────────────────────────────────────
console.log(`\n══════════════════════════════════`);
console.log(`Résultat : ${ok} ✓ / ${ko} ✗`);
if (ko > 0) {
  console.log("❌ VALIDATION ÉCHOUÉE");
  process.exit(1);
}
console.log("✅ V3.66 VALIDÉE");
