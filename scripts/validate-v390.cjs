#!/usr/bin/env node
/**
 * ⭐ V3.90 — Validation statique du MCL Creative Studio (round 2).
 *
 * Vérifie par analyse syntaxique (Babel) + contenu :
 *   1. MOTEUR multi-intervenants (types + renderer + composition) ;
 *   2. SERVICE : noms libres, photos multiples, IA (peaufiner + fond) ;
 *   3. CLIENT NVIDIA (nvidia-ai.ts) : endpoints, clé, tolérance ;
 *   4. ROUTES IA câblées sur les DEUX espaces (admin + secrétariat) ;
 *   5. UI : brouillon auto-sauvegardé + bouton Sauvegarder + restauration ;
 *      intervenants éditables illimités ; modal de rognage ; boutons IA.
 *
 * Usage : node scripts/validate-v390.cjs
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
let ok = 0;
let echecs = 0;

function verif(nom, condition, detail = "") {
  if (condition) {
    ok++;
    console.log(`  ✔ ${nom}`);
  } else {
    echecs++;
    console.error(`  ✘ ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

function lire(rel) {
  return fs.readFileSync(path.join(RACINE, rel), "utf8");
}

// ── 0. Transpilation (syntaxe) de tous les fichiers touchés ──────────

console.log("\n① Syntaxe (transpilation bun)");
const FICHIERS = [
  "src/lib/visual-generator/types.ts",
  "src/lib/visual-generator/renderer.ts",
  "src/lib/visual-generator/composition.ts",
  "src/lib/studio/nvidia-ai.ts",
  "src/lib/studio/studio-service.ts",
  "src/lib/studio/studio-routes.ts",
  "src/app/admin/api/studio/ai/peaufiner/route.ts",
  "src/app/admin/api/studio/ai/fond/route.ts",
  "src/app/secretariat/api/studio/ai/peaufiner/route.ts",
  "src/app/secretariat/api/studio/ai/fond/route.ts",
  "src/components/studio/studio-ui.tsx",
  "src/components/studio/studio-shell.tsx",
];
const dossierSortie = "/tmp/validate-v390-build";
fs.rmSync(dossierSortie, { recursive: true, force: true });
fs.mkdirSync(dossierSortie, { recursive: true });
for (const f of FICHIERS) {
  try {
    execSync(`bun build --target=bun "${f}" --outdir="${dossierSortie}"`, {
      cwd: RACINE,
      stdio: "pipe",
    });
    ok++;
    console.log(`  ✔ syntaxe OK — ${f}`);
  } catch (e) {
    echecs++;
    console.error(`  ✘ syntaxe — ${f} : ${String(e.stderr || e.message).split("\n")[0]}`);
  }
}

// ── 1. Moteur : multi-intervenants ────────────────────────────────────

console.log("\n② Moteur de composition — multi-intervenants");
const types = lire("src/lib/visual-generator/types.ts");
verif("types.ts — speakerNames (noms libres)", /speakerNames\?: string\[\]/.test(types));
verif("types.ts — photosSujet (une photo par intervenant)", /photosSujet\?: Array<\{ url: string; decoupee\?/.test(types));
verif("types.ts — intervenant historique conservé (mode rapide)", /intervenant\?: "kongo" \| "pam" \| "kongo-pam" \| "aucun"/.test(types));

const renderer = lire("src/lib/visual-generator/renderer.ts");
verif("renderer.ts — chargement parallèle des photos multiples", /urlsDesSujets\.map\(\(u\) => chargerImage\(u\)\)/.test(renderer));
verif("renderer.ts — sujets transmis à composer", /\{ fond, sujets, logo \}/.test(renderer));
verif("renderer.ts — plafond 4 photos", /\.slice\(0, 4\)/.test(renderer));

const composition = lire("src/lib/visual-generator/composition.ts");
verif("composition.ts — dessinerGroupeSujets défini", /function dessinerGroupeSujets\(/.test(composition));
verif("composition.ts — colonnes chevauchantes (14 %)", /colonne \* 1\.14/.test(composition));
verif("composition.ts — mode selon le détourage PAR photo", /decoupeeDe\(i\) \? "contain" : "cover"/.test(composition));
verif("composition.ts — une photo = comportement historique", /images\.length === 1/.test(composition));
verif("composition.ts — noms libres prioritaires au sous-titre", /speakerNames\?\.length/.test(composition));
verif("composition.ts — join(\" & \") des noms", /noms\.join\(" & "\)/.test(composition));

// ── 2. Service : noms libres + photos multiples ────────────────────────

console.log("\n③ Service studio — noms libres & photos multiples");
const service = lire("src/lib/studio/studio-service.ts");
verif("upload photo — validation nom LIBRE (1-80)", /nomIntervenant\.length > 80/.test(service));
verif("upload photo — plus de Set figé Pasteur Kongo/Pam", !/intervenantsValides/.test(service));
verif("construireDonneesVisuel — speaker_names acceptées", /Array\.isArray\(body\.speaker_names\)/.test(service));
verif("construireDonneesVisuel — photos_sujet (aperçu, urls résolues)", /Array\.isArray\(body\.photos_sujet\)/.test(service));
verif("photosEffectives — ids multiples (speaker_photo_ids)", /body\.speaker_photo_ids/.test(service));
verif("photosEffectives — plafond 4 ids", /\.slice\(0, 4\)/.test(service));
verif("génération — photosSujet remplies", /donnees\.photosSujet = photos\.map/.test(service));
verif("génération — speakerName = noms joinés", /donnees\.speakerNames\.join\(" & "\)/.test(service));

// ── 3. Client NVIDIA ──────────────────────────────────────────────────

console.log("\n④ Client NVIDIA NIM (build.nvidia.com)");
const nvidia = lire("src/lib/studio/nvidia-ai.ts");
verif("clé lue depuis NVIDIA_API_KEY (jamais exposée)", /process\.env\.NVIDIA_API_KEY/.test(nvidia));
verif("estIAActive — exposition de l'état uniquement", /export function estIAActive/.test(nvidia));
verif("endpoint FLUX.1 Kontext [dev] (peaufinage)", /flux\.1-kontext-dev/.test(nvidia));
verif("endpoint FLUX.1 [dev] (fonds)", /flux\.1-dev/.test(nvidia));
verif("consigne peaufinage — identité conservée", /Keep the SAME person/.test(nvidia));
verif("consigne fond — ni texte ni personnes", /no people, no faces, no text/.test(nvidia));
verif("analyse TOLÉRANTE des réponses ({ image }, artifacts, data…)", /extraireImage/.test(nvidia));
verif("repli minimal si 400/422", /e\.statut === 400 \|\| e\.statut === 422/.test(nvidia));
verif("endpoints surchargeables (env)", /NVIDIA_KONTEXT_URL/.test(nvidia));

// ── 4. Service IA + routes ─────────────────────────────────────────────

console.log("\n⑤ Handlers IA & câblage des routes");
verif("handlerPeaufinerPhotoIA — détourage du résultat IA", /detourerPhoto\(travaille\)/.test(service));
verif("peaufiner — photo originale préservée (nouvel enregistrement)", /const item = await db\.speakerPhoto\.create/.test(service));
verif("handlerGenererFondIA — 1920×1080 JPEG Q90", /resize\(1920, 1080/.test(service));
verif("meta — état IA exposé (sans la clé)", /ia: \{ active: estIAActive\(\) \}/.test(service));

const routes = lire("src/lib/studio/studio-routes.ts");
verif("routesStudio — aiPeaufiner câblé", /aiPeaufiner/.test(routes));
verif("routesStudio — aiFond câblé", /aiFond/.test(routes));
for (const espace of ["admin", "secretariat"]) {
  for (const action of ["peaufiner", "fond"]) {
    const fichier = `src/app/${espace}/api/studio/ai/${action}/route.ts`;
    const existe = fs.existsSync(path.join(RACINE, fichier));
    verif(`route ${fichier}`, existe);
    if (existe) {
      const r = lire(fichier);
      verif(`route ${espace}/${action} — rôles corrects`, /ROLES_(ADMIN_STUDIO|SECRETARIAT)/.test(r));
      verif(`route ${espace}/${action} — maxDuration 60`, /maxDuration = 60/.test(r));
    }
  }
}
verif("proxy — /admin/api/studio couvre /ai/* (préfixe existant)", /\/admin\/api\/studio/.test(lire("src/proxy.ts")));

// ── 5. UI : brouillon + intervenants + rognage + IA ────────────────────

console.log("\n⑥ UI studio-shell — brouillon, intervenants, rognage, IA");
const shell = lire("src/components/studio/studio-shell.tsx");
verif("brouillon — clé localStorage", /mcl-studio-brouillon-v3/.test(shell));
verif("brouillon — sauvegarde AUTOMATIQUE debouncée", /setTimeout\(ecrireBrouillon, 800\)/.test(shell));
verif("brouillon — bouton Sauvegarder manuel", /sauvegarderMaintenant/.test(shell));
verif("brouillon — indicateur « sauvegardé à HH:MM »", /Brouillon sauvegardé à/.test(shell));
verif("brouillon — restauration au chargement", /Brouillon restauré/.test(shell));
verif("brouillon — « Repartir de zéro » efface le localStorage", /removeItem\(CLE_BROUILLON\)/.test(shell));
verif("brouillon — validation des photoIds restaurés", /listePhotos\.some\(\(p\) => p\.id === x\.photoId\)/.test(shell));
verif("intervenants — noms éditables (input)", /placeholder="Nom de l'intervenant \(modifiable\)"/.test(shell));
verif("intervenants — bouton « Ajouter un intervenant »", /Ajouter un intervenant/.test(shell));
verif("intervenants — suppression d'un intervenant", /supprimerIntervenant/.test(shell));
verif("upload direct — input fichier caché + ModalRogner", /setRogner\(\{ fichier: f, index: uploadPour \}\)/.test(shell));
verif("upload direct — envoi au serveur après rognage", /televerserPhotoRognee/.test(shell));
verif("aperçu — photos_sujet multiples", /photos_sujet: photosChoisies/.test(shell));
verif("génération — speaker_photo_ids", /speaker_photo_ids: photosChoisies/.test(shell));
verif("génération — speaker_names", /speaker_names: intervenants/.test(shell));
verif("IA — bouton peaufiner par intervenant", /peaufinerPhoto\(i\)/.test(shell));
verif("IA — génération de fond + presets", /PRESETS_FOND_IA/.test(shell));
verif("IA — état inactif expliqué (clé à ajouter)", /NVIDIA_API_KEY \(build\.nvidia\.com\)/.test(shell));

const ui = lire("src/components/studio/studio-ui.tsx");
verif("studio-ui — ModalRogner exportée", /export function ModalRogner/.test(ui));
verif(
  "rognage — ratios 3:4 / 1:1 / 4:3",
  /cle: "3:4"/.test(ui) && /cle: "1:1"/.test(ui) && /cle: "4:3"/.test(ui)
);
verif("rognage — glisser (pointer events)", /onPointerDown/.test(ui));
verif("rognage — zoom", /type="range"/.test(ui));
verif("rognage — rotation 90°", /setRotation\(\(r\) => \(r \+ 90\) % 360\)/.test(ui));
verif("rognage — EXIF normalisé (createImageBitmap)", /imageOrientation: "from-image"/.test(ui));
verif("rognage — export PNG pleine résolution", /toBlob\(\(b\) => resoudre\(b\), "image\/png"\)/.test(ui));
verif("toasts — afficherToast + ZoneToasts", /export function afficherToast/.test(ui) && /export function ZoneToasts/.test(ui));
verif("onglet Photos — nom libre avec suggestions", /list="noms-intervenants-studio"/.test(shell));

// ── 6. Intégrité git (aucun fichier perdu) ─────────────────────────────

console.log("\n⑦ Intégrité git");
const statut = execSync("git status --porcelain", { cwd: RACINE }).toString();
const supprimes = statut
  .split("\n")
  .filter((l) => l.startsWith(" D ") || l.startsWith("D "))
  .map((l) => l.substring(3).trim());
verif("aucun fichier supprimé par accident", supprimes.length === 0, supprimes.join(", "));
verif("route upload vidéo intacte (incident V3.80)", fs.existsSync(path.join(RACINE, "src/app/api/videos/[id]/upload/route.ts")));

// ── Bilan ──────────────────────────────────────────────────────────────

console.log(
  `\n═══ BILAN V3.90 : ${ok} ✔ / ${echecs} ✘ ═══`
);
process.exit(echecs === 0 ? 0 : 1);
