/**
 * ⭐ V3.82 — Tests d'exécution (bun) des briques pures des dons.
 *
 *   ① Signature FedaPay : HMAC-SHA256 du corps brut (valide → vrai ;
 *      corps modifié / signature inconnue / secret absent → faux) ;
 *   ② Signature Paystack : HMAC-SHA512 (mêmes contre-épreuves) ;
 *   ③ Génération de référence (format don_<temps>_<hex>, unicité) ;
 *   ④ Formatage des montants XOF (séparateurs milliers stables) ;
 *   ⑤ Aperçu réel de l'email de reçu (HTML sur disque — relecture VLM).
 *
 * Exécution : bun scripts/v382-tests-runtime.ts
 */

import { createHmac } from "crypto";
import { writeFileSync, mkdirSync } from "fs";

process.env.FEDAPAY_WEBHOOK_SECRET = "secret-wh-fedapay-test";
process.env.PAYSTACK_SECRET_KEY = "sk_test_paystack_demo";

const {
  verifierSignatureFedapay,
} = await import("../src/lib/payments/fedapay.service.ts");
const {
  verifierSignaturePaystack,
} = await import("../src/lib/payments/paystack.service.ts");
const {
  genererReferenceDon,
  formaterMontantXof,
  emailValide,
  montantValide,
} = await import("../src/lib/payments/payment-types.ts");
const {
  sujetRecuDon,
  templateRecuDon,
} = await import("../src/lib/email-templates.ts");

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

console.log("\n── B1. Signature webhook FedaPay (HMAC-SHA256) ──");
const corpsFeda = JSON.stringify({
  name: "transaction.approved",
  entity: { id: 123456, custom_metadata: { reference: "don_test_abc" } },
});
const signatureFedaValide = createHmac("sha256", "secret-wh-fedapay-test")
  .update(corpsFeda, "utf8")
  .digest("hex");
verifie("Signature valide acceptée", verifierSignatureFedapay(corpsFeda, signatureFedaValide));
verifie("Signature MAJUSCULE acceptée (insensibilité casse)", verifierSignatureFedapay(corpsFeda, signatureFedaValide.toUpperCase()));
verifie("Corps modifié → rejet", !verifierSignatureFedapay(corpsFeda + " ", signatureFedaValide));
verifie("Signature étrangère → rejet", !verifierSignatureFedapay(corpsFeda, "deadbeef".repeat(8)));
verifie("Signature manquante → rejet", !verifierSignatureFedapay(corpsFeda, null));
verifie("Signature de longueur différente → rejet (pas d'exception)", !verifierSignatureFedapay(corpsFeda, "abc123"));

console.log("\n── B2. Signature webhook Paystack (HMAC-SHA512) ──");
const corpsPay = JSON.stringify({
  event: "charge.success",
  data: { id: 98765, reference: "don_test_abc", amount: 1000000 },
});
const signaturePayValide = createHmac("sha512", "sk_test_paystack_demo")
  .update(corpsPay, "utf8")
  .digest("hex");
verifie("Signature valide acceptée", verifierSignaturePaystack(corpsPay, signaturePayValide));
verifie("Corps modifié → rejet", !verifierSignaturePaystack(corpsPay + "x", signaturePayValide));
verifie("Signature manquante → rejet", !verifierSignaturePaystack(corpsPay, null));
verifie("Secret absent → rejet silencieux", (() => {
  const precedent = process.env.PAYSTACK_SECRET_KEY;
  const precedentW = process.env.PAYSTACK_WEBHOOK_SECRET;
  delete process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_WEBHOOK_SECRET;
  const resultat = verifierSignaturePaystack(corpsPay, signaturePayValide);
  process.env.PAYSTACK_SECRET_KEY = precedent;
  if (precedentW) process.env.PAYSTACK_WEBHOOK_SECRET = precedentW;
  return !resultat;
})());

console.log("\n── B3. Références de don ──");
const refs = new Set<string>();
for (let i = 0; i < 500; i++) {
  refs.add(genererReferenceDon());
}
verifie("500 références générées toutes uniques", refs.size === 500);
verifie(
  "Format don_<base36>_<hex10>",
  [...refs].every((r) => /^don_[a-z0-9]+_[a-f0-9]{10}$/.test(r))
);

console.log("\n── B4. Validation des entrées ──");
verifie("Email valide accepté", emailValide("donateur@example.com"));
verifie("Email invalide rejeté", !emailValide("pas-un-email") && !emailValide("a@b"));
verifie("Montant 100 accepté (borne basse)", montantValide(100));
verifie("Montant 99 rejeté", !montantValide(99));
verifie("Montant 5 000 000 accepté (borne haute)", montantValide(5_000_000));
verifie("Montant 5 000 001 rejeté", !montantValide(5_000_001));
verifie("Montant décimal rejeté", !montantValide(1500.5));

console.log("\n── B5. Formatage XOF ──");
verifie("10 000 → « 10\\u202F000\\u00A0FCFA »", formaterMontantXof(10000) === "10\u202F000\u00A0FCFA");
verifie("250 000 → séparateurs stables", formaterMontantXof(250000) === "250\u202F000\u00A0FCFA");

console.log("\n── B6. Aperçu de l'email de reçu ──");
mkdirSync("download", { recursive: true });
const scenarios: Array<{
  nom: string;
  options: Parameters<typeof templateRecuDon>[0];
}> = [
  {
    nom: "dime",
    options: {
      nom: "Jean Kouassi",
      montant: 25000,
      devise: "XOF",
      typeDon: "dime",
      reference: "don_lz3k9f2a_4b1c2d3e4f",
      provider: "fedapay",
      date: new Date("2026-09-15T10:30:00Z"),
    },
  },
  {
    nom: "offrande",
    options: {
      nom: null,
      montant: 5000,
      devise: "XOF",
      typeDon: "offrande",
      reference: "don_lz3k9abc_99a1b2c3d4",
      provider: "paystack",
      date: new Date("2026-09-15T10:30:00Z"),
    },
  },
  {
    nom: "don",
    options: {
      nom: "Sœur Marie",
      montant: 100000,
      devise: "XOF",
      typeDon: "don",
      reference: "don_lz3k9xyz_0f1e2d3c4b",
      provider: "fedapay",
      date: new Date("2026-09-15T10:30:00Z"),
    },
  },
];
for (const scenario of scenarios) {
  const { html, text } = templateRecuDon(scenario.options);
  writeFileSync(`download/apercu-recu-don-${scenario.nom}.html`, html);
  writeFileSync(`download/apercu-recu-don-${scenario.nom}.txt`, text);
  verifie(
    `Aperçu ${scenario.nom} : logo + nom conforme + archives`,
    html.includes("logo-email.png") &&
      html.includes("Lib&eacute;re") &&
      !html.includes("Libéré") &&
      html.includes("archives") &&
      text.includes("Mouvement Christ Libère")
  );
  verifie(
    `Aperçu ${scenario.nom} : montant formaté présent`,
    html.includes("FCFA") && (scenario.nom === "offrande" ? html.includes("5") : true)
  );
}
console.log(`    → aperçus écrits dans download/apercu-recu-don-*.html`);

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log(`RÉSULTAT RUNTIME : ${passes} ✔ / ${echecs} ✘`);
if (echecs > 0) {
  process.exit(1);
}
