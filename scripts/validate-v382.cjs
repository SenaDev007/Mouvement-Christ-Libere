#!/usr/bin/env node
/**
 * ⭐ V3.82 — Validation locale de la page Contribuer (passerelles de paiement).
 *
 * Deux parties :
 *   A. Syntaxe (Babel) + sémantique (greps ciblés) de chaque fichier créé/modifié ;
 *   B. Exécutable séparé (bun) : scripts/v382-tests-runtime.ts — tests des
 *      fonctions pures (signatures HMAC, référence, email de reçu).
 *
 * Exécution : node scripts/validate-v382.cjs
 */

const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const RACINE = path.resolve(__dirname, "..");
let passes = 0;
let echecs = 0;

function verifie(libelle, condition, detail = "") {
  if (condition) {
    passes++;
    console.log(`  ✔ ${libelle}`);
  } else {
    echecs++;
    console.error(`  ✘ ${libelle}${detail ? " — " + detail : ""}`);
  }
}

function lire(relatif) {
  return fs.readFileSync(path.join(RACINE, relatif), "utf8");
}

function parseBabel(relatif) {
  const code = lire(relatif);
  try {
    parser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
    return true;
  } catch (e) {
    console.error(`  ✘ Syntaxe invalide : ${relatif} — ${e.message}`);
    echecs++;
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A1. Syntaxe (Babel) des fichiers V3.82 ──");
const FICHIERS = [
  "src/lib/payments/payment-types.ts",
  "src/lib/payments/fedapay.service.ts",
  "src/lib/payments/paystack.service.ts",
  "src/lib/payments/dons-webhook.ts",
  "src/app/api/dons/initier/route.ts",
  "src/app/api/dons/statut/[reference]/route.ts",
  "src/app/api/webhooks/fedapay/route.ts",
  "src/app/api/webhooks/paystack/route.ts",
  "src/app/contribuer/page.tsx",
  "src/app/contribuer/merci/page.tsx",
  "src/components/site/contribuer-view.tsx",
  "src/components/site/contribuer-merci-view.tsx",
  "src/app/admin/donations/page.tsx",
  "src/lib/email-templates.ts",
  "src/lib/email.ts",
  "src/lib/ensure-schema.ts",
  "src/lib/hero-defaults.ts",
];
for (const f of FICHIERS) {
  const ok = parseBabel(f);
  if (ok) {
    passes++;
    console.log(`  ✔ ${f}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A2. Schéma Prisma — table dons (Donation) + WebhookLog ──");
const schema = lire("prisma/schema.prisma");
verifie("Donation.reference TEXT UNIQUE", /reference\s+String\?\s+@unique/.test(schema));
verifie("Donation.provider + providerRef + typeDon", /provider\s+String\?/.test(schema) && /providerRef\s+String\?/.test(schema) && /typeDon\s+String\?/.test(schema));
verifie("Donation.statut default pending", /statut\s+String\s+@default\("pending"\)/.test(schema));
verifie("Donation.recurrent + confirmedAt", /recurrent\s+Boolean\s+@default\(false\)/.test(schema) && /confirmedAt\s+DateTime\?/.test(schema));
verifie("Modèle WebhookLog présent", /model WebhookLog/.test(schema));
verifie("WebhookLog : payload + indexes", /payload\s+String\?/.test(schema) && /@@index\(\[provider, createdAt\]\)/.test(schema));

console.log("\n── A3. ensure-schema — migration idempotente ──");
const ensure = lire("src/lib/ensure-schema.ts");
verifie("ensureDonsTables exporté", /export function ensureDonsTables/.test(ensure));
for (const colonne of ["reference", "provider", "providerRef", "typeDon", "statut", "recurrent", "confirmedAt"]) {
  verifie(`ALTER Donation ADD ${colonne} IF NOT EXISTS`, ensure.includes(`ADD COLUMN IF NOT EXISTS "${colonne}"`));
}
verifie("Index unique sur reference", ensure.includes('CREATE UNIQUE INDEX IF NOT EXISTS "Donation_reference_key"'));
verifie("Table WebhookLog CREATE IF NOT EXISTS", ensure.includes('CREATE TABLE IF NOT EXISTS "WebhookLog"'));
verifie("Lignes antérieures marquées approved", /UPDATE "Donation" SET "statut" = 'approved' WHERE "reference" IS NULL/.test(ensure));
verifie("Caisse « dons-en-ligne » créée (code stable)", ensure.includes("'dons-en-ligne'") && ensure.includes("ON CONFLICT (\"code\") DO NOTHING"));

console.log("\n── A4. Services passerelles (isolation + signatures) ──");
const fedapay = lire("src/lib/payments/fedapay.service.ts");
const paystack = lire("src/lib/payments/paystack.service.ts");
const types = lire("src/lib/payments/payment-types.ts");

// L'isolation architecturale se mesure aux IMPORTS (le code d'un service
// ne peut pas appeler l'autre) — les commentaires de documentation peuvent
// légitimement nommer l'autre passerelle pour l'expliquer.
const lignesCodeFeda = fedapay.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/*"));
const lignesCodePay = paystack.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/*"));
verifie("fedapay : aucun import/appel de paystack dans le CODE", !/paystack/i.test(lignesCodeFeda.join("\n")));
verifie("paystack : aucun import/appel de fedapay dans le CODE", !/fedapay/i.test(lignesCodePay.join("\n")));
verifie("fedapay : HMAC-SHA256 + timingSafeEqual", fedapay.includes('createHmac("sha256"') && fedapay.includes("timingSafeEqual"));
verifie("paystack : HMAC-SHA512 + timingSafeEqual", paystack.includes('createHmac("sha512"') && paystack.includes("timingSafeEqual"));
verifie("paystack : montant ×100 (sous-unité)", /amount: demande\.montant \* 100/.test(paystack));
verifie("fedapay : montant transmis TEL QUEL (XOF sans sous-unité)", /amount: demande\.montant,/.test(fedapay));
verifie("fedapay : bascule sandbox/live", fedapay.includes("API_SANDBOX") && fedapay.includes("API_LIVE"));
verifie("fedapay : custom_metadata.reference (rapprochement webhook)", fedapay.includes("custom_metadata"));
verifie("paystack : callback_url vers /contribuer/merci?ref=", paystack.includes("/contribuer/merci?ref="));
verifie("Types : offrande/dime/don (clés trésorerie)", types.includes('offrande: "Offrande"') && types.includes('dime: "Dîme"') && types.includes('don: "Don"'));
verifie("Types : bornes 100..5 000 000 XOF", types.includes("MONTANT_MIN_XOF = 100") && types.includes("MONTANT_MAX_XOF = 5_000_000"));
verifie("Référence générée avant l'appel externe (don_ + aléa)", /don_\$\{temps\}_\$\{alea\}/.test(types));

console.log("\n── A5. API initier — ordre des opérations ──");
const initier = lire("src/app/api/dons/initier/route.ts");
// L'appel fournisseur (AWAIT, pas l'import) doit venir APRÈS la création en base.
const posCreate = initier.indexOf("db.donation.create");
const posProvider = initier.indexOf("await creerTransactionFedapay");
const posProviderP = initier.indexOf("await initialiserTransactionPaystack");
verifie("Ligne dons créée EN BASE AVANT l'appel fournisseur", posCreate > -1 && posProvider > posCreate && posProviderP > posCreate, `create=${posCreate}, fedapay=${posProvider}, paystack=${posProviderP}`);
verifie("JAMAIS statut approved depuis initier", !/'approved'/.test(initier));
verifie("Échec fournisseur → don marqué failed (pas de pending fantôme)", /statut: "failed"/.test(initier));
verifie("Anti-abus par IP (fenêtre 10 min)", initier.includes("MAX_INITIATIONS_PAR_FENETRE") && initier.includes("FENETRE_ANTI_ABUS_MS"));
verifie("Clés absentes → 503 avec nom de variable", initier.includes("503") && initier.includes("FEDAPAY_CLE_ENV") && initier.includes("PAYSTACK_CLE_ENV"));
verifie("Validation email + montant + type + provider", initier.includes("emailValide") && initier.includes("montantValide") && initier.includes("TYPES_DON_VALEURS.includes") && initier.includes("PROVIDERS_VALEURS.includes"));

console.log("\n── A6. API statut — source de vérité ──");
const statut = lire("src/app/api/dons/statut/[reference]/route.ts");
verifie("Statut lu en base (findUnique reference)", statut.includes("findUnique") && statut.includes("where: { reference }"));
verifie("Cache désactivé (no-store)", statut.includes("no-store"));
verifie("Aucune donnée personnelle divulguée (email/nom absents de la réponse)", !/"email"|donorEmail|donorName/.test(statut));

console.log("\n── A7. Webhooks — sécurité non négociable ──");
const whFeda = lire("src/app/api/webhooks/fedapay/route.ts");
const whPay = lire("src/app/api/webhooks/paystack/route.ts");
const whCore = lire("src/lib/payments/dons-webhook.ts");

for (const [nom, fichier, entete] of [
  ["fedapay", whFeda, "x-fedapay-signature"],
  ["paystack", whPay, "x-paystack-signature"],
]) {
  const posVerif = fichier.indexOf("verifierSignature");
  const posTraitement = fichier.indexOf("traiterEvenementDon");
  verifie(`${nom} : signature vérifiée AVANT tout traitement`, posVerif > -1 && posTraitement > posVerif);
  verifie(`${nom} : signature invalide → 401, jamais traitée`, fichier.includes("{ status: 401 }"));
  verifie(`${nom} : secret absent → rejet explicite`, fichier.includes("SIGNE_INVALIDE") && (fichier.includes("503") || fichier.includes("401")));
  verifie(`${nom} : en-tête ${entete} lu`, fichier.includes(entete));
}
verifie("Idempotence : transition updateMany WHERE statut = 'pending'", whCore.includes('where: { id: don.id, statut: "pending" }'));
verifie("Dispatch trésorerie DANS la transaction SQL", whCore.includes("$transaction") && whCore.includes("treasuryTransaction.create"));
verifie("Écriture RECETTE catégorisée typeDon", whCore.includes('type: "RECETTE"') && whCore.includes("category: don.typeDon"));
verifie("Écriture rattachée à la caisse dons-en-ligne", whCore.includes('where: { code: "dons-en-ligne" }'));
verifie("Email de reçu UNIQUEMENT sur approved", /entree\.statutFinal === "approved" && don\.donorEmail/.test(whCore));
verifie("Journal WebhookLog à chaque issue", (whCore.match(/journaliserWebhook\(/g) || []).length >= 6);
verifie("Payload tronqué (20 Ko max)", whCore.includes("TAILLE_MAX_PAYLOAD = 20_000"));

console.log("\n── A8. Email de reçu (logo + conformité) ──");
const templates = lire("src/lib/email-templates.ts");
verifie("templateRecuDon + sujetRecuDon exportés", /export function templateRecuDon/.test(templates) && /export function sujetRecuDon/.test(templates));
verifie("Reçu construit dans l'enveloppe commune (bandeau logo V3.81)", /const html = enveloppe\(\s*"Reçu de votre don"/.test(templates) || templates.includes('enveloppe(\n    "Reçu de votre don"'));
verifie("Mention « à conserver pour vos archives »", templates.includes("pour vos archives"));
verifie("Aucune faute « Libéré » dans les templates", !/Libéré/.test(templates));
const emailTs = lire("src/lib/email.ts");
verifie("Catégorie RECU_DON déclarée", emailTs.includes('RECU_DON: "RECU_DON"'));

console.log("\n── A9. Page publique /contribuer (refonte) ──");
const vue = lire("src/components/site/contribuer-view.tsx");
verifie("Trois intentions proposées (offrande/dîme/don)", vue.includes('id: "offrande"') && vue.includes('id: "dime"') && vue.includes('id: "don"'));
verifie("Montants FCFA (2 000/5 000/10 000/25 000)", vue.includes("MONTANTS_SUGGERES = [2000, 5000, 10000, 25000]"));
verifie("Plus AUCUN montant en euros", !/\d+\s*€/.test(vue));
verifie("Deux canaux distincts FedaPay/Paystack", vue.includes('id: "fedapay"') && vue.includes('id: "paystack"'));
verifie("Boutons conformes à la spécification (Côte d'Ivoire / étranger)", vue.includes("Payer depuis la Côte d'Ivoire / Afrique de l'Ouest") && vue.includes("Faire un don depuis l'étranger"));
verifie("Soumission POST /api/dons/initier", vue.includes('"/api/dons/initier"'));
verifie("Redirection immédiate vers paymentUrl", vue.includes("window.location.assign"));
verifie("Email obligatoire + nom optionnel affichés", vue.includes('type="email"') && vue.includes("optionnel"));
verifie("Aucune clé/secret côté client (aucun process.env)", !/process\.env/.test(vue));

console.log("\n── A10. Page /contribuer/merci (statut réel) ──");
const merci = lire("src/components/site/contribuer-merci-view.tsx");
verifie("Consulte /api/dons/statut (jamais l'URL seule)", merci.includes("/api/dons/statut/"));
verifie("AUCUNE confirmation depuis un paramètre status d'URL", !/searchParams\.get\("status"\)/.test(merci) && !/status=success/.test(merci));
verifie("Polling automatique tant que pending", merci.includes("INTERVALLE_MS") && merci.includes("setInterval"));
verifie("Trois états distincts + introuvable", merci.includes('"approved"') && merci.includes('"failed"') && merci.includes('"pending"') && merci.includes('"introuvable"'));
verifie("Référence affichée (traçabilité donateur)", /Référence : \{reference\}/.test(merci));
const pageMerci = lire("src/app/contribuer/merci/page.tsx");
verifie("Page serveur qui rend la vue client", pageMerci.includes("ContribuerMerciView"));
verifie("Suspense + useSearchParams encapsulés dans la vue", merci.includes("Suspense") && merci.includes("useSearchParams"));

console.log("\n── A11. Back-office /admin/donations ──");
const admin = lire("src/app/admin/donations/page.tsx");
verifie("Badges statut (En attente/Confirmé/Échoué)", admin.includes("LIBELLES_STATUT") && admin.includes('"pending"') && admin.includes('"approved"') && admin.includes('"failed"'));
verifie("Badges catégorie (Offrande/Dîme/Don)", admin.includes("LIBELLES_TYPE") && admin.includes('offrande: "Offrande"') && admin.includes('dime: "Dîme"'));
verifie("Badges passerelle + référence", admin.includes("LIBELLES_PROVIDER") && admin.includes("{d.reference}"));
verifie("Répartition par catégorie (barres)", admin.includes("Répartition par catégorie"));
verifie("Montants par devise (jamais mélangés)", admin.includes("parDevise") && admin.includes("formaterMontant"));
verifie("Filtre par statut", admin.includes("statut="));
verifie("Lien vers journal trésorerie", admin.includes("/tresorerie/transactions"));
verifie("Filtre searchParams await (Next 16)", admin.includes("await searchParams"));

console.log("\n── A12. .env.example ──");
const envEx = lire(".env.example");
for (const cle of ["FEDAPAY_SECRET_KEY", "FEDAPAY_ENV", "FEDAPAY_WEBHOOK_SECRET", "PAYSTACK_SECRET_KEY", "PAYSTACK_WEBHOOK_SECRET", "SITE_URL", "DATABASE_URL", "RESEND_API_KEY"]) {
  verifie(`${cle} documenté`, envEx.includes(cle));
}
verifie("URLs de webhooks documentées", envEx.includes("/api/webhooks/fedapay") && envEx.includes("/api/webhooks/paystack"));

console.log("\n── A13. Garde-fous transverses ──");
let clientsPropres = true;
for (const f of ["src/components/site/contribuer-view.tsx", "src/components/site/contribuer-merci-view.tsx", "src/app/contribuer/page.tsx", "src/app/contribuer/merci/page.tsx", "src/app/admin/donations/page.tsx"]) {
  if (/FEDAPAY_SECRET|PAYSTACK_SECRET|FEDAPAY_WEBHOOK|PAYSTACK_WEBHOOK/.test(lire(f))) {
    clientsPropres = false;
    console.error(`     ⚠ secret exposé dans ${f}`);
  }
}
verifie("Aucune clé/secret dans les fichiers client & pages", clientsPropres);
verifie("Aucune clé sk_live/sk_test commise", !/sk_(live|test)_[A-Za-z0-9]{10,}/.test(FICHIERS.map(lire).join("")));

// ═══════════════════════════════════════════════════════════════════
console.log(`\n═══════════════════════════════════════════════════════════════════`);
console.log(`RÉSULTAT : ${passes} ✔ / ${echecs} ✘`);
if (echecs > 0) {
  process.exit(1);
}
