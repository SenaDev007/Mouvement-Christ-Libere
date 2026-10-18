/**
 * Test rapide du normalisateur markdown V4.13 (web).
 * Exécution : bun run scripts/test-markdown-normal.ts
 */
import { normaliserMarkdown, texteSansMarkdown } from "../src/lib/markdown-normal";

const cas: Array<[string, string, string]> = [
  // [entrée, normalisé attendu, plain-text attendu]
  ["** ainsi ** le Seigneur", "**ainsi** le Seigneur", "ainsi le Seigneur"],
  ["* italique * simple", "*italique* simple", "italique simple"],
  ["*** très *** important", "***très*** important", "très important"],
  ["__gras souligné__", "**gras souligné**", "gras souligné"],
  ["_italique souligné_", "*italique souligné*", "italique souligné"],
  ["#Titre sans espace", "# Titre sans espace", "Titre sans espace"],
  ["**bien formé** reste", "**bien formé** reste", "bien formé reste"],
  ["*« Afrika, monte ici »*", "*« Afrika, monte ici »*", "« Afrika, monte ici »"],
  ["texte ** gras ** milieu", "texte **gras** milieu", "texte gras milieu"],
  ["##Sous-titre", "## Sous-titre", "Sous-titre"],
];

let echecs = 0;
for (const [entree, attendu, plainAttendu] of cas) {
  const normalise = normaliserMarkdown(entree);
  const plain = texteSansMarkdown(entree);
  const okN = normalise === attendu;
  const okP = plain === plainAttendu;
  if (!okN || !okP) echecs++;
  console.log(
    `${okN && okP ? "✔" : "✘"} « ${entree} »\n   normalisé : ${normalise}${okN ? "" : `  (attendu: ${attendu})`}\n   plain     : ${plain}${okP ? "" : `  (attendu: ${plainAttendu})`}`,
  );
}

// Cas Israël combiné (vérif ordre avec isololeMarkdown simulé)
const israel = normaliserMarkdown("les dispersés d'Israël reviendront");
console.log(
  `${israel.includes("Israël") ? "✔" : "✘"} Israël préservé pour isololeMarkdown : ${israel}`,
);

console.log(echecs === 0 ? "\nTOUS LES TESTS PASSENT" : `\n${echecs} ÉCHEC(S)`);
process.exit(echecs === 0 ? 0 : 1);

// ── Garde : multiplications et astérisques légitimes ──
const garde = "calcul : 3 * 4 * 5 = 60";
const gardeN = normaliserMarkdown(garde);
console.log(`${gardeN === garde ? "✔" : "✘"} garde multiplication : « ${garde} » → « ${gardeN} »`);

const liste = "* premier point\n* second point";
const listeN = normaliserMarkdown(liste);
console.log(`${listeN === liste ? "✔" : "✘"} garde puces de liste : « ${listeN.replace("\n", " ⏎ ")} »`);
