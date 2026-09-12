/**
 * ⭐ V3.69 — Validation statique : EMAILS RESEND + ACCRÉDITATION.
 *
 * Demandes pasteur :
 *   ① Accréditation : un email déjà membre peut devenir secrétaire/trésorier
 *      (fin du refus 409 sur /admin/api/staff) ;
 *   ② Resend : envois depuis noreply@mouvementchristlibere.com (clé
 *      RESEND_API_KEY), journalisés dans OutgoingEmail ;
 *   ③ « Mot de passe oublié » par OTP email sur les 4 pages de login ;
 *   ④ Courrier du secrétariat au serviteur (page dédiée + email automatique
 *      à la transmission d'une demande).
 *
 * Usage : node scripts/valider-v369.cjs
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

// ═════════════════════════════════════════════════════════════════════
console.log("═══ ① Accréditation d'un compte existant (/admin/api/staff) ═══");
const staffRoute = lit("src/app/admin/api/staff/route.ts");
verifie(
  "Le refus brut « Un compte existe déjà avec cet email » a disparu du POST staff",
  !contient("src/app/admin/api/staff/route.ts", "Un compte existe déjà avec cet email")
);
verifie(
  "Branche d'accréditation des comptes MEMBER (db.user.update)",
  staffRoute.includes("accreditation-compte-existant") &&
    /db\.user\.update\(/.test(staffRoute)
);
verifie(
  "Réponse { accredite: true, ancienRole } distinguée de la création",
  staffRoute.includes("accredite: true") && staffRoute.includes("ancienRole")
);
verifie(
  "Comptes à rôle étendu (SUPER_ADMIN/ADMIN/…) refusés avec message explicite",
  staffRoute.includes("SUPER_ADMIN\", \"ADMIN\", \"MODERATOR\", \"ANIMATOR")
);
verifie(
  "Audit STAFF conserve le mode + l'ancien rôle",
  staffRoute.includes("mode: \"accreditation-compte-existant\"") &&
    staffRoute.includes("ancienRole: existant.role")
);
verifie(
  "UI staff : message différencié accréditation vs création (data.accredite)",
  contient("src/app/admin/staff/staff-client.tsx", "data.accredite") &&
    lit("src/app/admin/staff/staff-client.tsx").includes("accrédité")
);
verifie(
  "UI staff : le formulaire annonce l'accréditation possible (hint)",
  lit("src/app/admin/staff/staff-client.tsx").includes("accréditer un membre") ||
    lit("src/app/admin/staff/staff-client.tsx").includes("Créer un compte / accréditer un membre")
);

// ═════════════════════════════════════════════════════════════════════
console.log("═══ ② Schéma Prisma + DDL idempotent ═══");
const schema = lit("prisma/schema.prisma");
verifie("Modèle PasswordResetOtp dans le schéma", /model PasswordResetOtp \{/.test(schema));
verifie("Modèle OutgoingEmail dans le schéma", /model OutgoingEmail \{/.test(schema));
verifie(
  "Le code OTP est stocké HACHÉ (codeHash — jamais « code » en clair)",
  schema.includes("codeHash") && !/^\s*code\s+String/m.test(
    schema.slice(schema.indexOf("model PasswordResetOtp"), schema.indexOf("model OutgoingEmail"))
  )
);
const ensure = lit("src/lib/ensure-schema.ts");
verifie(
  "ensureEmailTables() : CREATE TABLE IF NOT EXISTS × 2 + index",
  ensure.includes("export function ensureEmailTables") &&
    (ensure.match(/CREATE TABLE IF NOT EXISTS "PasswordResetOtp"/g) || []).length === 1 &&
    (ensure.match(/CREATE TABLE IF NOT EXISTS "OutgoingEmail"/g) || []).length === 1 &&
    (ensure.match(/CREATE INDEX IF NOT EXISTS "OutgoingEmail/g) || []).length >= 2
);

// ═════════════════════════════════════════════════════════════════════
console.log("═══ ③ Moteur Resend (src/lib/email.ts + templates) ═══");
const emailLib = lit("src/lib/email.ts");
verifie("envoyerEmail() exporté", emailLib.includes("export async function envoyerEmail"));
verifie(
  "Expéditeur par défaut noreply@mouvementchristlibere.com",
  emailLib.includes("noreply@mouvementchristlibere.com")
);
verifie(
  "Appel API Resend par fetch natif (zéro dépendance npm « resend »)",
  emailLib.includes("https://api.resend.com/emails") &&
    !/require\(["']resend["']\)/.test(emailLib)
);
verifie(
  "Clé absente → erreur explicite Vercel (pas de crash)",
  emailLib.includes("RESEND_API_KEY est absente") &&
    emailLib.includes("Vercel")
);
verifie(
  "Timeout d'envoi (AbortController) + statut HTTP vérifié",
  emailLib.includes("AbortController") && emailLib.includes("reponse.ok")
);
verifie(
  "Journalisation OutgoingEmail ENVOYE/ECHOUE (best-effort)",
  emailLib.includes("status: resultat.ok ? \"ENVOYE\" : \"ECHOUE\"")
);
verifie(
  "resoudreEmailServiteur : env (EMAIL_KONGO/EMAIL_PAM) → DB SUPER_ADMIN → seed",
  emailLib.includes("resoudreEmailServiteur") &&
    emailLib.includes("EMAIL_KONGO") &&
    emailLib.includes("SUPER_ADMIN")
);
const templates = lit("src/lib/email-templates.ts");
verifie(
  "Templates : OTP + courrier + demande transmise + test",
  templates.includes("export function templateOtp") &&
    templates.includes("export function templateCourrier") &&
    templates.includes("export function templateDemandeTransmise") &&
    templates.includes("export function templateTest")
);
verifie(
  "Templates : échappement HTML des contenus utilisateurs",
  templates.includes("export function echapperHtml")
);
verifie(
  "Templates : palette V3.68 (noir/or/feu) — pas de violet",
  templates.includes("#C9A227") &&
    templates.includes("#FF7A1A") &&
    !/2A0E3D|7C3AED|8B5CF6/i.test(templates)
);

// ═════════════════════════════════════════════════════════════════════
console.log("═══ ④ OTP « Mot de passe oublié » (routes publiques) ═══");
const forgot = lit("src/app/api/auth/forgot-password/route.ts");
const reset = lit("src/app/api/auth/reset-password/route.ts");
verifie(
  "forgot-password : hachage SHA-256 + randomInt (code jamais en clair)",
  forgot.includes('createHash("sha256")') && forgot.includes("randomInt")
);
verifie(
  "forgot-password : anti-harcèlement 1/min + 5/h",
  forgot.includes("DELAI_ENTRE_ENVOIS_MS = 60_000") &&
    forgot.includes("MAX_ENVOIS_PAR_HEURE = 5")
);
verifie(
  "forgot-password : validité 10 min + codes précédents invalidés",
  forgot.includes("VALIDITE_CODE_MIN = 10") &&
    forgot.includes("consumedAt: maintenant")
);
verifie(
  "forgot-password : envoi via envoyerEmail + échec signalé (503)",
  forgot.includes("envoyerEmail") && forgot.includes("503")
);
verifie(
  "reset-password : bcrypt(12) + comparaison temps constant",
  reset.includes("bcrypt.hash") && reset.includes("timingSafeEqual")
);
verifie(
  "reset-password : 5 tentatives max + usage unique + audit PASSWORD_RESET",
  reset.includes("MAX_TENTATIVES = 5") &&
    reset.includes("consumedAt: maintenant") &&
    reset.includes("PASSWORD_RESET")
);
verifie(
  "reset-password : tous les codes de l'email invalidés après succès",
  reset.includes("updateMany") && /consumedAt: maintenant[\s\S]{0,200}updateMany/.test(reset)
);

// ═════════════════════════════════════════════════════════════════════
console.log("═══ ⑤ UI « Mot de passe oublié » sur les 4 logins ═══");
const composant = lit("src/components/auth/mot-de-passe-oublie.tsx");
verifie(
  "Composant partagé : parcours email → code → succès (2 variantes)",
  composant.includes("/api/auth/forgot-password") &&
    composant.includes("/api/auth/reset-password") &&
    composant.includes('variante = "claire"')
);
verifie(
  "/login (membre) : bloc intégré (variante claire)",
  lit("src/app/login/page.tsx").includes("MotDePasseOublie") &&
    lit("src/app/login/page.tsx").includes('variante="claire"')
);
verifie(
  "/admin/login (back-office) : bloc intégré (variante claire)",
  lit("src/app/admin/login/page.tsx").includes("MotDePasseOublie") &&
    lit("src/app/admin/login/page.tsx").includes('variante="claire"')
);
verifie(
  "LoginView (secretariat + tresorerie) : bloc intégré (variante sombre)",
  lit("src/components/staff-space/login-view.tsx").includes("MotDePasseOublie") &&
    lit("src/components/staff-space/login-view.tsx").includes('variante="sombre"')
);
verifie(
  "Pas de formulaire imbriqué (le bloc est HORS du <form> de connexion)",
  !/MotDePasseOublie[^<]*<\/form>/.test(
    lit("src/app/login/page.tsx") + lit("src/app/admin/login/page.tsx")
  )
);

// ═════════════════════════════════════════════════════════════════════
console.log("═══ ⑥ Courrier du secrétariat au serviteur ═══");
const courrierApi = lit("src/app/secretariat/api/courrier/route.ts");
verifie(
  "API /secretariat/api/courrier : GET (destinataires + historique) + POST",
  courrierApi.includes("export async function GET") &&
    courrierApi.includes("export async function POST") &&
    courrierApi.includes("listerServiteursDestinataires")
);
verifie(
  "POST : garde SECRETARY/SUPER_ADMIN + validation sujet/message",
  courrierApi.includes("ROLES_SECRETARIAT") &&
    courrierApi.includes("150") &&
    courrierApi.includes("5000")
);
verifie(
  "Reply-To = email de la secrétaire (réponse directe)",
  courrierApi.includes("replyTo: expeditrice.email")
);
verifie(
  "Destinataire restreint aux SUPER_ADMIN (serviteurs)",
  courrierApi.includes("SUPER_ADMIN")
);
verifie(
  "Mode test : email de vérification à sa propre adresse",
  courrierApi.includes('action === "test"') && courrierApi.includes("templateTest")
);
verifie(
  "Audit COURRIER_SERVITEUR + journalisation",
  courrierApi.includes("COURRIER_SERVITEUR")
);
const courrierPage = lit("src/app/secretariat/courrier/page.tsx");
verifie(
  "Page /secretariat/courrier : formulaire + historique + email de test",
  courrierPage.includes("Courrier au serviteur") &&
    courrierPage.includes("historique") &&
    courrierPage.includes('action: "test"')
);
verifie(
  "Navigation : « Courrier au serviteur » dans le layout secrétariat",
  lit("src/app/secretariat/layout.tsx").includes("/secretariat/courrier")
);

// ═════════════════════════════════════════════════════════════════════
console.log("═══ ⑦ Email automatique à la transmission d'une demande ═══");
const demandesId = lit("src/app/secretariat/api/demandes/[id]/route.ts");
verifie(
  "PATCH demandes : courriel automatique au serviteur (action transmettre)",
  demandesId.includes("templateDemandeTransmise") &&
    demandesId.includes("resoudreEmailServiteur")
);
verifie(
  "Best-effort : l'échec email n'annule PAS la transmission (signalé dans la réponse)",
  demandesId.includes("courriel") && demandesId.includes("envoye: false, erreur")
);
const demandesPage = lit("src/app/secretariat/demandes/page.tsx");
verifie(
  "UI demandes : bandeau de confirmation (email envoyé / échec signalé)",
  demandesPage.includes("data.courriel") && demandesPage.includes("confirmation")
);

// ═════════════════════════════════════════════════════════════════════
console.log("═══ ⑧ Garde-fous transverses ═══");
// Aucun appel Resend en dehors du moteur (jamais depuis le client).
let appelsResend = [];
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
for (const f of tousFichiers(path.join(racine, "src"), [".ts", ".tsx"])) {
  if (f.endsWith(path.join("src", "lib", "email.ts"))) continue;
  const t = fs.readFileSync(f, "utf8");
  if (t.includes("api.resend.com") || t.includes("RESEND_API_KEY")) {
    appelsResend.push(path.relative(racine, f));
  }
}
verifie(
  `Appels Resend centralisés dans src/lib/email.ts uniquement (transgresseurs: ${
    appelsResend.join(", ") || "aucun"
  })`,
  appelsResend.length === 0
);
// package.json inchangé côté dépendances (fetch natif).
const pkg = lit("package.json");
verifie(
  "Aucune dépendance « resend »/« nodemailer » ajoutée (fetch natif)",
  !/"(resend|nodemailer)"/.test(pkg)
);

// ═════════════════════════════════════════════════════════════════════
console.log("");
console.log(`RÉSULTAT : ${ok} ✓ / ${ko} ✗`);
process.exit(ko === 0 ? 0 : 1);
