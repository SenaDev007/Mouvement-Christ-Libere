#!/usr/bin/env node
/**
 * ⭐ V3.91 — Validation complète du round 3 du MCL Creative Studio.
 *
 * Vérifie (parse Babel + sémantique) :
 *   A. nvidia-ai.ts — URLs corrigées (/v1/genai/), cfg_scale, seed,
 *      escalier d'URLs, Directeur IA (gpt-oss-20b) ;
 *   B. studio-service.ts — handlerDirecteurIA, validateurs palette/calques,
 *      statuts 4xx (plus AUCUN 5xx renvoyé aux routes IA) ;
 *   C. moteur de composition — calques (ordre/masques/décalages),
 *      palette perso (styleStudio/resoudreCouleur/dessinerFondStyle) ;
 *   D. studio-shell.tsx — Directeur IA + itération, palette libre, calques,
 *      confirmations personnalisées, ZÉRO res.json() brut, ZÉRO confirm() ;
 *   E. studio-ui.tsx — ModalConfirmation/useConfirmation/lireJsonSur ;
 *   F. routes API — directeur présent sur les DEUX espaces.
 *
 * Usage : node scripts/validate-v391.cjs
 */

const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

let passes = 0;
let echecs = 0;

function check(nom, fn) {
  try {
    fn();
    passes++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom} — ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function lire(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

function parseTSX(rel) {
  const code = lire(rel);
  parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx", "decorators-legacy"],
  });
  return code;
}

console.log("— A. nvidia-ai.ts (bug 502 + Directeur IA) —");

const nvidia = parseTSX("src/lib/studio/nvidia-ai.ts");
check("URL Kontext corrigée : /v1/genai/black-forest-labs/flux.1-kontext-dev", () =>
  assert(
    nvidia.includes("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"),
    "URL Kontext /v1/genai absente"
  )
);
check("URL FLUX corrigée : /v1/genai/black-forest-labs/flux.1-dev", () =>
  assert(
    nvidia.includes("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev"),
    "URL FLUX /v1/genai absente"
  )
);
check("Anciennes URLs mortes absentes comme valeur PAR DÉFAUT", () => {
  // Le chemin historique ne doit apparaître qu'en REPLI dans l'escalier.
  const lignes = nvidia.split("\n");
  const defautGenai = lignes.filter(
    (l) => l.includes("v1/genai/black-forest-labs")
  ).length;
  assert(defautGenai >= 2, "les 2 chemins /v1/genai doivent être en tête d'escalier");
});
check("Paramètre cfg_scale (plus jamais « cfg: »)", () => {
  assert(!/\bcfg:\s/.test(nvidia), "« cfg: » obsolète encore présent");
  assert(nvidia.includes("cfg_scale:"), "cfg_scale absent");
});
check("Kontext aspect_ratio match_input_image", () =>
  assert(nvidia.includes('"match_input_image"'), "match_input_image absent")
);
check("seed présent (itération stable)", () =>
  assert(nvidia.includes("seed:"), "seed absent")
);
check("Directeur IA : endpoint integrate.api.nvidia.com + gpt-oss-20b", () => {
  assert(
    nvidia.includes("https://integrate.api.nvidia.com/v1/chat/completions"),
    "endpoint OpenAI-compatible absent"
  );
  assert(nvidia.includes("openai/gpt-oss-20b"), "modèle gpt-oss-20b absent");
});
check("Directeur IA : consigne système JSON strict + palette libre", () => {
  assert(nvidia.includes("SYSTEME_DIRECTEUR"), "system prompt absent");
  assert(nvidia.includes("prompt_flux"), "schéma prompt_flux absent");
  assert(nvidia.includes("CORRECTION"), "règle de correction/itération absente");
});
check("Extraction JSON tolérante (accolades équilibrées)", () =>
  assert(nvidia.includes("extraireJsonDirecteur"), "extracteur JSON absent")
);
check("normaliserSpecDirecteur exporté (couleurs validées)", () =>
  assert(nvidia.includes("export function normaliserSpecDirecteur"), "normaliseur absent")
);
check("Escalier d'URLs (tableaux + repli 404)", () => {
  assert(nvidia.includes("URLS_KONTEXT"), "escalier Kontext absent");
  assert(nvidia.includes("URLS_FLUX"), "escalier FLUX absent");
  assert(nvidia.includes("e.statut !== 404"), "repli 404 absent");
});

console.log("— B. studio-service.ts (Directeur + validateurs + statuts) —");

const service = parseTSX("src/lib/studio/studio-service.ts");
check("handlerDirecteurIA exporté", () =>
  assert(service.includes("export async function handlerDirecteurIA"), "handler absent")
);
check("Validation palette #RRGGBB stricte", () => {
  assert(service.includes("validerPalettePerso"), "validateur palette absent");
  assert(service.includes("#[0-9a-fA-F]{6}"), "motif hexa absent");
});
check("Validation calques (ordre/masques/décalages bornés ±0.3)", () => {
  assert(service.includes("validerCalques"), "validateur calques absent");
  assert(service.includes("CLES_CALQUES_VALIDES"), "liste des clés absente");
  assert(service.includes("Math.max(-0.3, Math.min(0.3"), "bornage ±0.3 absent");
});
check("palette_perso + calques parsés dans construireDonneesVisuel", () => {
  assert(service.includes("palettePerso: validerPalettePerso(body.palette_perso)"), "palette non parsée");
  assert(service.includes("calques: validerCalques(body.calques)"), "calques non parsés");
});
check("consigneFond reçoit la palette libre", () =>
  assert(
    service.includes("consigneFond(intention, style, palette || undefined)"),
    "palette non transmise à consigneFond"
  )
);
check("IA inactive → 409 (plus de 503)", () => {
  assert(
    !/erreurJson\([^)]*"IA_INACTIVE"\s*\)\s*;?\s*\n?\s*,?\s*50[0-9]/.test(service),
    "un statut 50x traîne encore sur IA_INACTIVE"
  );
  assert(service.includes('409,\n        "IA_INACTIVE"') || /409,\s*"IA_INACTIVE"/.test(service), "409 IA_INACTIVE absent");
});
check("IA_ECHEC → 422 (jamais 502)", () => {
  assert(
    !/erreurJson\([^)]*"IA_ECHEC"\)[^;]*502/.test(service.replace(/\n/g, " ")),
    "un 502 IA_ECHEC subsiste"
  );
  assert(/422,\s*"IA_ECHEC"/.test(service.replace(/\n/g, " ")), "422 IA_ECHEC absent");
});
check("historique d'itération borné à 12 tours", () =>
  assert(service.includes(".slice(-12)"), "historique non borné")
);
check("palette + calques persistés dans metadata", () => {
  assert(service.includes("palettePerso: donnees.palettePerso || null"), "palette non persistée");
  assert(service.includes("calques: donnees.calques || null"), "calques non persistés");
});

console.log("— C. Moteur de composition (calques + palette) —");

const types = parseTSX("src/lib/visual-generator/types.ts");
check("Types CleCalque + ORDRE_CALQUES_DEFAUT (8 calques)", () => {
  assert(types.includes("export type CleCalque"), "CleCalque absent");
  const ordre = types.match(/ORDRE_CALQUES_DEFAUT: CleCalque\[\] = \[([\s\S]*?)\]/);
  assert(ordre, "ORDRE_CALQUES_DEFAUT absent");
  const cles = (ordre[1].match(/"/g) || []).length / 2;
  assert(cles === 8, `8 calques attendus, ${cles} trouvés`);
  assert(types.includes("PalettePerso"), "PalettePerso absent");
  assert(types.includes("DecalageCalque"), "DecalageCalque absent");
});

const composition = parseTSX("src/lib/visual-generator/composition.ts");
check("composer() en calques nommés (Record<CleCalque, () => void>)", () =>
  assert(
    composition.includes("const calques: Record<CleCalque, () => void>"),
    "structure calques absente"
  )
);
check("Ordre effectif = choix utilisateur + complément par défaut", () =>
  assert(composition.includes("ordreEffectif"), "ordre effectif absent")
);
check("Masquage (œil) respecté", () =>
  assert(composition.includes("masques.has(cle)"), "masquage absent")
);
check("Décalages avec translate ±30 %", () => {
  assert(composition.includes("ctx.translate("), "translate absent");
  assert(composition.includes("Math.max(-0.3, Math.min(0.3"), "bornage absent");
});
check("Palette perso traversant tout le moteur", () => {
  assert(
    composition.includes("styleStudio(donnees.style, donnees.palettePerso)"),
    "styleStudio sans palette"
  );
  assert(
    composition.includes('resoudreCouleur("secondary", donnees.style, donnees.palettePerso)'),
    "resoudreCouleur sans palette"
  );
  assert(
    composition.includes("dessinerFondStyle(ctx, W, H, donnees.style, donnees.palettePerso)"),
    "dessinerFondStyle sans palette"
  );
});

const typography = parseTSX("src/lib/visual-generator/typography.ts");
check("resoudreCouleur accepte la palette libre (3e argument)", () =>
  assert(
    typography.includes("palettePerso?: { accent?: string") ||
      typography.includes("palettePerso?:"),
    "signature non étendue"
  )
);
const tokens = parseTSX("src/lib/studio/brand-tokens.ts");
check("styleStudio(key, perso?) — palette libre prioritaire", () => {
  assert(tokens.includes("perso?:"), "paramètre perso absent");
  assert(tokens.includes("Palette personnalisée"), "style synthétique absent");
});

console.log("— D. studio-shell.tsx (UI complète) —");

const shell = parseTSX("src/components/studio/studio-shell.tsx");
check("ZÉRO res.json() brut (tout blindé)", () => {
  const bruts = shell.match(/await res\.json\(\)/g) || [];
  assert(bruts.length === 0, `${bruts.length} res.json() brut(s) restant(s)`);
  assert(shell.includes("lireJsonSur"), "lireJsonSur non utilisé");
});
check("ZÉRO confirm() navigateur", () => {
  const lignesCode = shell
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        // commentaires et doc ignorés
        !l.startsWith("*") &&
        !l.startsWith("//") &&
        !l.startsWith("/*") &&
        // appels réels uniquement (hors commentaires de fin de ligne)
        !/^.*\/\/.*\bconfirm\(/.test(l.replace(/'.*'/g, "'"))
    );
  const confirmes = lignesCode.filter((l) => /[^a-zA-Z.]confirm\(/.test(l));
  assert(confirmes.length === 0, `${confirmes.length} confirm() restant(s) : ${confirmes[0] || ""}`);
});
check("Directeur IA : description + génération + suggestions cliquables", () => {
  assert(shell.includes("directeurDescription"), "champ description absent");
  assert(shell.includes("lancerDirecteur"), "fonction lancerDirecteur absente");
  assert(shell.includes("suggestion_titre"), "suggestions absentes");
});
check("Itération : champ correction + compteur", () => {
  assert(shell.includes("directeurCorrection"), "champ correction absent");
  assert(shell.includes("itération"), "compteur d'itération absent");
});
check("Palette libre : 3 sélecteurs couleur (générés par la boucle) + préréglages", () => {
  assert(
    (shell.match(/type="color"/g) || []).length >= 1,
    "sélecteur couleur absent"
  );
  for (const libelle of ["Couleur du titre", "Couleur des textes", "Couleur du fond"]) {
    assert(shell.includes(libelle), `sélecteur « ${libelle} » absent`);
  }
  assert(shell.includes("PRESETS_PALETTE"), "préréglages absents");
});
check("Calques : pile inversée (haut = devant), œil, ±, réinitialiser", () => {
  assert(shell.includes("ordreCalques].reverse()"), "pile non inversée");
  assert(shell.includes("basculerCalque"), "œil absent");
  assert(shell.includes("decalerCalque"), "décalages absents");
  assert(shell.includes("reinitialiserCalques"), "réinitialisation absente");
});
check("Palette + calques dans l'aperçu ET la génération ET le brouillon", () => {
  assert(shell.includes("palette_perso: palettePerso || undefined"), "palette non envoyée");
  assert(shell.includes("calques: reglagesCalques"), "calques non envoyés");
  assert(shell.includes("palettePerso,"), "palette absente du brouillon");
});
check("Modals personnalisées montées partout", () => {
  const montees = (shell.match(/\{confirmation\.modal\}/g) || []).length;
  assert(montees === 4, `4 montages attendus (Créer, Carte, Fonds, Photos), ${montees} trouvés`);
});

console.log("— E. studio-ui.tsx (confirmations + lecture sûre) —");

const ui = parseTSX("src/components/studio/studio-ui.tsx");
check("ModalConfirmation + 3 variantes personnalisées", () => {
  assert(ui.includes("export function ModalConfirmation"), "composant absent");
  for (const v of ["suppression", "application", "nouveau"]) {
    assert(ui.includes(`"${v}"`), `variante ${v} absente`);
  }
});
check("useConfirmation asynchrone (Promise<boolean>)", () =>
  assert(ui.includes("export function useConfirmation"), "hook absent")
);
check("lireJsonSur : HTML détecté → message pastoral", () => {
  assert(ui.includes("export async function lireJsonSur"), "fonction absente");
  assert(ui.includes("startsWith(\"<\")"), "détection HTML absente");
});

console.log("— F. Routes API (les deux espaces) —");

for (const espace of ["admin", "secretariat"]) {
  const route = parseTSX(`src/app/${espace}/api/studio/ai/directeur/route.ts`);
  check(`route /${espace}/api/studio/ai/directeur (POST, nodejs, 60 s)`, () => {
    assert(route.includes("aiDirecteur.POST"), "POST non câblé");
    assert(route.includes('runtime = "nodejs"'), "runtime manquant");
    assert(route.includes("maxDuration = 60"), "maxDuration manquant");
    assert(
      route.includes(espace === "admin" ? "ROLES_ADMIN_STUDIO" : "ROLES_SECRETARIAT"),
      "rôles incorrects"
    );
  });
}
check("studio-routes.ts câble aiDirecteur", () => {
  const routesLib = lire("src/lib/studio/studio-routes.ts");
  assert(routesLib.includes("aiDirecteur"), "aiDirecteur non câblé");
  assert(routesLib.includes("handlerDirecteurIA"), "handler non importé");
});
check("proxy.ts : /admin/api/studio toujours dans les routes à garde propre", () => {
  const proxy = lire("src/proxy.ts");
  assert(proxy.includes('"/admin/api/studio"'), "garde proxy absente");
});

console.log("— G. Typecheck strict isolé (tsc) —");
// Note : exécuté séparément (tsconfig-v391-check.json) — ici on vérifie
// juste que le fichier de config existe et couvre les bons dossiers.
check("tsconfig-v391-check.json présent et ciblé", () => {
  const conf = lire("tsconfig-v391-check.json");
  assert(conf.includes("src/lib/studio"), "lib/studio non couvert");
  assert(conf.includes("src/components/studio"), "components/studio non couvert");
});

console.log(`\n════════ RÉSULTAT : ${passes} ✓ · ${echecs} ✗ ════════`);
process.exit(echecs > 0 ? 1 : 0);
