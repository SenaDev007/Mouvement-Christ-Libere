#!/usr/bin/env node
/**
 * ⭐ V4.08 — Validation locale : inscription allégée.
 *
 * 1) Parse Babel des 2 fichiers modifiés :
 *    - src/app/register/page.tsx (formulaire allégé)
 *    - src/app/api/auth/register/route.ts (CRUD à jour)
 * 2) Vérifications structurelles :
 *    - page : PLUS de constantes NIVEAUX/CANAUX, plus de champs
 *      niveau/canal/message dans l'état ni dans le JSX, plus des labels
 *      « Niveau spirituel » / « Canal de communauté » / « Message (optionnel) » ;
 *    - page : les champs conservés (Nom, Email, Mot de passe, Pseudonyme,
 *      Pays, Ville, Langue) et le bouton « Créer mon compte » intacts ;
 *    - page : textes à jour (adhésion immédiate à la communauté) ;
 *    - API : plus de lecture raw.niveau / raw.message, DisperseMember.create
 *      sans niveau/message (défauts du schéma), rôle MEMBER + isVerified true
 *      (membre classé automatiquement), abonnement automatique aux canaux
 *      publics TOUJOURS présent, validation email/mot de passe/pays intacte.
 */
const fs = require("fs");
const babel = require("/home/z/my-project/.tmp-babel/node_modules/@babel/parser");

const F_PAGE = "/home/z/my-project/mouvement-christ-libere/src/app/register/page.tsx";
const F_API = "/home/z/my-project/mouvement-christ-libere/src/app/api/auth/register/route.ts";

let ok = 0, ko = 0;
const check = (label, cond) => {
  if (cond) { ok++; console.log(`  ✔ ${label}`); }
  else { ko++; console.log(`  ✘ ${label}`); }
};

const srcPage = fs.readFileSync(F_PAGE, "utf8");
const srcApi = fs.readFileSync(F_API, "utf8");

console.log("— Parse Babel —");
for (const [nom, code] of [["register/page.tsx", srcPage], ["api/auth/register/route.ts", srcApi]]) {
  let parsed = true;
  try {
    babel.parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] });
  } catch (e) {
    parsed = false;
    console.log(`    Erreur : ${e.message}`);
  }
  check(`${nom} se parse`, parsed);
}

console.log("— Page /register : champs supprimés —");
check("constante NIVEAUX absente", !/\bNIVEAUX\b/.test(srcPage));
check("constante CANAUX absente", !/\bCANAUX\b/.test(srcPage));
check("état : plus de « niveau »", !/niveau:\s*"/.test(srcPage));
check("état : plus de « canal »", !/canal:\s*"/.test(srcPage));
check("état : plus de « message »", !/message:\s*""/.test(srcPage));
check("JSX : plus de form.niveau", !/form\.niveau/.test(srcPage));
check("JSX : plus de form.canal", !/form\.canal/.test(srcPage));
check("JSX : plus de form.message", !/form\.message/.test(srcPage));
check("label « Niveau spirituel » absent", !srcPage.includes("Niveau spirituel"));
check("label « Canal de communauté » absent", !srcPage.includes("Canal de communauté"));
check("label « Message (optionnel) » absent", !srcPage.includes("Message (optionnel)"));
check("label « Choix du canal » absent", !srcPage.includes("Choix du canal"));

console.log("— Page /register : champs conservés —");
check("champ Nom complet", srcPage.includes("Nom complet"));
check("champ Email", srcPage.includes("EMAIL *") || srcPage.includes("Email *"));
check("champ Mot de passe", srcPage.includes("Mot de passe"));
check("champ Pseudonyme", srcPage.includes("Pseudonyme"));
check("champ Pays (recherche)", srcPage.includes("Rechercher un pays"));
check("champ Ville", srcPage.includes("Ville"));
check("sélecteur Langue", /Langue/.test(srcPage) && srcPage.includes("LANGUES"));
check("constante LANGUES conservée", /const LANGUES = \[/.test(srcPage));
check("bouton « Créer mon compte »", srcPage.includes("Créer mon compte"));
check("appel /api/auth/register conservé", srcPage.includes('"/api/auth/register"'));
check("texte adhésion immédiate (en-tête)", srcPage.includes("vous rejoignez immédiatement la communauté"));
check("texte adhésion immédiate (pied)", srcPage.includes("rejoignez immédiatement la communauté et apparaissez sur la carte"));

console.log("— API /api/auth/register : CRUD à jour —");
check("plus de NIVEAUX_VALIDES", !srcApi.includes("NIVEAUX_VALIDES"));
check("plus de lecture raw.niveau", !srcApi.includes("raw.niveau"));
check("plus de lecture raw.message", !srcApi.includes("raw.message"));
check("create DisperseMember sans niveau explicite", !/niveau:\s*\n?\s*typeof raw/.test(srcApi));
check("rôle MEMBER automatique", /role:\s*"MEMBER"/.test(srcApi));
check("isVerified true (auto-validation)", /isVerified:\s*true/.test(srcApi));
check("abonnement automatique canaux publics", srcApi.includes("publicChannels"));
check("abonnement : filtre canaux non restreints", /isRestricted:\s*false/.test(srcApi));
check("annonce « Baruch haba » conservée", srcApi.includes("Baruch haba"));
check("placement carte des dispersés conservé", srcApi.includes("disperseMember.create"));
check("pseudonyme carte toujours lu", srcApi.includes("raw.pseudonyme"));
check("langue carte toujours lue", srcApi.includes("raw.langue"));

console.log(`\nRésultat : ${ok}/${ok + ko} ${ko === 0 ? "✔ TOUT PASSE" : "✘ ÉCHECS"}`);
process.exit(ko === 0 ? 0 : 1);
