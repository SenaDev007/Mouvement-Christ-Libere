#!/usr/bin/env node
/**
 * ⭐ V4.09 — Validation locale : APPLICATION MOBILE « CHRIST LIBÈRE ».
 *
 * 1) Parse Babel de tous les fichiers nouveaux/modifiés.
 * 2) Vérifications structurelles :
 *    - /app : 13 fichiers de route (layout, page principale, 11 sections,
 *      yeshua-connect) ;
 *    - chaque section ré-exporte la page du site public (même vue), est
 *      force-dynamic, noindex et canonique vers la page public ;
 *    - layout-shell : masquage PRÉCIS de /app et /app/* (SANS /appels) ;
 *    - AppShell : header calibré 4rem/5rem (MessagingView), tiroir qui se
 *      déplie/replie (translate-x + backdrop + Échap), 12 destinations,
 *      bloc auth (connexion / création de compte / profil / déconnexion) ;
 *    - AppHomeView : hero piloté par la config « landing » (back-office),
 *      grille de boutons, 2 serviteurs (photos), bannière Yeshua Connect,
 *      prochain live (UpcomingLiveFloat) ;
 *    - manifest : « Christ Libère », start_url /app, id /, scope / ;
 *    - layout racine : applicationName + appleWebApp « Christ Libère » ;
 *    - instructions d'installation : libellé public = « Christ Libère ».
 */

const fs = require("fs");
const babel = require("/home/z/my-project/.tmp-babel/node_modules/@babel/parser");

const R = "/home/z/my-project/mouvement-christ-libere";
let ok = 0, ko = 0;
const check = (label, cond) => {
  if (cond) { ok++; console.log(`  ✔ ${label}`); }
  else { ko++; console.log(`  ✘ ${label}`); }
};
const read = (p) => fs.readFileSync(`${R}/${p}`, "utf8");
const exists = (p) => fs.existsSync(`${R}/${p}`);

/* ════════════════ 1. PARSE BABEL ════════════════ */
console.log("— Parse Babel —");
const FICHIERS = [
  "src/components/app/app-shell.tsx",
  "src/components/app/app-home-view.tsx",
  "src/app/app/layout.tsx",
  "src/app/app/page.tsx",
  "src/app/app/yeshua-connect/page.tsx",
  "src/components/site/layout-shell.tsx",
  "src/components/pwa/instructions-installation.tsx",
  "src/app/layout.tsx",
];
for (const f of FICHIERS) {
  let parsed = true;
  try {
    babel.parse(read(f), { sourceType: "module", plugins: ["jsx", "typescript"] });
  } catch (e) {
    parsed = false;
    console.log(`    Erreur : ${e.message}`);
  }
  check(`${f} se parse`, parsed);
}

/* ════════════════ 2. STRUCTURE DES ROUTES /app ════════════════ */
console.log("— Routes de l'application (/app) —");
const SECTIONS = [
  ["afrika", "/afrika", "Afrika"],
  ["pasteur-kongo", "/pasteur-kongo", "Pasteur Kongo"],
  ["temoignages", "/temoignages", "Témoignages"],
  ["enseignements", "/enseignements", "Enseignements"],
  ["videos", "/videos", "Vidéos"],
  ["adoration-louanges", "/adoration-louanges", "Adoration"],
  ["intercession", "/intercession", "Intercession"],
  ["disperses", "/disperses", "Dispersés"],
  ["contribuer", "/contribuer", "Contribuer"],
  ["annonces", "/annonces", "Annonces"],
  ["rendez-vous", "/rendez-vous", "rendez-vous"],
];
check("layout de l'app présent", exists("src/app/app/layout.tsx"));
check("page principale /app présente", exists("src/app/app/page.tsx"));
check("page Yeshua Connect de l'app présente", exists("src/app/app/yeshua-connect/page.tsx"));
for (const [dir, canon, titre] of SECTIONS) {
  const p = `src/app/app/${dir}/page.tsx`;
  const src = exists(p) ? read(p) : "";
  check(`${p} existe`, exists(p));
  check(`${dir} : ré-exporte la page public`, src.includes(`export { default } from "@/app/${dir}/page"`));
  check(`${dir} : force-dynamic`, /export const dynamic = "force-dynamic"/.test(src));
  check(`${dir} : noindex`, src.includes("index: false"));
  check(`${dir} : canonical ${canon}`, src.includes(`canonical: "${canon}"`));
  check(`${dir} : titre`, src.includes(titre));
}
// La page chat ne ré-exporte pas : wrapper dédié avec callbackUrl app.
const srcChat = read("src/app/app/yeshua-connect/page.tsx");
check("chat : rend YeshuaConnect", srcChat.includes("<YeshuaConnect />"));
check("chat : redirection login avec callbackUrl=/app/yeshua-connect", srcChat.includes('callbackUrl=/app/yeshua-connect'));
check("chat : force-dynamic + noindex", /force-dynamic/.test(srcChat) && srcChat.includes("index: false"));

/* ════════════════ 3. LAYOUT-SHELL — masquage précis ════════════════ */
console.log("— Masquage de la coquille site sur /app —");
const srcShell = read("src/components/site/layout-shell.tsx");
check("match précis /app (pas startsWith brut)", srcShell.includes('pathname === "/app" || pathname.startsWith("/app/")'));
check("utilise isAppRoute dans le rendu", srcShell.includes("isAppRoute(pathname)"));
check("HIDDEN_ROUTES toujours défini (login/register/admin…)", srcShell.includes('const HIDDEN_ROUTES = ["/login", "/register", "/admin", "/secretariat", "/tresorerie"]'));

/* ════════════════ 4. APP-SHELL — header + tiroir ════════════════ */
console.log("— Shell de l'application —");
const srcApp = read("src/components/app/app-shell.tsx");
check("header fixe", srcApp.includes("fixed top-0 left-0 right-0"));
check("calibre 4rem mobile (MessagingView)", srcApp.includes("h-16 md:h-20"));
check("padding contenu pt-16 md:pt-20", srcApp.includes("pt-16 md:pt-20"));
check("barre d'annonces des lives intégrée", srcApp.includes("LiveAnnouncementBar"));
check("barre live masquée sur le chat (hauteur critique)", srcApp.includes("!isChatRoute && <LiveAnnouncementBar />"));
check("tiroir : translation déplier/replier", srcApp.includes("-translate-x-full") && srcApp.includes("translate-x-0"));
check("tiroir : transition douce", srcApp.includes("transition-transform duration-300"));
check("tiroir : backdrop cliquable", srcApp.includes("onClick={() => setOpen(false)}"));
check("tiroir : fermeture Échap", srcApp.includes('"Escape"'));
check("tiroir : fermeture à la navigation", srcApp.includes("setOpen(false);\n  }, [pathname]"));
check("verrou de défilement quand déplié", srcApp.includes('document.body.style.overflow = "hidden"'));
const destinations = [
  ["/app/afrika", "Afrika"],
  ["/app/pasteur-kongo", "Pasteur Kongo"],
  ["/app/temoignages", "Témoignages"],
  ["/app/enseignements", "Enseignements"],
  ["/app/videos", "Vidéos"],
  ["/app/adoration-louanges", "Adoration"],
  ["/app/yeshua-connect", "Yeshua Connect"],
  ["/app/intercession", "Intercession"],
  ["/app/disperses", "Dispersés"],
  ["/app/contribuer", "Contribuer"],
  ["/app/annonces", "Annonces"],
  ["/app/rendez-vous", "rendez-vous"],
];
for (const [href, label] of destinations) {
  check(`menu : destination ${href}`, srcApp.includes(`href: "${href}"`));
}
check("menu : libellé Dispersés d'Israël rendu via IsololeText", srcApp.includes("Dispersés d'Israël") && srcApp.includes("isolole: true"));
check("menu : lien profil + déconnexion", srcApp.includes('href="/profil"') && srcApp.includes("Se déconnecter"));
check("menu : connexion avec callbackUrl=/app", srcApp.includes("/login?callbackUrl=/app"));
check("menu : création de compte", srcApp.includes('href="/register"'));
check("menu : lien site complet", srcApp.includes('href="/"') && srcApp.includes("Voir le site complet"));
check("profil frais via /api/user/profile", srcApp.includes('api.url("/api/user/profile")'));
check("déconnexion → retour page principale app", srcApp.includes('signOut({ callbackUrl: "/app" })'));

/* ════════════════ 5. PAGE PRINCIPALE ════════════════ */
console.log("— Page principale de l'application —");
const srcPageApp = read("src/app/app/page.tsx");
check("charge la config hero « landing » (back-office)", srcPageApp.includes('getHero("landing")'));
check("charge les photos des serviteurs", srcPageApp.includes("photosServiteurs()"));
check("rend AppHomeView", srcPageApp.includes("<AppHomeView"));
check("force-dynamic (maj immédiate back-office)", /force-dynamic/.test(srcPageApp));

const srcHome = read("src/components/app/app-home-view.tsx");
check("hero : fond paramétrable", srcHome.includes("HeroBackgroundImage"));
check("hero : kicker + titre + sous-titre de la config", srcHome.includes("hero.kicker") && srcHome.includes("hero.title") && srcHome.includes("hero.subtitle"));
check("hero : CTA paramétrable", srcHome.includes("hero.ctaLabel") && srcHome.includes("hero.ctaHref"));
check("prochain live affiché (UpcomingLiveFloat)", srcHome.includes("UpcomingLiveFloat"));
check("bannière Yeshua Connect mise en avant", srcHome.includes('href="/app/yeshua-connect"'));
check("2 serviteurs avec photos", srcHome.includes('href="/app/afrika"') && srcHome.includes('href="/app/pasteur-kongo"') && srcHome.includes("d.pamPhoto") && srcHome.includes("d.kongoPhoto"));
const boutons = [
  "/app/temoignages", "/app/enseignements", "/app/videos",
  "/app/adoration-louanges", "/app/intercession", "/app/disperses",
  "/app/contribuer", "/app/annonces",
];
for (const b of boutons) {
  check(`bouton de section ${b}`, srcHome.includes(`href: "${b}"`));
}
check("CTA Rendez-vous (carte dédiée en fin de grille)", srcHome.includes('href="/app/rendez-vous"') && srcHome.includes("Demander un rendez-vous"));
check("libellé « Dispersés d'Israël » rendu via IsololeText", srcHome.includes("Dispersés d'Israël") && srcHome.includes("isolole: true"));
check("ancre #app-sections pour le CTA sans href", srcHome.includes('id="app-sections"'));

/* ════════════════ 6. MANIFEST + MÉTADONNÉES ════════════════ */
console.log("— Manifest & identité de l'application —");
let manifest = null;
try { manifest = JSON.parse(read("public/manifest.webmanifest")); } catch {}
check("manifest.webmanifest : JSON valide", !!manifest);
check("manifest : name « Christ Libère »", manifest?.name === "Christ Libère");
check("manifest : start_url /app", manifest?.start_url === "/app");
check("manifest : id conservé « / » (migrations silencieuses)", manifest?.id === "/");
check("manifest : scope / (tout le site reste dans l'app)", manifest?.scope === "/");
check("manifest : display standalone", manifest?.display === "standalone");
check("manifest : icônes 192 + 512 any/maskable", JSON.stringify(manifest?.icons).includes("manifest-192.png") && JSON.stringify(manifest?.icons).includes("manifest-512.png"));
check("manifest : pas de verrouillage portrait (vidéos en paysage)", manifest?.orientation === undefined);
const srcRoot = read("src/app/layout.tsx");
check("layout racine : applicationName « Christ Libère »", srcRoot.includes('applicationName: "Christ Libère"'));
check("layout racine : appleWebApp « Christ Libère »", srcRoot.includes('title: "Christ Libère"'));
check("layout racine : manifest toujours lié", srcRoot.includes('manifest: "/manifest.webmanifest"'));
const srcInstr = read("src/components/pwa/instructions-installation.tsx");
check("instructions : libellé public « Christ Libère »", srcInstr.includes('public: "Christ Libère"'));

/* ════════════════ 7. RÉSULTAT ════════════════ */
console.log("—".repeat(50));
console.log(`RÉSULTAT : ${ok} ✔ / ${ko} ✘`);
if (ko > 0) {
  console.log("VALIDATION ÉCHOUÉE");
  process.exit(1);
}
console.log("VALIDATION V4.09 RÉUSSIE");
