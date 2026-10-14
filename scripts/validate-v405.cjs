#!/usr/bin/env node
/**
 * ⭐ V4.05 — Validation locale : restauration utilisateurs + confirmation
 * renforcée de suppression des comptes.
 *
 * 1) Parse Babel des 2 fichiers modifiés :
 *    - src/components/admin/delete-button.tsx (confirmation renforcée)
 *    - src/app/admin/users/page.tsx (label transmis)
 * 2) Vérifications structurelles :
 *    - DeleteButton : prop label, mode fort entity === "users",
 *      champ « Tapez SUPPRIMER » + bouton désactivé sans le mot exact,
 *      Échap/Entrée gérés, avertissement irréversibilité, retour arrière ;
 *    - page utilisateurs : DeleteButton reçoit label={u.name || u.email},
 *      SUPER_ADMIN toujours protégé de la suppression ;
 *    - les AUTRES entités gardent l'ancien flux Confirmer/Annuler.
 */
const fs = require("fs");
const babel = require("/home/z/my-project/.tmp-babel/node_modules/@babel/parser");

const F_BTN = "/home/z/my-project/mouvement-christ-libere/src/components/admin/delete-button.tsx";
const F_PAGE = "/home/z/my-project/mouvement-christ-libere/src/app/admin/users/page.tsx";

let ok = 0, ko = 0;
const check = (label, cond) => {
  if (cond) { ok++; console.log(`  ✔ ${label}`); }
  else { ko++; console.log(`  ✘ ${label}`); }
};

const srcBtn = fs.readFileSync(F_BTN, "utf8");
const srcPage = fs.readFileSync(F_PAGE, "utf8");

console.log("── 1) Parse Babel ──");
for (const [nom, src] of [["delete-button.tsx", srcBtn], ["admin/users/page.tsx", srcPage]]) {
  try {
    babel.parse(src, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: false });
    check(`${nom} parse (TSX)`, true);
  } catch (e) {
    check(`${nom} parse — ${e.message}`, false);
  }
}

console.log("── 2) DeleteButton : confirmation renforcée ──");
check("prop label déclarée dans l'interface", /label\?:\s*string/.test(srcBtn));
check("mode fort réservé aux comptes utilisateur", srcBtn.includes('entity === "users"'));
check('mot attendu « SUPPRIMER » (comparaison stricte)', srcBtn.includes('=== "SUPPRIMER"'));
check("bouton désactivé sans le mot exact", srcBtn.includes("deleting || !motValide"));
check("champ avec placeholder « Tapez SUPPRIMER »", srcBtn.includes('placeholder="Tapez SUPPRIMER"'));
check("Entrée arme la suppression seulement si mot valide", /e\.key === "Enter" && motValide/.test(srcBtn));
check("Échap annule la confirmation", /e\.key === "Escape"/.test(srcBtn));
check("libellé « Supprimer définitivement »", srcBtn.includes("Supprimer définitivement"));
check("avertissement irréversibilité (messages/historique)", /messages,\s*\n?\s*historique/.test(srcBtn));
check("Annuler vide le champ (retour arrière propre)", /setMotTape\(""\)/.test(srcBtn));
check("aria-label explicite sur le panneau", srcBtn.includes('aria-label="Confirmer la suppression définitive du compte"'));

console.log("── 3) Flux inchangé pour les autres entités ──");
check("flux simple Confirmer/Annuler conservé", srcBtn.includes('"Confirmer"'));
check("DELETE /admin/api/:entity/:id inchangé", srcBtn.includes("`/admin/api/${entity}/${id}`"));
check("redirectTo + router.refresh() conservés", srcBtn.includes("router.refresh()"));

console.log("── 4) Page utilisateurs ──");
check("label passé au bouton (u.name || u.email)", srcPage.includes("label={u.name || u.email}"));
check("entité users", /DeleteButton\s+entity="users"/.test(srcPage.replace(/\s+/g, " ")));
check("SUPER_ADMIN toujours protégé (pas de bouton)", srcPage.includes('u.role !== "SUPER_ADMIN"'));

console.log(`\nRésultat : ${ok}/${ok + ko} vérifications`);
if (ko > 0) process.exit(1);
