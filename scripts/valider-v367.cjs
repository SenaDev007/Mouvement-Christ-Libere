/**
 * ⭐ V3.67 — Validation statique : MULTICAISSE + gouvernance + publics.
 *
 * Vérifie la présence et la cohérence de tous les livrables :
 *   ① schéma Prisma (TreasuryCashAccount, colonnes caisse, trackingCode,
 *      publishAt) + DDL idempotent ensure-schema ;
 *   ② multicaisse (lib de calcul, API caisses CRUD, situation, transferts,
 *      validations croisées) ;
 *   ③ gouvernance (journal d'audit consultable ×2, motif de suppression
 *      obligatoire, traces de connexion, fix /admin/api/staff 401 JSON) ;
 *   ④ journal enrichi (caisse sur les écritures, pagination, export CSV,
 *      reçu de don PDF) ;
 *   ⑤ secrétariat (badge notifications, pagination, publishAt, export CSV,
 *      code de suivi) ;
 *   ⑥ pages publiques (CTA Hero pulsant, /annonces, /rendez-vous/suivi,
 *      liens header/footer) ;
 *   ⑦ PDF (rapport financier par caisse, registre avec code de suivi).
 *
 * Usage : node scripts/valider-v367.cjs
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

console.log("⭐ V3.67 — Validation multicaisse · gouvernance · publics\n");

// ── ① Schéma + DDL ───────────────────────────────────────────────────────
console.log("① Schéma Prisma + DDL idempotent");
const schema = lit("prisma/schema.prisma");
verifie("modèle TreasuryCashAccount", /model TreasuryCashAccount/.test(schema));
verifie("TreasuryCashAccount.openingBalance", /openingBalance\s+Float/.test(schema));
verifie("TreasuryCashAccount.isActive", /isActive\s+Boolean/.test(schema));
verifie("TreasuryTransaction.caisseId", /caisseId\s+String\?/.test(schema));
verifie("TreasuryTransaction.caisseDestinationId", /caisseDestinationId\s+String\?/.test(schema));
verifie("type TRANSFERT documenté", /RECETTE \| DEPENSE \| TRANSFERT/.test(schema));
verifie("MeetingRequest.trackingCode", /trackingCode\s+String\?\s+@unique/.test(schema));
verifie("MinistryAnnouncement.publishAt", /publishAt\s+DateTime\?/.test(schema));

const ensure = lit("src/lib/ensure-schema.ts");
verifie("CREATE TABLE TreasuryCashAccount (DDL)", /CREATE TABLE IF NOT EXISTS "TreasuryCashAccount"/.test(ensure));
verifie("ADD COLUMN caisseId (DDL)", /ADD COLUMN IF NOT EXISTS "caisseId"/.test(ensure));
verifie("ADD COLUMN caisseDestinationId (DDL)", /ADD COLUMN IF NOT EXISTS "caisseDestinationId"/.test(ensure));
verifie("index TreasuryTransaction_caisseId_idx", /TreasuryTransaction_caisseId_idx/.test(ensure));
verifie("ADD COLUMN trackingCode (DDL)", /ADD COLUMN IF NOT EXISTS "trackingCode"/.test(ensure));
verifie("index unique MeetingRequest_trackingCode_key", /MeetingRequest_trackingCode_key/.test(ensure));
verifie("ADD COLUMN publishAt (DDL)", /ADD COLUMN IF NOT EXISTS "publishAt"/.test(ensure));
verifie("index currency caisse conservé", /TreasuryTransaction_currency_idx/.test(ensure));

// ── ② Multicaisse ────────────────────────────────────────────────────────
console.log("② Multicaisse (calculs + API)");
verifie("lib multicaisse.ts", existe("src/lib/staff-space/multicaisse.ts"));
const multicaisse = lit("src/lib/staff-space/multicaisse.ts");
verifie("calculerSituationMulticaisse exporté", /export async function calculerSituationMulticaisse/.test(multicaisse));
verifie("solde = ouverture + recettes − dépenses ± transferts", /transfertsSortants|transfertsEntrants/.test(multicaisse));
verifie("contrôle de cohérence (invariant)", /coherent/.test(multicaisse));
verifie("genererCodeSuivi (MCL-XXXXXX)", /MCL-/.test(multicaisse));
verifie("API GET/POST /api/caisses", existe("src/app/tresorerie/api/caisses/route.ts"));
verifie("API PATCH/DELETE /api/caisses/[id]", existe("src/app/tresorerie/api/caisses/[id]/route.ts"));
const caissesId = lit("src/app/tresorerie/api/caisses/[id]/route.ts");
verifie("devise de caisse immuable", /ne peut pas être modifiée/.test(caissesId));
verifie("caisse portant des écritures non supprimable (409)", /status: 409/.test(caissesId));
const trans = lit("src/app/tresorerie/api/transactions/route.ts");
verifie("POST TRANSFERT (caisseId + caisseDestinationId)", /type === "TRANSFERT"/.test(trans));
verifie("transfert même devise exigée", /Transfert impossible entre devises/.test(trans));
verifie("fonds insuffisants refusés", /Fonds insuffisants/.test(trans));
verifie("rattachement caisse sur RECETTE/DEPENSE", /caisseFinale/.test(trans));
verifie("filtre caisse (GET ?caisse=)", /searchParams.get\("caisse"\)/.test(trans));
verifie("export CSV (format=csv, BOM UTF-8)", /format === "csv"/.test(trans) && /\\uFEFF/.test(trans));
verifie("noms de caisses enrichis", /caisseNom/.test(trans));
const caisseRoute = lit("src/app/tresorerie/api/caisse/route.ts");
verifie("situation multicaisse servie", /calculerSituationMulticaisse/.test(caisseRoute));
const statsRoute = lit("src/app/tresorerie/api/stats/route.ts");
verifie("stats : panneau multicaisse", /multicaisse/.test(statsRoute));
verifie("stats : transferts exclus des séries", /mouvementsReels/.test(statsRoute));

// ── ③ Gouvernance ────────────────────────────────────────────────────────
console.log("③ Gouvernance (audit + motif + fix staff)");
verifie("lib staff-space/audit.ts", existe("src/lib/staff-space/audit.ts"));
const auditLib = lit("src/lib/staff-space/audit.ts");
verifie("lireJournalAudit (pagination)", /export async function lireJournalAudit/.test(auditLib));
verifie("préfixes TRESORERIE_", /PREFIXES_AUDIT_TRESORERIE/.test(auditLib));
verifie("préfixes DEMANDE_/ANNONCE_/SECRETARIAT_/STAFF_", /PREFIXES_AUDIT_SECRETARIAT/.test(auditLib));
verifie("API audit trésorerie", existe("src/app/tresorerie/api/audit/route.ts"));
verifie("API audit secrétariat", existe("src/app/secretariat/api/audit/route.ts"));
verifie("page /tresorerie/audit", existe("src/app/tresorerie/audit/page.tsx"));
verifie("page /secretariat/audit", existe("src/app/secretariat/audit/page.tsx"));
verifie("vue journal d'audit partagée", existe("src/components/staff-space/journal-audit-view.tsx"));
const transId = lit("src/app/tresorerie/api/transactions/[id]/route.ts");
verifie("motif de suppression OBLIGATOIRE", /motif de suppression est obligatoire/.test(transId));
verifie("motif consigné dans l'audit", /motif,/.test(transId));
verifie("rattachement de caisse corrigeable (PATCH)", /caisseId !== undefined/.test(transId));
const session = lit("src/lib/staff-space/session.ts");
verifie("traces de connexion (actionAudit)", /actionAudit/.test(session));
const loginT = lit("src/app/tresorerie/api/login/route.ts");
const loginS = lit("src/app/secretariat/api/login/route.ts");
verifie("TRESORERIE_LOGIN tracé", /TRESORERIE_LOGIN/.test(loginT));
verifie("SECRETARIAT_LOGIN tracé", /SECRETARIAT_LOGIN/.test(loginS));
const proxy = lit("src/proxy.ts");
verifie("fix /admin/api/staff → 401 JSON (pass-through propre)", /ADMIN_API_AVEC_GARDE_PROPRE/.test(proxy) && /\/admin\/api\/staff/.test(proxy));
verifie("garde générique /admin/api/[entity] préservée", /pathname.startsWith\("\/admin"\)/.test(proxy));

// ── ④ Journal enrichi ────────────────────────────────────────────────────
console.log("④ Journal trésorerie (UI)");
const pageTransactions = lit("src/app/tresorerie/transactions/page.tsx");
verifie("sélecteur de caisse au formulaire", /Caisse \(multicaisse\)/.test(pageTransactions));
verifie("formulaire de transfert dédié", /Transfert entre caisses/.test(pageTransactions));
verifie("lignes de transfert (source → destination)", /caisseDestinationNom/.test(pageTransactions));
verifie("badge reçu PDF sur les recettes", /rapports\/recu\//.test(pageTransactions));
verifie("modal suppression avec motif", /Motif de suppression/.test(pageTransactions));
verifie("pagination", /Pagination/.test(pageTransactions));
verifie("export CSV (bouton)", /exporterCsv/.test(pageTransactions));
const pageCaisse = lit("src/app/tresorerie/caisse/page.tsx");
verifie("cartes par caisse + gestion", /Nouvelle caisse/.test(pageCaisse));
verifie("compartiment non affecté affiché", /non affecté/i.test(pageCaisse));
verifie("consolidation par devise", /Consolidation par devise/.test(pageCaisse));
verifie("désactivation/réactivation", /basculerActive/.test(pageCaisse));
verifie("API reçu de don PDF", existe("src/app/tresorerie/api/rapports/recu/[id]/route.ts"));
verifie("PDF reçu (documents.ts)", /genererRecuDon/.test(lit("src/lib/staff-space/pdf/documents.ts")));
verifie("rapport PDF : section situation par caisse", /Situation par caisse/.test(lit("src/lib/staff-space/pdf/documents.ts")));
const layoutT = lit("src/app/tresorerie/layout.tsx");
verifie("nav trésorerie : Journal d'audit", /Journal d'audit/.test(layoutT));

// ── ⑤ Secrétariat ────────────────────────────────────────────────────────
console.log("⑤ Secrétariat (notifications + pagination + planification)");
const layoutS = lit("src/app/secretariat/layout.tsx");
verifie("badge demandes à examiner (polling 60 s)", /useBadgeDemandes/.test(layoutS) && /60_000/.test(layoutS));
verifie("nav secrétariat : Journal d'audit", /Journal d'audit/.test(layoutS));
const pageDemandes = lit("src/app/secretariat/demandes/page.tsx");
verifie("pagination demandes", /Pagination/.test(pageDemandes));
verifie("export CSV demandes", /exporterCsv/.test(pageDemandes));
verifie("code de suivi affiché (registre)", /trackingCode/.test(pageDemandes));
const pageAnnonces = lit("src/app/secretariat/annonces/page.tsx");
verifie("pagination annonces", /Pagination/.test(pageAnnonces));
verifie("planification publishAt (formulaire)", /datetime-local/.test(pageAnnonces));
verifie("badge « Programmée »", /Programmée/.test(pageAnnonces));
verifie("filtre statut planifiee", /planifiee/.test(pageAnnonces));
const annoncesRoute = lit("src/app/secretariat/api/annonces/route.ts");
verifie("bascule auto des publications échues", /publierAnnoncesEchues/.test(annoncesRoute));
verifie("offset (pagination) annonces API", /offset/.test(annoncesRoute));
const annoncesId = lit("src/app/secretariat/api/annonces/[id]/route.ts");
verifie("PATCH publishAt (planifier/déplanifier)", /publishAt !== undefined/.test(annoncesId));
const demandesRoute = lit("src/app/secretariat/api/demandes/route.ts");
verifie("export CSV demandes (API)", /format === "csv"/.test(demandesRoute));
verifie("audit DEMANDE_CREATE (saisie manuelle)", /DEMANDE_CREATE/.test(demandesRoute));

// ── ⑥ Pages publiques ────────────────────────────────────────────────────
console.log("⑥ Publics (CTA + annonces + suivi)");
const landing = lit("src/components/site/landing-view.tsx");
verifie("CTA Hero pulsant → /rendez-vous", /cta-rdv-pulse/.test(landing) && /rendez-vous/.test(landing));
verifie("CTA passe DEVANT les CTA paramétrables", landing.indexOf('href="/rendez-vous"') < landing.indexOf("hero.ctaLabel"));
const css = lit("src/app/globals.css");
verifie("keyframes ctaPulseRing + prefers-reduced-motion", /ctaPulseRing/.test(css) && /prefers-reduced-motion/.test(css));
const header = lit("src/components/site/site-header.tsx");
const navReelle = lit("src/components/ui/navigation-menu-4.tsx");
verifie("CTA Rendez-vous dans le header", /rendez-vous/.test(header));
verifie("lien Annonces (nav publique)", /\/annonces/.test(header));
verifie("nav RÉELLE (ContextualNav) : Annonces du ministère", /Annonces du ministère/.test(navReelle));
verifie("nav RÉELLE : Demander un rendez-vous", /Demander un rendez-vous/.test(navReelle));
const footer = lit("src/components/site/site-footer.tsx");
verifie("liens footer (annonces, rendez-vous, suivi)", /\/annonces/.test(footer) && /\/rendez-vous\/suivi/.test(footer));
verifie("page publique /annonces", existe("src/app/annonces/page.tsx"));
const pagePubliquesAnnonces = lit("src/app/annonces/page.tsx");
verifie("annonces publiques : bascule + liste", /publierAnnoncesEchues/.test(pagePubliquesAnnonces) && /listerAnnoncesPubliees/.test(pagePubliquesAnnonces));
verifie("page publique /rendez-vous/suivi", existe("src/app/rendez-vous/suivi/page.tsx"));
verifie("API suivi publique (rate-limit, sans contenu)", existe("src/app/api/rendez-vous/suivi/route.ts"));
const suiviView = lit("src/app/rendez-vous/suivi/suivi-view.tsx");
verifie("stepper Reçue→Transmise→Traitée", /Transmise au serviteur/.test(suiviView));
const rdvView = lit("src/app/rendez-vous/rendez-vous-view.tsx");
verifie("code de suivi remis au dépôt", /codeSuivi/.test(rdvView));
const rdvRoute = lit("src/app/api/rendez-vous/route.ts");
verifie("API dépôt : code généré + retourné", /genererCodeSuiviUnique/.test(rdvRoute) && /codeSuivi,/.test(rdvRoute));

// ── ⑦ PDF registre + pagination partagée ─────────────────────────────────
console.log("⑦ PDF + composants partagés");
const documents = lit("src/lib/staff-space/pdf/documents.ts");
verifie("registre demandes : code de suivi imprimé", /Suivi : \$\{d\.trackingCode\}/.test(documents));
verifie("rapport : transferts « interne » au journal", /"interne"/.test(documents));
verifie("composant Pagination partagé", existe("src/components/staff-space/pagination.tsx"));

// ── Résumé ───────────────────────────────────────────────────────────────
console.log(
  `\n${ok} ✓ / ${ko} ✗ — ${ko === 0 ? "VALIDATION V3.67 RÉUSSIE" : "ÉCHEC : corriger les ✗"}`
);
process.exit(ko === 0 ? 0 : 1);
