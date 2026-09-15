#!/usr/bin/env node
/**
 * ⭐ V3.88 — Validation statique : Trésorerie XOF par défaut + conversion
 * automatique + informations du donateur + historique des donateurs.
 *
 * Vérifie (sans exécuter Next.js — parse Babel des sources) :
 *   A. Module de devises (taux, conversion, défaut XOF) ;
 *   B. Aucun « EUR » par défaut résiduel dans l'espace trésorerie ;
 *   C. API stats : agrégats multi-devises convertis + défaut XOF ;
 *   D. API transactions : enrichment donateur (Donation) + totaux groupés
 *      par devise + montantConverti ;
 *   E. Journal : modal détails donateur, équivalents, devise d'affichage ;
 *   F. Page + API donateurs (fusion journal/Donation, anonymes à part) ;
 *   G. Navigation : entrée « Donateurs » dans le layout trésorerie.
 */

const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const RACINE = path.resolve(__dirname, "..");
let ok = 0;
let ko = 0;

function verifier(nom, condition) {
  if (condition) {
    ok += 1;
    console.log(`  ✔ ${nom}`);
  } else {
    ko += 1;
    console.error(`  ✘ ${nom}`);
  }
}

function lire(rel) {
  return fs.readFileSync(path.join(RACINE, rel), "utf8");
}

function parse(rel) {
  const code = lire(rel);
  parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
  return code;
}

console.log("⭐ V3.88 — Validation Trésorerie (XOF + donateurs)\n");

// ── A. Module de devises ─────────────────────────────────────────────
console.log("A. Module src/lib/staff-space/devises.ts");
{
  const code = parse("src/lib/staff-space/devises.ts");
  verifier("DEVISE_PAR_DEFAUT = XOF", /DEVISE_PAR_DEFAUT = "XOF"/.test(code));
  verifier("parité fixe EUR → 655,957 XOF", /EUR:\s*655\.957/.test(code));
  verifier("taux USD de référence présent", /USD:\s*610/.test(code));
  verifier("convertirMontant exporté", /export function convertirMontant/.test(code));
  verifier("sommeConvertie exporté", /export function sommeConvertie/.test(code));
  verifier("equivalentFormate exporté", /export function equivalentFormate/.test(code));
  verifier("noteTauxReference exporté", /export function noteTauxReference/.test(code));
}

// ── B. Défaut XOF partout, plus aucun « EUR » par défaut résiduel ────
console.log("\nB. Franc CFA par défaut dans tout l'espace trésorerie");
{
  const fichiers = [
    "src/app/tresorerie/dashboard/page.tsx",
    "src/app/tresorerie/transactions/page.tsx",
    "src/app/tresorerie/caisse/page.tsx",
    "src/app/tresorerie/rapports/page.tsx",
    "src/app/tresorerie/api/stats/route.ts",
    "src/app/tresorerie/api/transactions/route.ts",
    "src/app/tresorerie/api/caisses/route.ts",
    "src/app/tresorerie/api/rapports/route.ts",
  ];
  for (const f of fichiers) {
    const code = parse(f);
    verifier(
      `${path.basename(path.dirname(f))}/${path.basename(f)} : aucun useState("EUR")`,
      !/useState\("EUR"\)/.test(code)
    );
    verifier(
      `${path.basename(f)} : aucun fallback ? currency : "EUR"`,
      !/\?\s*currency\s*:\s*"EUR"/.test(code) && !/\?\s*"EUR"\s*:/.test(code.replace(/DEVISE_PAR_DEFAUT/g, ""))
    );
  }
  verifier(
    "constants.ts : XOF en tête de DEVISES",
    /DEVISES = \{\s*\n\s*XOF:/.test(lire("src/lib/staff-space/constants.ts"))
  );
}

// ── C. API stats : conversion automatique ────────────────────────────
console.log("\nC. API stats — conversion multi-devises");
{
  const code = parse("src/app/tresorerie/api/stats/route.ts");
  verifier("défaut de devise = DEVISE_PAR_DEFAUT (XOF)", /DEVISE_PAR_DEFAUT/.test(code));
  verifier("groupBy type+currency (jamais de mélange)", /groupBy\(\{\s*by: \["type", "currency"\]/.test(code));
  verifier("conversion vers devise d'affichage", /convertirMontant\(/.test(code));
  verifier("détail natif par devise exposé", /detailParDevise/.test(code));
  verifier("solde multicaisse consolidé converti", /soldeReelToutesDevises/.test(code));
}

// ── D. API transactions : donateur + totaux convertis ───────────────
console.log("\nD. API transactions — donateur + totaux");
{
  const code = parse("src/app/tresorerie/api/transactions/route.ts");
  verifier("paramètre devise d'affichage « afficher »", /searchParams\.get\("afficher"\)/.test(code));
  verifier("totaux groupés par devise puis convertis", /groupBy\(\{\s*by: \["type", "currency"\]/.test(code));
  verifier("rattachement Donation par référence", /db\.donation\.findMany/.test(code));
  verifier("email du donateur exposé", /donorEmail: don\.donorEmail/.test(code));
  verifier("message du donateur exposé", /message: don\.message/.test(code));
  verifier("montantConverti par écriture", /montantConverti: convertirMontant/.test(code));
  verifier("totaux.parDevise dans la réponse", /parDevise: totauxParDevise/.test(code));
}

// ── E. Journal : modal détails + équivalents ─────────────────────────
console.log("\nE. Journal des mouvements — détails donateur");
{
  const code = parse("src/app/tresorerie/transactions/page.tsx");
  verifier("bouton détails donateur (UserRound)", /setDetails\(t\)/.test(code));
  verifier("ancien bouton reçu direct supprimé", !/ouvrirRecu/.test(code));
  verifier("téléchargement reçu via ancre (anti-popup)", /document\.createElement\("a"\)/.test(code));
  verifier("email donateur visible dans la ligne", /emailDonateur/.test(code));
  verifier("équivalent converti sous le montant", /equivalentFormate\(t\.amount/.test(code));
  verifier("bascule de devise d'affichage XOF/EUR/USD", /setDeviseAffichage/.test(code));
  verifier("note des taux de référence affichée", /noteTauxReference\(deviseAffichage\)/.test(code));
  verifier("lien vers l'historique des donateurs", /\/tresorerie\/donateurs/.test(code));
}

// ── F. Page + API donateurs ──────────────────────────────────────────
console.log("\nF. Historique des donateurs");
{
  const api = parse("src/app/tresorerie/api/donateurs/route.ts");
  verifier("API : garde de session trésorerie", /ROLES_TRESORERIE/.test(api));
  verifier("API : journal RECETTE + Donation fusionnés", /treasuryTransaction\.findMany[\s\S]*donation\.findMany/.test(api));
  verifier("API : dons anonymes comptés à part", /anonymes\.nb/.test(api));
  verifier("API : agrégats convertis en XOF", /convertirMontant\(.*DEVISE_PAR_DEFAUT\)/.test(api));
  verifier("API : période du/au", /searchParams\.get\("du"\)/.test(api));

  const page = parse("src/app/tresorerie/donateurs/page.tsx");
  verifier("page : filtres de période + raccourcis", /dateInputAujourdhui|ilYAMois|Tout l'historique/.test(page));
  verifier("page : carte donateur avec email", /donateur\.email/.test(page));
  verifier("page : liste des dons dépliable", /setDeplie/.test(page));
  verifier("page : total en XOF affiché", /formaterMontant\(.*"XOF"\)/.test(page));
  verifier("page : message du donateur affiché", /don\.message/.test(page));
}

// ── G. Navigation ────────────────────────────────────────────────────
console.log("\nG. Navigation trésorerie");
{
  const code = parse("src/app/tresorerie/layout.tsx");
  verifier("entrée « Donateurs » dans la sidebar", /label: "Donateurs"/.test(code));
  verifier("icône HeartHandshake importée", /HeartHandshake/.test(code));
  verifier(
    "href /tresorerie/donateurs",
    /href: "\/tresorerie\/donateurs"/.test(code)
  );
}

console.log(
  `\n${ok}/${ok + ko} vérification${ok + ko > 1 ? "s" : ""} ${ko === 0 ? "✔ V3.88 VALIDÉE" : "✘ À CORRIGER"}`
);
process.exit(ko === 0 ? 0 : 1);
