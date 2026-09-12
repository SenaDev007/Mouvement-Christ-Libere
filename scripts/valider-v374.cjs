#!/usr/bin/env node
/**
 * ⭐ V3.74 — Validation locale (avant push).
 *
 * Cinq demandes du pasteur :
 *  ① Suppression des modules « Demandes de contact » du back-office
 *     (nav + dashboard + page + composant + entité API + modèle/table
 *     ContactRequest + page publique /contact redirigée vers /rendez-vous) ;
 *  ② Trésorerie en CONSULTATION dans le back-office des serviteurs
 *     (/admin/tresorerie — lecture seule, réservée SUPER_ADMIN) ;
 *  ③ Courrier au serviteur : bouton « Paramétrage » des VRAIES adresses
 *     email (StaffSetting, prioritaire sur env/comptes) ;
 *  ④ Flux dynamique des demandes de rencontre : transmission SANS modal
 *     (note inline), source SITE/PRÉSENTIEL, statut VALIDEE partout
 *     (registre, stats, suivi public, CSV, PATCH) ;
 *  ⑤ Module de réception des serviteurs (/admin/demandes + API
 *     valider/traiter) + notification à la secrétaire (StaffNotification +
 *     cloche Secrétariat + email best-effort).
 *
 * Usage : node scripts/valider-v374.cjs
 */
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "..");
let ok = 0;
function verifie(etiquette, condition) {
  if (condition) {
    ok++;
    console.log(`  ✔ ${etiquette}`);
  } else {
    console.error(`  ✗ ${etiquette}`);
    process.exitCode = 1;
  }
}
function lire(rel) {
  return fs.readFileSync(path.join(racine, rel), "utf8");
}

console.log("── V3.74 · ① Suppression « Demandes de contact » ─────────");

const layoutAdmin = lire("src/app/admin/layout.tsx");
verifie(
  "nav admin : plus d'entrée « Demandes de contact » (/admin/contact-requests)",
  !layoutAdmin.includes('"/admin/contact-requests"')
);
verifie(
  "nav admin : nouvelle entrée « Demandes reçues » (/admin/demandes)",
  layoutAdmin.includes('"/admin/demandes"') &&
    layoutAdmin.includes("Demandes reçues")
);
verifie(
  "nav admin : nouvelle entrée « Trésorerie (consultation) » (/admin/tresorerie)",
  layoutAdmin.includes('"/admin/tresorerie"') &&
    layoutAdmin.includes("Trésorerie (consultation)")
);

const dash = lire("src/app/admin/dashboard/page.tsx");
verifie(
  "dashboard admin : plus AUCUNE requête db.contactRequest",
  !dash.includes("db.contactRequest")
);
verifie(
  "dashboard admin : KPI « Demandes reçues » (meetingRequest TRANSMISE)",
  dash.includes("Demandes reçues") &&
    dash.includes('status: "TRANSMISE"')
);
verifie(
  "dashboard admin : section « Demandes transmises » → lien /admin/demandes",
  dash.includes("Demandes transmises") && dash.includes('"/admin/demandes"')
);

verifie(
  "page /admin/contact-requests SUPPRIMÉE",
  !fs.existsSync(path.join(racine, "src/app/admin/contact-requests"))
);
verifie(
  "composant update-contact-status-button SUPPRIMÉ",
  !fs.existsSync(
    path.join(racine, "src/components/admin/update-contact-status-button.tsx")
  )
);
verifie(
  "route /api/contact SUPPRIMÉE",
  !fs.existsSync(path.join(racine, "src/app/api/contact"))
);
verifie(
  "vue contact-view SUPPRIMÉE",
  !fs.existsSync(path.join(racine, "src/components/site/contact-view.tsx"))
);

const entite = lire("src/app/admin/api/[entity]/route.ts");
const entiteId = lire("src/app/admin/api/[entity]/[id]/route.ts");
verifie(
  "routes [entity] : plus de mappage contactrequests",
  !entite.includes("contactrequests") && !entiteId.includes("contactrequests")
);

const schema = lire("prisma/schema.prisma");
verifie(
  "schéma Prisma : modèle ContactRequest SUPPRIMÉ",
  !schema.includes("model ContactRequest")
);
verifie(
  "schéma Prisma : relation User.contactRequests SUPPRIMÉE",
  !schema.includes("contactRequests ContactRequest[]")
);
verifie(
  "schéma Prisma : modèle StaffSetting présent (clé/valeur)",
  schema.includes("model StaffSetting")
);
verifie(
  "schéma Prisma : modèle StaffNotification présent",
  schema.includes("model StaffNotification")
);
verifie(
  "schéma Prisma : MeetingRequest.source/validatedAt/validatedById présents",
  schema.includes("source            String    @default(\"MANUEL\")") &&
    schema.includes("validatedAt       DateTime?") &&
    schema.includes("validatedById     String?")
);

const ensure = lire("src/lib/ensure-schema.ts");
verifie(
  "ensure-schema : DROP TABLE ContactRequest (purge du contenu)",
  ensure.includes('DROP TABLE IF EXISTS "ContactRequest"')
);
verifie(
  "ensure-schema : colonnes MeetingRequest source/validated* créées",
  ensure.includes('ADD COLUMN IF NOT EXISTS "source"') &&
    ensure.includes('ADD COLUMN IF NOT EXISTS "validatedAt"') &&
    ensure.includes('ADD COLUMN IF NOT EXISTS "validatedById"')
);
verifie(
  "ensure-schema : tables StaffSetting + StaffNotification créées",
  ensure.includes('CREATE TABLE IF NOT EXISTS "StaffSetting"') &&
    ensure.includes('CREATE TABLE IF NOT EXISTS "StaffNotification"')
);

const pageContact = lire("src/app/contact/page.tsx");
verifie(
  "page /contact : redirection vers /rendez-vous",
  pageContact.includes('redirect("/rendez-vous")')
);
const navPublique = lire("src/components/ui/navigation-menu-4.tsx");
const footerSite = lire("src/components/site/site-footer.tsx");
const footerCond = lire("src/components/site/conditional-footer.tsx");
verifie(
  "navbar publique : plus de lien /contact",
  !navPublique.includes('"/contact"')
);
verifie(
  "footers : plus de lien /contact",
  !footerSite.includes('href: "/contact"') &&
    !footerCond.includes('href: "/contact"')
);
const motionFooter = lire("src/components/ui/motion-footer.tsx");
verifie(
  "motion-footer : lien rendez-vous (plus de /contact)",
  !motionFooter.includes('href="/contact"')
);

console.log("── V3.74 · ② Trésorerie consultable au back-office ────────");

const pageTreso = lire("src/app/admin/tresorerie/page.tsx");
verifie(
  "page /admin/tresorerie créée (server component)",
  fs.existsSync(path.join(racine, "src/app/admin/tresorerie/page.tsx"))
);
verifie(
  "page : lecture seule (bandeau + aucune action de saisie)",
  pageTreso.includes("lecture seule") &&
    !pageTreso.includes("onClick") // aucune action interactive client
);
verifie(
  "page : réservée SUPER_ADMIN (garde de rôle)",
  pageTreso.includes('session.role !== "SUPER_ADMIN"')
);
verifie(
  "page : situation multicaisse calculée (jamais stockée)",
  pageTreso.includes("calculerSituationMulticaisse")
);
verifie(
  "page : lien vers l'espace Trésorerie (gestion complète)",
  pageTreso.includes("tresorerie.mouvementchristlibere.com")
);

console.log("── V3.74 · ③ Courrier : paramétrage des emails ────────────");

const emailLib = lire("src/lib/email.ts");
verifie(
  "email.ts : lecture du paramétrage StaffSetting (lireEmailParametre)",
  emailLib.includes("export async function lireEmailParametre")
);
verifie(
  "email.ts : résolution prioritaire paramétrage → env → compte → seed",
  emailLib.indexOf("lireEmailParametre(code)") <
    emailLib.indexOf("process.env.EMAIL_PAM")
);
verifie(
  "email.ts : destinataires serviteur:kongo / serviteur:pam toujours présents",
  emailLib.includes('"serviteur:kongo"') && emailLib.includes('"serviteur:pam"')
);

const courrierApi = lire("src/app/secretariat/api/courrier/route.ts");
verifie(
  "API courrier : action « parametrer » (emailKongo / emailPam)",
  courrierApi.includes('action === "parametrer"') &&
    courrierApi.includes("emailKongo")
);
verifie(
  "API courrier : GET renvoie les paramètres effectifs",
  courrierApi.includes("parametres:")
);
verifie(
  "API courrier : résolution des destinataires préfixés (serviteur:/user:)",
  courrierApi.includes("resoudreDestinataireCourrier")
);

const courrierPage = lire("src/app/secretariat/courrier/page.tsx");
verifie(
  "page courrier : bouton « Paramétrage » + modal",
  courrierPage.includes("Paramétrage") && courrierPage.includes("paramModalOuvert")
);
verifie(
  "page courrier : champs email Pasteur Kongo / Sœur Pam",
  courrierPage.includes("Email de Pasteur Kongo") &&
    courrierPage.includes("Email de Sœur Pam")
);

console.log("── V3.74 · ④ Flux dynamique sans ré-édition ────────────────");

const rdvApi = lire("src/app/api/rendez-vous/route.ts");
verifie(
  "API rendez-vous publique : source SITE sur création",
  rdvApi.includes('source: "SITE"')
);
const demandesApi = lire("src/app/secretariat/api/demandes/route.ts");
verifie(
  "saisie manuelle secrétariat : source MANUEL",
  demandesApi.includes('source: "MANUEL"')
);

const demandesPage = lire("src/app/secretariat/demandes/page.tsx");
verifie(
  "registre : plus de modal de transmission (transmettreId supprimé)",
  !demandesPage.includes("transmettreId")
);
verifie(
  "registre : note de transmission INLINE (notes[...])",
  demandesPage.includes("notes[demande.id]")
);
verifie(
  "registre : transmission directe depuis le bouton d'action",
  demandesPage.includes('agir(\n                                demande,\n                                "transmettre"') ||
    demandesPage.includes('"transmettre",\n                                notes[demande.id]')
);
verifie(
  "registre : badges source « Site public » / « Présentiel »",
  demandesPage.includes("Site public") && demandesPage.includes("Présentiel")
);
verifie(
  "registre : date + ligne « Validée par le serviteur »",
  demandesPage.includes("Validée par le serviteur le")
);
verifie(
  "registre : actions pour TRANSMISE **et** VALIDEE (traiter/rouvrir)",
  demandesPage.includes('demande.status === "TRANSMISE" || demande.status === "VALIDEE"')
);

const constants = lire("src/lib/staff-space/constants.ts");
verifie(
  "constants : statut VALIDEE défini",
  constants.includes("VALIDEE: {") && constants.includes('libelle: "Validée"')
);
verifie(
  "constants : DEMANDE_SOURCES SITE/MANUEL définies",
  constants.includes("DEMANDE_SOURCES") && constants.includes("SITE: {")
);

const suiviApi = lire("src/app/api/rendez-vous/suivi/route.ts");
verifie(
  "suivi public : valideeLe renvoyé",
  suiviApi.includes("valideeLe: demande.validatedAt")
);
const suiviView = lire("src/app/rendez-vous/suivi/suivi-view.tsx");
verifie(
  "suivi public : étape « Validée par le serviteur de Dieu » (conditionnelle)",
  suiviView.includes("Validée par le serviteur de Dieu") &&
    suiviView.includes("valideeLe")
);

const statsApi = lire("src/app/secretariat/api/stats/route.ts");
verifie(
  "stats secrétariat : compteur validees",
  statsApi.includes('status: "VALIDEE"') && statsApi.includes("validees,")
);

const patchDemande = lire("src/app/secretariat/api/demandes/[id]/route.ts");
verifie(
  "PATCH demandes : traiter accepte VALIDEE ; rouvrir réinitialise la validation",
  patchDemande.includes(
    'demande.status !== "TRANSMISE" && demande.status !== "VALIDEE"'
  ) && patchDemande.includes("validatedAt: null")
);

console.log("── V3.74 · ⑤ Réception serviteurs + notification ───────────");

verifie(
  "page /admin/demandes créée (module de réception)",
  fs.existsSync(path.join(racine, "src/app/admin/demandes/page.tsx"))
);
const apiDemandes = lire("src/app/admin/api/demandes/route.ts");
verifie(
  "API /admin/api/demandes : garde SUPER_ADMIN + résolution serviteur",
  apiDemandes.includes('exigerSession(request, ["SUPER_ADMIN"])') &&
    apiDemandes.includes("resoudreCodeServiteur")
);
const apiDemandeId = lire("src/app/admin/api/demandes/[id]/route.ts");
verifie(
  "API [id] : action valider (TRANSMISE → VALIDEE + validatedAt/ById)",
  apiDemandeId.includes('action === "valider"') &&
    apiDemandeId.includes("validatedAt: maintenant")
);
verifie(
  "API [id] : notification StaffNotification (espace secretariat)",
  apiDemandeId.includes("staffNotification.create") &&
    apiDemandeId.includes('espace: "secretariat"')
);
verifie(
  "API [id] : email best-effort aux secrétaires (template validation)",
  apiDemandeId.includes("templateDemandeValidee") &&
    apiDemandeId.includes('role: "SECRETARY"')
);
verifie(
  "API [id] : audit DEMANDE_VALIDEE + action traiter",
  apiDemandeId.includes("DEMANDE_VALIDEE") &&
    apiDemandeId.includes('"traiter"')
);

const proxy = lire("src/proxy.ts");
verifie(
  "proxy : /admin/api/demandes passe avec sa garde propre (401 JSON)",
  proxy.includes('"/admin/api/demandes"')
);

const notifApi = lire("src/app/secretariat/api/notifications/route.ts");
verifie(
  "API notifications secrétariat : GET (nonLues + items) + POST marquerLues",
  notifApi.includes("nonLues") && notifApi.includes("marquerLues")
);
verifie(
  "composant cloche de notifications créé",
  fs.existsSync(path.join(racine, "src/components/staff-space/notifications.tsx"))
);
const shell = lire("src/components/staff-space/space-shell.tsx");
verifie(
  "SpaceShell : slot actionsSupplementaires (sidebar + barre mobile)",
  shell.includes("actionsSupplementaires")
);
const layoutSec = lire("src/app/secretariat/layout.tsx");
verifie(
  "layout Secrétariat : cloche branchée",
  layoutSec.includes("ClocheNotifications")
);

const templates = lire("src/lib/email-templates.ts");
verifie(
  "template email de validation créé (secretaire + serviteur)",
  templates.includes("templateDemandeValidee")
);
const emailLib2 = lire("src/lib/email.ts");
verifie(
  "catégorie email DEMANDE_VALIDEE déclarée",
  emailLib2.includes('DEMANDE_VALIDEE: "DEMANDE_VALIDEE"')
);

console.log("──────────────────────────────────────────────────────────");
console.log(`  ${ok} vérification(s) ${process.exitCode ? "✗ ÉCHEC" : "✓ OK"}`);
