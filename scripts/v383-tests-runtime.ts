/**
 * ⭐ V3.83 — Tests runtime des fonctions critiques du module de
 * configuration des passerelles (exécutés par scripts/validate-v383.cjs).
 *
 *   ① chiffrement AES-256-GCM : aller-retour, falsification, mauvaise
 *      clé maîtresse ;
 *   ② résolution de configuration : repli environnement, secret webhook
 *      Paystack = clé du compte, « absente » sinon ;
 *   ③ non-régression des signatures de webhooks (HMAC-SHA256 FedaPay,
 *      HMAC-SHA512 Paystack) après l'asynchronisation.
 *
 * Exécution : bun scripts/v383-tests-runtime.ts
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

import {
  chiffrerSecret,
  dechiffrerSecret,
  lireConfigPasserelle,
  invaliderCachePasserelles,
  empreinteSecret,
} from "../src/lib/payments/gateway-config";
import { verifierSignatureFedapay } from "../src/lib/payments/fedapay.service";
import { verifierSignaturePaystack } from "../src/lib/payments/paystack.service";
import { createHmac } from "crypto";

let passes = 0;
let echecs = 0;

function verifie(libelle: string, condition: boolean, detail = "") {
  if (condition) {
    passes++;
    console.log(`  ✔ ${libelle}`);
  } else {
    echecs++;
    console.error(`  ✘ ${libelle}${detail ? " — " + detail : ""}`);
  }
}

// ── ① Chiffrement AES-256-GCM ──────────────────────────────────────

process.env.SESSION_SECRET = "cle-maitresse-de-test-v383";
delete process.env.PAYMENTS_MASTER_KEY;

const cleApi = "sk_live_EXEMPLE_0123456789abcdef";
const stocke = chiffrerSecret(cleApi);
verifie("Chiffrement : format v1 à 5 segments hexadécimaux", /^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(stocke), stocke.slice(0, 40));
verifie(
  "Aller-retour : dechiffrerSecret(chiffrerSecret(x)) === x",
  dechiffrerSecret(stocke) === cleApi
);
verifie(
  "Le secret chiffré ne contient PAS la clé en clair",
  !stocke.includes(cleApi) && !stocke.includes("EXEMPLE")
);
verifie(
  "Falsification : un octet modifié → rejet (authTag GCM)",
  dechiffrerSecret(stocke.slice(0, -4) + "0000") === null
);
verifie(
  "Format invalide → null (jamais d'exception)",
  dechiffrerSecret("n'importe quoi") === null
);

// Mauvaise clé maîtresse : impossible de déchiffrer.
process.env.PAYMENTS_MASTER_KEY = "autre-cle-maitresse-invalide";
verifie(
  "Mauvaise clé maîtresse → null (les secrets restent illisibles)",
  dechiffrerSecret(stocke) === null
);
delete process.env.PAYMENTS_MASTER_KEY;
process.env.SESSION_SECRET = "cle-maitresse-de-test-v383";
verifie(
  "La bonne clé maîtresse déchiffre à nouveau",
  dechiffrerSecret(stocke) === cleApi
);

// Deux chiffrements du même secret diffèrent (IV + sel aléatoires).
const stocke2 = chiffrerSecret(cleApi);
verifie(
  "Deux chiffrements du même secret diffèrent (sel + IV aléatoires)",
  stocke !== stocke2 && dechiffrerSecret(stocke2) === cleApi
);

// Empreinte : courte, stable, sans révéler le secret.
verifie(
  "Empreinte stable et tronquée (8 hex), sans fuite du secret",
  empreinteSecret(cleApi) === empreinteSecret(cleApi) &&
    empreinteSecret(cleApi).length === 8 &&
    !empreinteSecret(cleApi).includes("sk_live")
);

// ── ② Résolution : repli environnement ─────────────────────────────

// (Base locale injoignable dans ce bac → repli automatique garanti.)
process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_envfedapay_0123456789";
process.env.FEDAPAY_WEBHOOK_SECRET = "secret-webhook-fedapay-v383";
process.env.FEDAPAY_ENV = "live";
process.env.PAYSTACK_SECRET_KEY = "sk_test_envpaystack_0123456789";
delete process.env.PAYSTACK_WEBHOOK_SECRET;

const configFedapay = await lireConfigPasserelle("fedapay");
verifie(
  "Repli FedaPay : clé lue depuis l'environnement (base absente)",
  configFedapay.secretKey === "sk_sandbox_envfedapay_0123456789" &&
    configFedapay.source === "environnement"
);
verifie(
  "Repli FedaPay : environnement respecté (live)",
  configFedapay.environment === "live"
);
verifie(
  "Repli FedaPay : secret webhook lu depuis l'environnement",
  configFedapay.webhookSecret === "secret-webhook-fedapay-v383"
);

const configPaystack = await lireConfigPasserelle("paystack");
verifie(
  "Repli Paystack : sans PAYSTACK_WEBHOOK_SECRET, la clé du compte sert de secret",
  configPaystack.webhookSecret === "sk_test_envpaystack_0123456789"
);

delete process.env.FEDAPAY_SECRET_KEY;
delete process.env.FEDAPAY_WEBHOOK_SECRET;
delete process.env.FEDAPAY_ENV;
delete process.env.PAYSTACK_SECRET_KEY;
// Le cache de 15 s renverrait l'ancienne résolution : l'invalidation est
// le mécanisme utilisé par /admin/api/paiements après un enregistrement —
// on vérifie ici qu'il rend la nouvelle lecture immédiate.
invaliderCachePasserelles();
const configAbsente = await lireConfigPasserelle("fedapay");
verifie(
  "Sans aucune configuration : source « absente », clé nulle (jamais de faux succès)",
  configAbsente.source === "absente" && configAbsente.secretKey === null
);

// ── ③ Non-régression des signatures de webhooks ────────────────────

// Les variables reviennent : le cache doit être invalidé pour que la
// résolution les voie immédiatement (même mécanique qu'après enregistrement).
process.env.FEDAPAY_WEBHOOK_SECRET = "secret-webhook-fedapay-v383";
invaliderCachePasserelles();
const corpsFedaPay = JSON.stringify({
  name: "transaction.approved",
  entity: { id: 42, custom_metadata: { reference: "don_test_v383" } },
});
const signatureFedaPayValide = createHmac("sha256", "secret-webhook-fedapay-v383")
  .update(corpsFedaPay, "utf8")
  .digest("hex");
verifie(
  "Signature FedaPay valide acceptée (HMAC-SHA256, après asynchronisation)",
  (await verifierSignatureFedapay(corpsFedaPay, signatureFedaPayValide)) === true
);
verifie(
  "Signature FedaPay FALSIFIÉE rejetée",
  (await verifierSignatureFedapay(corpsFedaPay, "deadbeef" + signatureFedaPayValide.slice(8))) === false
);
verifie(
  "Webhook FedaPay SANS en-tête rejeté",
  (await verifierSignatureFedapay(corpsFedaPay, null)) === false
);

process.env.PAYSTACK_SECRET_KEY = "sk_test_envpaystack_0123456789";
delete process.env.PAYSTACK_WEBHOOK_SECRET;
invaliderCachePasserelles();
const corpsPaystack = JSON.stringify({
  event: "charge.success",
  data: { reference: "don_test_v383", amount: 1000000 },
});
const signaturePaystackValide = createHmac("sha512", "sk_test_envpaystack_0123456789")
  .update(corpsPaystack, "utf8")
  .digest("hex");
verifie(
  "Signature Paystack valide acceptée (HMAC-SHA512, clé du compte par convention)",
  (await verifierSignaturePaystack(corpsPaystack, signaturePaystackValide)) === true
);
verifie(
  "Signature Paystack FALSIFIÉE rejetée",
  (await verifierSignaturePaystack(corpsPaystack, signaturePaystackValide.slice(0, -4) + "1234")) === false
);
verifie(
  "Webhook Paystack SANS en-tête rejeté",
  (await verifierSignaturePaystack(corpsPaystack, null)) === false
);

console.log(
  `\n════════════════════════════════════════════════\n` +
    `Runtime V3.83 : ${passes} ✔ / ${echecs} ✘\n`
);
process.exit(echecs === 0 ? 0 : 1);
