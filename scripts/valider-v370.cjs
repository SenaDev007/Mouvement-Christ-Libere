/**
 * ⭐ V3.70 — Validation statique : BACKEND SUR api.mouvementchristlibere.com
 * + RELAIS EMAIL Resend (la clé vit sur Railway).
 *
 * Demandes pasteur :
 *   « Désormais ce sera api.mouvementchristlibere.com le lien du backend. »
 *   → Socket.io : domaine officiel par défaut en production (fallback
 *     intelligent, plus jamais localhost par erreur) ;
 *   → Emails Resend : si RESEND_API_KEY est absente de Vercel, chaque envoi
 *     (OTP, courriers, demandes) est RELAYÉ au backend
 *     (POST /api/email/send — server-to-server, anti-relais, rate-limit) ;
 *   → Backend Railway : route relais + /api/email/health montées, domaine
 *     documenté.
 *
 * Usage : node scripts/valider-v370.cjs
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
function contient(p, motif, occurrences = 1) {
  const t = lit(p);
  return (t.match(new RegExp(motif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length >= occurrences;
}
function existe(p) {
  return fs.existsSync(path.join(racine, p));
}
function parseOK(p) {
  const parser = require(path.join(racine, "node_modules/@babel/parser"));
  try {
    parser.parse(lit(p), { sourceType: "module", plugins: ["typescript", "jsx"] });
    return true;
  } catch {
    return false;
  }
}

console.log("════ V3.70 — Moteur email : relais backend ════");

const email = lit("src/lib/email.ts");
verifie("email.ts : BACKEND_EMAIL_URL_PAR_DEFAUT = api.mouvementchristlibere.com",
  contient("src/lib/email.ts", "BACKEND_EMAIL_URL_PAR_DEFAUT = \"https://api.mouvementchristlibere.com\""));
verifie("email.ts : URL relais = BACKEND_URL → NEXT_PUBLIC_API_URL → défaut",
  contient("src/lib/email.ts", "process.env.BACKEND_URL") && contient("src/lib/email.ts", "process.env.NEXT_PUBLIC_API_URL"));
verifie("email.ts : chemin relais /api/email/send",
  contient("src/lib/email.ts", "/api/email/send"));
verifie("email.ts : sans clé locale → envoyerViaRelaisBackend (et non un échec sec)",
  contient("src/lib/email.ts", "if (!cleResendPresente()) {\n    return envoyerViaRelaisBackend(options);"));
verifie("email.ts : secret X-Email-Secret transmis si EMAIL_SERVICE_SECRET",
  contient("src/lib/email.ts", "X-Email-Secret") && contient("src/lib/email.ts", "EMAIL_SERVICE_SECRET"));
verifie("email.ts : relais 12 s + journalisation conservée (OutgoingEmail)",
  contient("src/lib/email.ts", "12_000") && contient("src/lib/email.ts", "journaliser(options, resultat)"));
verifie("email.ts : chemin direct Resend intact (clé sur Vercel → V3.69)",
  contient("src/lib/email.ts", "RESEND_ENDPOINT") && contient("src/lib/email.ts", "Authorization: `Bearer ${process.env.RESEND_API_KEY}`"));
verifie("email.ts parse OK", parseOK("src/lib/email.ts"));

console.log("\n════ V3.70 — Backend Railway : route relais ════");

verifie("backend/src/routes/email.ts : présent et parse OK",
  existe("backend/src/routes/email.ts") && parseOK("backend/src/routes/email.ts"));
const routeEmail = lit("backend/src/routes/email.ts");
verifie("relais : anti-relais (compte en base OU EMAIL_KONGO/EMAIL_PAM/PASTEUR_EMAIL)",
  contient("backend/src/routes/email.ts", "destinataireAutorise") && contient("backend/src/routes/email.ts", "PASTEUR_EMAIL"));
verifie("relais : rate-limit fenêtre glissante (IP + destinataire)",
  contient("backend/src/routes/email.ts", "relay-ip:") && contient("backend/src/routes/email.ts", "relay-to:"));
verifie("relais : tailles plafonnées (objet/html/texte)",
  contient("backend/src/routes/email.ts", "LIMITES") && contient("backend/src/routes/email.ts", "sujet: 200"));
verifie("relais : expéditeur FIXE noreply@mouvementchristlibere.com",
  contient("backend/src/routes/email.ts", "noreply@mouvementchristlibere.com"));
verifie("relais : secret X-Email-Secret exigé si EMAIL_SERVICE_SECRET",
  contient("backend/src/routes/email.ts", "x-email-secret"));
verifie("relais : envoi via Resend avec RESEND_API_KEY du backend",
  contient("backend/src/routes/email.ts", "RESEND_API_KEY") && contient("backend/src/routes/email.ts", "https://api.resend.com/emails"));
verifie("relais : 503 explicite si la clé manque sur Railway",
  contient("backend/src/routes/email.ts", "503"));
verifie("relais : GET /api/email/health (diagnostique clé + domaine)",
  contient("backend/src/routes/email.ts", '"/health"') && contient("backend/src/routes/email.ts", "api.mouvementchristlibere.com"));

const indexBackend = lit("backend/src/index.ts");
verifie("backend/index.ts : route /api/email montée",
  contient("backend/src/index.ts", 'app.use("/api/email", emailRoutes)'));
verifie("backend/index.ts : domaine officiel documenté",
  contient("backend/src/index.ts", "api.mouvementchristlibere.com"));
verifie("backend/index.ts parse OK", parseOK("backend/src/index.ts"));

console.log("\n════ V3.70 — Socket.io & api-client ════");

const socket = lit("src/lib/chat/socket-client.ts");
verifie("socket-client : priorité NEXT_PUBLIC_API_URL inchangée",
  contient("src/lib/chat/socket-client.ts", "process.env.NEXT_PUBLIC_API_URL"));
verifie("socket-client : production sans variable → api.mouvementchristlibere.com",
  contient("src/lib/chat/socket-client.ts", "return \"https://api.mouvementchristlibere.com\";"));
verifie("socket-client : localhost:3001 réservé au dev local (détection hôte)",
  contient("src/lib/chat/socket-client.ts", "estLocal") && contient("src/lib/chat/socket-client.ts", "http://localhost:3001"));
verifie("socket-client parse OK", parseOK("src/lib/chat/socket-client.ts"));

verifie("api-client.ts : domaine officiel documenté",
  contient("src/lib/api-client.ts", "api.mouvementchristlibere.com"));

console.log("\n════ V3.70 — Non-régression V3.69 (emails + OTP) ════");

verifie("forgot-password : moteur email toujours appelé (OTP)",
  contient("src/app/api/auth/forgot-password/route.ts", "envoyerEmail"));
verifie("courrier : moteur email toujours appelé (secrétariat)",
  contient("src/app/secretariat/api/courrier/route.ts", "envoyerEmail"));
verifie("composant « Mot de passe oublié » intact (4 pages login)",
  existe("src/components/auth/mot-de-passe-oublie.tsx"));
verifie("templates V3.69 inchangés (email-templates.ts présent)",
  existe("src/lib/email-templates.ts"));

console.log("\n════ V3.70 — Documentation ════");
verifie("docs/V370-BACKEND-EMAILS.md : checklist (Vercel, Railway, Resend, tests)",
  contient("docs/V370-BACKEND-EMAILS.md", "Checklist") && contient("docs/V370-BACKEND-EMAILS.md", "api/email/health"));
verifie("tsconfig-v370-check.json : périmètre de typecheck présent",
  existe("tsconfig-v370-check.json"));

console.log(`\n════ RÉSULTAT : ${ok} ✓ / ${ko} ✘ ════`);
if (ko > 0) process.exit(1);
console.log("V3.70 — VALIDATION COMPLÈTE : backend api.mouvementchristlibere.com + relais email en place.");
