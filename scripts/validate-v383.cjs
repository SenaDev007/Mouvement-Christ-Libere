#!/usr/bin/env node
/**
 * ⭐ V3.83 — Validation locale : boutons « Payer » de /contribuer, module
 * de configuration des passerelles (back-office), journal de transactions
 * du back-office (correction du 404).
 *
 * Deux parties :
 *   A. Syntaxe (Babel) + sémantique (greps ciblés) de chaque fichier ;
 *   B. Exécutable séparé (bun) : scripts/v383-tests-runtime.ts — tests des
 *      fonctions pures (chiffrement AES, repli environnement, signatures).
 *
 * Exécution : node scripts/validate-v383.cjs
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
console.log("\n── A1. Syntaxe (Babel) des fichiers V3.83 ──");
const FICHIERS = [
  "src/components/site/contribuer-view.tsx",
  "src/lib/payments/gateway-config.ts",
  "src/lib/payments/fedapay.service.ts",
  "src/lib/payments/paystack.service.ts",
  "src/app/api/dons/initier/route.ts",
  "src/app/api/webhooks/fedapay/route.ts",
  "src/app/api/webhooks/paystack/route.ts",
  "src/app/admin/api/paiements/route.ts",
  "src/app/admin/paiements/page.tsx",
  "src/components/admin/paiements-client.tsx",
  "src/app/admin/tresorerie/transactions/page.tsx",
  "src/app/admin/tresorerie/page.tsx",
  "src/app/admin/donations/page.tsx",
  "src/components/admin/admin-shell.tsx",
  "src/proxy.ts",
  "src/lib/ensure-schema.ts",
];
for (const f of FICHIERS) {
  verifie(`Syntaxe ${f}`, parseBabel(f));
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A2. ① Boutons « Payer » de la section ④ de /contribuer ──");
{
  const vue = lire("src/components/site/contribuer-view.tsx");
  const nbPayer = (vue.match(/bouton:\s*"Payer"/g) || []).length;
  verifie("Les DEUX canaux portent le libellé simple « Payer »", nbPayer === 2, `trouvé ${nbPayer}`);
  verifie(
    "Ancien libellé long FedaPay supprimé",
    !vue.includes("Payer depuis la Côte d'Ivoire / Afrique de l'Ouest")
  );
  verifie(
    "Ancien libellé long Paystack supprimé",
    !vue.includes("Faire un don depuis l'étranger")
  );
  verifie(
    "Icône billet (Banknote) importée depuis lucide-react",
    /Banknote,/.test(vue) && vue.includes('from "lucide-react"')
  );
  verifie(
    "Icône billet utilisée dans le bouton de paiement",
    /<Banknote className="w-4 h-4" \/>/.test(vue)
  );
  verifie("Icône d'envoi (Send) retirée des importations", !/\bSend\b/.test(vue));
  verifie(
    "Les cartes conservent titre + zone (FedaPay/Paystack restent identifiables)",
    vue.includes('titre: "FedaPay"') && vue.includes('titre: "Paystack"') &&
      vue.includes("Côte d'Ivoire · Afrique de l'Ouest") && vue.includes('zone: "International"')
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A3. ② Configuration des passerelles — chiffrement & résolution ──");
{
  const config = lire("src/lib/payments/gateway-config.ts");
  verifie(
    "Chiffrement AES-256-GCM (createCipheriv aes-256-gcm)",
    config.includes("createCipheriv") &&
      config.includes("createDecipheriv") &&
      (config.match(/"aes-256-gcm"/g) || []).length >= 2
  );
  verifie(
    "Clé maîtresse : PAYMENTS_MASTER_KEY puis SESSION_SECRET",
    /PAYMENTS_MASTER_KEY \|\|[\s\S]*?SESSION_SECRET/.test(config)
  );
  verifie(
    "Clé maîtresse jamais logguée (aucun console.* ne la manipule)",
    !/console\.(log|warn|error)\([^)]*(matiereMaitresse|cleMaitresse)/m.test(config)
  );
  verifie(
    "Les secrets ne sortent jamais vers le client : EtatPasserelle ne porte que des masques",
    config.includes("cleMasquee") &&
      config.includes("`•••• ${ligne.cleLast4}`") &&
      !/interface EtatPasserelle[\s\S]*secretKey[^:]*:/.test(config.split("interface EtatPasserelle")[1]?.split("interface")[0] || "")
  );
  verifie(
    "Résolution : base (activée) prime, environnement en repli, « absente » sinon",
    config.includes('source === "back-office"') ||
      (config.includes('"back-office"') && config.includes('"environnement"') && config.includes('"absente"'))
  );
  verifie(
    "Erreur de base SILENCIEUSE → repli environnement (paiement jamais bloqué par la table)",
    /catch \(e\) \{[\s\S]*?Repli|repli environnement/.test(config.replace(/\n/g, " ")) ||
      config.includes("repli environnement")
  );
  verifie(
    "Cache 15 s + invalidation exportée",
    config.includes("15_000") && config.includes("invaliderCachePasserelles")
  );
  verifie(
    "Invalidation du cache après chaque enregistrement",
    /enregistrerConfigPasserelle[\s\S]*invaliderCachePasserelles\(\)/.test(config)
  );
  verifie(
    "Cohérence préfixe de clé ↔ environnement vérifiée (sk_live_/sk_sandbox_/sk_test_)",
    config.includes("sk_live_") && config.includes("sk_sandbox_") && config.includes("sk_test_")
  );
  verifie(
    "Activation sans clé interdite",
    config.includes("Impossible d'activer la passerelle sans clé secrète")
  );
  verifie(
    "Seuls les 4 derniers caractères sont conservés en clair (cleLast4)",
    /cleLast4[\s\S]*slice\(-4\)/.test(config)
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A4. ② Services & API : config depuis la base ──");
{
  const fedapay = lire("src/lib/payments/fedapay.service.ts");
  const paystack = lire("src/lib/payments/paystack.service.ts");
  const initier = lire("src/app/api/dons/initier/route.ts");
  const whFedapay = lire("src/app/api/webhooks/fedapay/route.ts");
  const whPaystack = lire("src/app/api/webhooks/paystack/route.ts");

  for (const [nom, service] of [["fedapay", fedapay], ["paystack", paystack]]) {
    verifie(
      `Service ${nom} : configuration résolue via lireConfigPasserelle`,
      service.includes(`lireConfigPasserelle("${nom}")`)
    );
    verifie(
      `Service ${nom} : plus AUCUNE lecture directe de la clé secrète d'environnement`,
      !service.includes(`process.env.${nom.toUpperCase()}_SECRET_KEY`)
    );
    verifie(
      `Service ${nom} : vérification de signature ASYNCHRONE (secret pouvant venir de la base)`,
      new RegExp(`export async function verifierSignature${nom.charAt(0).toUpperCase() + nom.slice(1)}`).test(service)
    );
    verifie(
      `Service ${nom} : test de connexion en lecture seule exposé`,
      service.includes(`export async function testerConnexion${nom.charAt(0).toUpperCase() + nom.slice(1)}`)
    );
  }
  verifie(
    "FedaPay : l'environnement (sandbox/live) suit la configuration back-office",
    fedapay.includes("baseApi(config.environment)")
  );
  verifie(
    "initier : gardes de configuration await (asynchrones)",
    initier.includes("(await fedapayConfigure())") &&
      initier.includes("(await paystackConfigure())")
  );
  verifie(
    "initier : le message 503 oriente vers /admin/paiements",
    initier.includes("/admin/paiements")
  );
  verifie(
    "Webhook FedaPay : signature vérifiée AVANT tout traitement (await)",
    whFedapay.includes("(await verifierSignatureFedapay(corpsBrut, signature))") &&
      whFedapay.indexOf("(await verifierSignatureFedapay") <
        whFedapay.indexOf("await traiterEvenementDon(")
  );
  verifie(
    "Webhook Paystack : signature vérifiée AVANT tout traitement (await)",
    whPaystack.includes("(await verifierSignaturePaystack(corpsBrut, signature))") &&
      whPaystack.indexOf("(await verifierSignaturePaystack") <
        whPaystack.indexOf("await traiterEvenementDon(")
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A5. ② API admin /admin/api/paiements ──");
{
  const api = lire("src/app/admin/api/paiements/route.ts");
  const proxy = lire("src/proxy.ts");

  for (const verbe of ["GET", "PUT", "POST"]) {
    verifie(
      `${verbe} : garde exigerSession SUPER_ADMIN (401/403 JSON)`,
      new RegExp(`export async function ${verbe}\\([\\s\\S]*?exigerSession\\(request, \\["SUPER_ADMIN"\\]\\)`).test(api)
    );
  }
  verifie("Provider validé contre PROVIDERS_VALEURS (fedapay | paystack)", api.includes("PROVIDERS_VALEURS.includes(provider)"));
  verifie(
    "Audit PAIEMENTS_CONFIG tracé à chaque enregistrement",
    api.includes('action: "PAIEMENTS_CONFIG"')
  );
  // Bloc d'audit de l'enregistrement (entre l'action et le catch).
  const blocAudit = api.split('action: "PAIEMENTS_CONFIG"')[1]?.split("} catch")[0] || "";
  verifie(
    "L'audit ne stocke JAMAIS la clé (masque + booléens typeof uniquement)",
    blocAudit.includes("cleMasquee: resultat.masque") &&
      !/:\s*corps\.(secretKey|webhookSecret)\b/.test(blocAudit) &&
      !/:\s*cleEnClair/.test(blocAudit)
  );
  verifie(
    "Test de connexion : lecture seule chez le fournisseur (aucune écriture)",
    api.includes("testerConnexionFedapay") && api.includes("testerConnexionPaystack")
  );
  verifie(
    "Proxy : /admin/api/paiements déclaré avec garde propre (401 JSON, pas de 307)",
    proxy.includes('"/admin/api/paiements"')
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A6. ② Page back-office /admin/paiements + sidebar ──");
{
  const page = lire("src/app/admin/paiements/page.tsx");
  const client = lire("src/components/admin/paiements-client.tsx");
  const shell = lire("src/components/admin/admin-shell.tsx");

  verifie(
    "Page : garde SUPER_ADMIN (message explicite sinon)",
    page.includes('session.role !== "SUPER_ADMIN"') &&
      page.includes("réservée aux serviteurs de Dieu")
  );
  verifie(
    "Page : état initial lu côté serveur (lireEtatPasserelles), secrets masqués",
    page.includes("lireEtatPasserelles()")
  );
  verifie(
    "Client : enregistrement via PUT /admin/api/paiements",
    client.includes('fetch("/admin/api/paiements"') && client.includes('method: "PUT"')
  );
  verifie(
    "Client : test via POST /admin/api/paiements",
    client.includes('method: "POST"')
  );
  verifie(
    "Client : champs secrets type password + autocomplete désactivé",
    (client.match(/type=\{afficher(Cle|Webhook) \? "text" : "password"\}/g) || []).length >= 2 &&
      (client.match(/autoComplete="off"/g) || []).length >= 2
  );
  verifie(
    "Client : les champs sont VIDÉS après succès (aucun secret qui traîne)",
    /setCle\(""\);[\s\S]*setWebhookSecret\(""\)/.test(client)
  );
  verifie(
    "Client : l'URL de webhook à déclarer est affichée avec copie",
    client.includes("navigator.clipboard.writeText(webhookUrl)") &&
      client.includes("URL de webhook à déclarer")
  );
  verifie(
    "Client : pas de valeur de clé en dur (aucun sk_ commis)",
    !/sk_(live|test|sandbox)_[A-Za-z0-9_-]{10,}/.test(client)
  );
  verifie(
    "Sidebar : entrée « Passerelles de paiement » → /admin/paiements",
    shell.includes('label: "Passerelles de paiement"') &&
      shell.includes('href: "/admin/paiements"')
  );
  verifie(
    "Sidebar : icône carte bancaire (CreditCard)",
    shell.includes("CreditCard")
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A7. ③ Journal de transactions du back-office (fix 404) ──");
{
  const journal = lire("src/app/admin/tresorerie/transactions/page.tsx");
  const consultation = lire("src/app/admin/tresorerie/page.tsx");
  const donations = lire("src/app/admin/donations/page.tsx");

  verifie(
    "La page /admin/tresorerie/transactions existe (l'ancienne cible du proxy)",
    fs.existsSync(path.join(RACINE, "src/app/admin/tresorerie/transactions/page.tsx"))
  );
  verifie(
    "Journal : garde SUPER_ADMIN",
    journal.includes('session.role !== "SUPER_ADMIN"')
  );
  verifie(
    "Journal : LECTURE SEULE (aucune mutation, aucun appel API trésorerie)",
    !/(db\.treasuryTransaction\.(create|update|delete)|\/tresorerie\/api\/)/.test(journal)
  );
  verifie(
    "Journal : filtres complets (type, catégorie, devise, caisse, recherche, période)",
    ['name="type"', 'name="categorie"', 'name="devise"', 'name="caisse"', 'name="q"', 'name="du"', 'name="au"'].every((n) =>
      journal.includes(n)
    )
  );
  verifie(
    "Journal : pagination serveur avec filtres conservés",
    journal.includes("construireQuery(filtresCourants,") &&
      journal.includes("TAILLE_PAGE")
  );
  verifie(
    "Journal : totaux par devise calculés via groupBy (jamais mélangées)",
    journal.includes("groupBy") && journal.includes("_sum")
  );
  verifie(
    "Journal : un transfert filtré compte comme source OU destination",
    journal.includes("caisseDestinationId: caisse")
  );
  verifie(
    "/admin/donations : le lien pointe vers /admin/tresorerie/transactions (plus de 404)",
    donations.includes('href="/admin/tresorerie/transactions"') &&
      !donations.includes('href="/tresorerie/transactions"')
  );
  verifie(
    "/admin/tresorerie : lien « Tout le journal » vers le journal complet",
    consultation.includes("Tout le journal") &&
      consultation.includes('href="/admin/tresorerie/transactions"')
  );
  // Plus AUCUN lien relatif /tresorerie/… dans les pages admin (cause du 404).
  let fuites = [];
  for (const f of FICHIERS.filter((x) => x.startsWith("src/app/admin/") || x.startsWith("src/components/admin/"))) {
    const code = lire(f);
    const m = code.match(/href="\/tresorerie[^"]*"/g);
    if (m) fuites.push(`${f} → ${m.join(", ")}`);
  }
  verifie(
    "Aucun lien relatif /tresorerie/… restant dans le back-office",
    fuites.length === 0,
    fuites.join(" ; ")
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── A8. Schéma, migration & documentation ──");
{
  const schema = lire("prisma/schema.prisma");
  const ensure = lire("src/lib/ensure-schema.ts");
  const envExemple = lire(".env.example");

  verifie(
    "Modèle PaymentGatewayConfig déclaré (clé chiffrée @db.Text, jamais en clair)",
    schema.includes("model PaymentGatewayConfig") &&
      schema.includes("secretKeyEnc     String?  @db.Text") &&
      schema.includes("webhookSecretEnc String?  @db.Text")
  );
  verifie(
    "Le modèle ne stocke JAMAIS la clé en clair (aucune colonne secretKey simple)",
    !/^\s+secretKey\s+String(\s|@)/m.test(schema)
  );
  verifie(
    "ensurePaiementsTable : CREATE TABLE IF NOT EXISTS idempotent (pattern V3.82)",
    ensure.includes("ensurePaiementsTable") &&
      ensure.includes('CREATE TABLE IF NOT EXISTS "PaymentGatewayConfig"')
  );
  verifie(
    ".env.example : PAYMENTS_MASTER_KEY documenté (chiffrement des secrets)",
    envExemple.includes("PAYMENTS_MASTER_KEY")
  );
  verifie(
    ".env.example : les variables V3.82 présentées comme REPLI (back-office prime)",
    envExemple.includes("PRIMENT sur ces variables") || envExemple.includes("REPLI")
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n── B. Tests runtime (bun) : scripts/v383-tests-runtime.ts ──");
{
  const { execSync } = require("child_process");
  try {
    const sortie = execSync("bun scripts/v383-tests-runtime.ts", {
      cwd: RACINE,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });
    process.stdout.write(sortie);
    // Résumé final du script runtime : « Runtime V3.83 : X ✔ / Y ✘ ».
    const resume = sortie.match(/Runtime V3\.83\s*:\s*(\d+)\s*✔\s*\/\s*(\d+)\s*✘/);
    const reussites = resume ? parseInt(resume[1], 10) : 0;
    const echecsRuntime = resume ? parseInt(resume[2], 10) : -1;
    verifie(
      `Tests runtime exécutés (${reussites} vérifications)`,
      echecsRuntime === 0 && reussites > 0
    );
  } catch (e) {
    console.error(String(e.stdout || "") + String(e.stderr || ""));
    verifie("Tests runtime exécutés", false, "bun a échoué");
  }
}

// ═══════════════════════════════════════════════════════════════════
console.log(
  `\n════════════════════════════════════════════════\n` +
    `Résultat : ${passes} ✔ / ${echecs} ✘\n`
);
process.exit(echecs === 0 ? 0 : 1);
