/**
 * ⭐ V3.82 — Aperçu autonome : compilation du CSS du VRAI dépôt.
 *
 * Exécute le pipeline exact du site (@tailwindcss/postcss sur le
 * globals.css de mouvement-christ-libere — détection automatique de
 * contenu sur tout le dépôt) : le CSS résultat contient donc les classes
 * de la VRAIE page /contribuer, tokens Concept D inclus.
 *
 * Exécution (node, depuis la racine du dépôt) :
 *   node scripts/apercu-css-v382.cjs
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const postcss = require("postcss");
  const tailwind = require("@tailwindcss/postcss");

  const cssEntree = fs.readFileSync("src/app/globals.css", "utf8");

  const resultat = await postcss([tailwind({ optimize: false })]).process(
    cssEntree,
    { from: "src/app/globals.css", to: "styles.css" }
  );

  const sortie = path.resolve("download/apercu-v382/styles.css");
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  fs.writeFileSync(sortie, resultat.css);
  console.log(
    `✓ CSS du site compilé (${(resultat.css.length / 1024).toFixed(1)} Ko) → ${sortie}`
  );

  // Contrôles : les classes clés de la page /contribuer doivent exister.
  const cssFinal = resultat.css;
  const obligatoires = [
    ".card-gold-top",
    "FAF6EF", // section ivoire (arbitrary color)
    "state-success", // badges confirmé (token Concept D)
    "font-serif",
  ];
  const manquantes = obligatoires.filter((c) => !cssFinal.includes(c));
  if (manquantes.length) {
    console.error("✘ Classes absentes du CSS :", manquantes.join(", "));
    process.exit(1);
  }
  console.log("✓ Classes de la page /contribuer présentes dans le CSS compilé");
}

main().catch((e) => {
  console.error("Échec compilation CSS :", e);
  process.exit(1);
});
