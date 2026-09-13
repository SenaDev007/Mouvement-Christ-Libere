#!/usr/bin/env node
/**
 * ⭐ V3.74.1 — Validation locale du correctif du relais email backend.
 *
 * Contexte : le pasteur doit saisir les VRAIES adresses email des
 * serviteurs via le bouton « Paramétrage » (V3.74, table StaffSetting).
 * PROBLÈME découvert en production : la garde anti-relais du backend
 * Railway (POST /api/email/send) n'autorisait que les User.email en base
 * et les env vars — une adresse paramétrée (ex. gmail) aurait été REFUSÉE
 * (403 « Destinataire inconnu de la plateforme ») : le courrier n'aurait
 * JAMAIS pu partir vers les vraies adresses.
 *
 * Correctif : destinataireAutorise() consulte AUSSI la table StaffSetting
 * (email_kongo / email_pam) en SQL brut — AVANT le repli User.
 *
 * Usage : node scripts/valider-v374-1.cjs
 */
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "..");
let ok = 0;
let ko = 0;
function verifie(etiquette, condition) {
  if (condition) {
    ok++;
    console.log(`  ✔ ${etiquette}`);
  } else {
    ko++;
    console.error(`  ✗ ${etiquette}`);
    process.exitCode = 1;
  }
}

const route = fs.readFileSync(
  path.join(racine, "backend/src/routes/email.ts"),
  "utf8"
);

console.log("── V3.74.1 · Correctif relais email (backend) ────────────");

// ① La garde lit la table StaffSetting avant le repli User.
const idxStaff = route.indexOf('"StaffSetting"');
const idxUser = route.indexOf("db.user.findFirst");
verifie("destinataireAutorise : table StaffSetting consultée", idxStaff > 0);
verifie(
  "StaffSetting consulté AVANT le repli User.findFirst",
  idxStaff > 0 && idxUser > 0 && idxStaff < idxUser
);

// ② SQL brut paramétré (pas d'injection, comparaison insensible cas/espaces).
verifie(
  "requête SQL brute $queryRawUnsafe (schéma backend sans modèle)",
  /\$queryRawUnsafe\s*</.test(route)
);
verifie(
  "paramètre $1 (requête paramétrée — aucune concaténation d'adresse)",
  /LOWER\(TRIM\("value"\)\)\s*=\s*\$1/.test(route)
);
verifie(
  "clés email_kongo / email_pam couvertes",
  /'email_kongo',\s*'email_pam'/.test(route)
);
verifie(
  "comparaison insensible à la casse (LOWER des deux côtés)",
  /adresse\.trim\(\)\.toLowerCase\(\)/.test(route)
);

// ③ Dégradation propre : table absente → repli User ; base morte → REFUS.
const blocStaff = route.slice(
  route.indexOf("try {", route.indexOf("V3.74.1")),
  route.indexOf("try {", route.indexOf("V3.74.1")) + 900
);
verifie(
  "table absente/indisponible → on continue vers le repli (pas d'exception)",
  /Table absente/.test(blocStaff)
);
verifie(
  "repli User inchangé : base indisponible → REFUS (jamais de relais ouvert)",
  /Base indisponible : on REFUSE/.test(route)
);

// ④ Garde-fous intacts (rien d'autre ne doit avoir bougé dans la route).
verifie("secret partagé X-Email-Secret toujours vérifié", /x-email-secret/i.test(route));
verifie("rate-limits 30/h par IP et 12/h par destinataire intacts", /parIp: 30/.test(route) && /parDestinataire: 12/.test(route));
verifie("expéditeur FIXE (jamais contrôlé par l'appelant)", /EXPEDITEUR\(\)/.test(route) && /from: EXPEDITEUR\(\)/.test(route));
verifie("envoi Resend via POST api.resend.com inchangé", /api\.resend\.com\/emails/.test(route));
verifie(
  "env vars PASTEUR_EMAIL / EMAIL_KONGO / EMAIL_PAM toujours autorisées",
  /process\.env\.PASTEUR_EMAIL/.test(route) &&
    /process\.env\.EMAIL_KONGO/.test(route) &&
    /process\.env\.EMAIL_PAM/.test(route)
);

// ⑤ Documentation de l'en-tête mise à jour.
verifie(
  "en-tête Sécurité documente l'autorisation StaffSetting (V3.74.1)",
  /V3\.74\.1/.test(route) && /StaffSetting — bouton/.test(route)
);

console.log("");
console.log(`Résultat : ${ok} ✔ / ${ko} ✗`);
process.exit(ko > 0 ? 1 : 0);
