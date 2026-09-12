#!/usr/bin/env node
/**
 * ⭐ V3.73 — Validation locale (avant push).
 *
 * Trois retours pasteur :
 *  ① Navbar : bouton engrenage SUPPRIMÉ hors du menu profil — l'entrée
 *     « Mon profil & paramètres » (icône engrenage) vit DANS le menu
 *     déroulant qui s'ouvre au clic sur l'avatar.
 *  ② /rendez-vous : champ « Pays » libre → LE sélecteur pays habituel
 *     (recherche + drapeaux + suggestions + clic-extérieur + auto-résolution).
 *  ③ /rendez-vous (+ /rendez-vous/suivi) : bande logo sous la bande
 *     d'annonce SUPPRIMÉE — seul le bouton « Retour au site » reste.
 *
 * Usage : node scripts/valider-v373.cjs
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

console.log("── V3.73 · ① Navbar : engrenage DANS le menu profil ──────");
const nav = fs.readFileSync(
  path.join(racine, "src/components/ui/navigation-menu-4.tsx"),
  "utf8"
);

verifie(
  "plus AUCUN bouton engrenage externe : le Link /profil à côté de l'avatar est supprimé",
  !/aria-label="Paramètres de mon compte"[\s\S]{0,300}?<Settings/.test(nav)
);
verifie(
  "l'entrée du menu profil porte l'icône engrenage (Settings)",
  /<Settings className="w-4 h-4 text-\[#C9A227\] flex-shrink-0" \/>/.test(nav)
);
verifie(
  "l'entrée menu explique le contenu (Photo, nom, téléphone, pays…)",
  /Photo, nom, téléphone, pays…/.test(nav)
);
verifie(
  "l'entrée menu mène toujours à /profil (page d'édition photo)",
  /href="\/profil"[\s\S]{0,400}?<Settings/.test(nav)
);
verifie(
  "l'entrée menu ferme le menu au clic (setUserMenuOpen(false))",
  /href="\/profil"[\s\S]{0,200}?onClick=\{\(\) => setUserMenuOpen\(false\)\}/.test(
    nav
  )
);
verifie(
  "import UserIcon retiré (plus utilisé)",
  !/User as UserIcon/.test(nav)
);
verifie(
  "l'avatar cliquable ouvre toujours le menu (aria-haspopup)",
  /aria-haspopup="menu"[\s\S]{0,200}?aria-expanded=\{userMenuOpen\}/.test(nav)
);

console.log("── V3.73 · ② /rendez-vous : sélecteur pays habituel ──────");
const rdv = fs.readFileSync(
  path.join(racine, "src/app/rendez-vous/rendez-vous-view.tsx"),
  "utf8"
);

verifie(
  "COUNTRIES + flagFromCountryCode importés (données du sélecteur)",
  /import \{ COUNTRIES \} from "@\/lib\/data\/countries";/.test(rdv) &&
    /import \{ flagFromCountryCode \} from "@\/lib\/data\/flags";/.test(rdv)
);
verifie(
  "états du sélecteur : paysRecherche + listePaysOuverte",
  /const \[paysRecherche, setPaysRecherche\] = useState\(""\)/.test(rdv) &&
    /const \[listePaysOuverte, setListePaysOuverte\] = useState\(false\)/.test(rdv)
);
verifie(
  "suggestions filtrées par nom OU code, plafonnées à 8 (comme /register)",
  /c\.name\.toLowerCase\(\)\.includes\(paysRecherche\.toLowerCase\(\)\)[\s\S]{0,120}c\.code\.toLowerCase\(\)\.includes\(paysRecherche\.toLowerCase\(\)\)[\s\S]{0,60}\.slice\(0, 8\)/.test(
    rdv
  )
);
verifie(
  "chercher efface la sélection et ouvre la liste",
  /setPaysRecherche\(e\.target\.value\);[\s\S]{0,120}setForm\(\{ \.\.\.form, country: "" \}\);[\s\S]{0,120}setListePaysOuverte\(true\)/.test(
    rdv
  )
);
verifie(
  "cliquer une suggestion enregistre le NOM du pays",
  /setForm\(\{ \.\.\.form, country: c\.name \}\)/.test(rdv)
);
verifie(
  "suggestion affichée : drapeau + nom + code",
  /\{flagFromCountryCode\(c\.code\)\} \{c\.name\}[\s\S]{0,120}\{c\.code\}/.test(
    rdv
  )
);
verifie(
  "valeur saisie : drapeau + nom du pays sélectionné",
  /flagFromCountryCode\(paysSelectionne\?\.code \|\| ""\)\} \$\{form\.country\}/.test(
    rdv
  )
);
verifie(
  "clic extérieur ferme la liste (overlay fixed, comme le modal serviteur)",
  /className="fixed inset-0 z-20"[\s\S]{0,200}?onClick=\{\(\) => setListePaysOuverte\(false\)\}/.test(
    rdv
  )
);
verifie(
  "message « Aucun pays trouvé » (même aide que /register V3.24)",
  /Aucun pays trouvé — vérifiez/.test(rdv)
);
verifie(
  "auto-résolution au submit (match exact sinon préfixe unique)",
  /let paysFinal = form\.country;[\s\S]{0,700}prefixes\.length === 1 \? prefixes\[0\] : undefined/.test(
    rdv
  )
);
verifie(
  "l'API reçoit le pays résolu (country: paysFinal)",
  /JSON\.stringify\(\{ \.\.\.form, country: paysFinal \}\)/.test(rdv)
);
verifie(
  "réinitialisation du sélecteur sur « Déposer une autre demande »",
  /setPaysRecherche\(""\);[\s\S]{0,120}setListePaysOuverte\(false\);/.test(rdv)
);
verifie(
  "l'ancien champ libre (placeholder « Ex. Bénin ») est SUPPRIMÉ",
  !/placeholder="Ex\. Bénin"/.test(rdv)
);
verifie(
  "API inchangée côté serveur : country reste une chaîne optionnelle ≤ 60",
  /country\?\.trim\(\)\?\.substring\(0, 60\) \|\| null/.test(
    fs.readFileSync(
      path.join(racine, "src/app/api/rendez-vous/route.ts"),
      "utf8"
    )
  )
);

console.log("── V3.73 · ③ Bande logo supprimée, bouton retour simple ──");
verifie(
  "/rendez-vous : plus AUCUN <header> ni logo-christ-libere-v2.png",
  !/<header/.test(rdv) && !/logo-christ-libere-v2\.png/.test(rdv)
);
verifie(
  "/rendez-vous : bouton « Retour au site » seul, en pilule discrète",
  /Retour au site[\s\S]{0,400}?/m.test(rdv) &&
    /rounded-full border border-\[#8A857C\]\/25 bg-white\/70/.test(rdv)
);
verifie(
  "/rendez-vous : le bouton retour précède TOUS les états (succès et formulaire)",
  rdv.indexOf("Retour au site") < rdv.indexOf("{succes ? (")
);
verifie(
  "/rendez-vous : Image encore utilisé pour les photos des serviteurs",
  /s\.code === "pam" \? "\/pam\.jpeg" : "\/pasteur-kongo\.jpeg"/.test(rdv)
);

const suivi = fs.readFileSync(
  path.join(racine, "src/app/rendez-vous/suivi/suivi-view.tsx"),
  "utf8"
);
verifie(
  "/rendez-vous/suivi : bande logo supprimée aussi (cohérence du flux)",
  !/<header/.test(suivi) && !/logo-christ-libere-v2\.png/.test(suivi)
);
verifie(
  "/rendez-vous/suivi : bouton « Nouvelle demande » conservé en pilule",
  /Nouvelle demande/.test(suivi) &&
    /rounded-full border border-\[#8A857C\]\/25 bg-white\/70/.test(suivi)
);
verifie(
  "/rendez-vous/suivi : import Image retiré (plus utilisé)",
  !/import Image from "next\/image"/.test(suivi)
);

console.log("── V3.73 · Non-régression ────────────────────────────────");
verifie(
  "navbar : menu burger, liens, logo navbar et CTA auth intacts",
  /logo-christ-libere-v2\.png/.test(nav) &&
    /aria-label="Ouvrir le menu de navigation"/.test(nav) &&
    /href="\/register"/.test(nav)
);
verifie(
  "/rendez-vous : honeypot + serviteurs + urgence + message intacts",
  /aria-hidden="true"/.test(rdv) &&
    /SERVITEURS_RENDEZ_VOUS/.test(rdv) &&
    /DEMANDE_URGENCES/.test(rdv)
);
verifie(
  "/rendez-vous : POST /api/rendez-vous intact (fetch inchangé)",
  /fetch\("\/api\/rendez-vous", \{/.test(rdv)
);
verifie(
  "layout : navbar + bande d'annonce rendus par LayoutShell sur /rendez-vous",
  !/HIDDEN_ROUTES[\s\S]{0,200}"\/rendez-vous"/.test(
    fs.readFileSync(
      path.join(racine, "src/components/site/layout-shell.tsx"),
      "utf8"
    )
  )
);

console.log(
  `\n${process.exitCode ? "✗ ÉCHEC" : "✔ SUCCÈS"} — ${ok} vérification(s) validée(s)`
);
process.exit(process.exitCode || 0);
