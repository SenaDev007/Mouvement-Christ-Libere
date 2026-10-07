#!/usr/bin/env node
/**
 * ⭐ V4.02 — Validation locale : édition titre/description des vidéos
 * depuis le back-office (module Vidéos).
 * 1) Parse Babel (tsc OOM dans le conteneur) — videos-tabs-client.tsx.
 * 2) Vérifications structurelles :
 *    - crayon « Modifier » ouvre le MODAL (plus de redirection post-production) ;
 *    - bouton ciseaux SÉPARÉ vers /admin/videos/[id]/edit (montage conservé) ;
 *    - EditVideoModal : champs Titre + Description, PATCH /admin/api/videos/:id
 *      avec { title, description }, pré-remplissage à l'ouverture, maj locale.
 */
const fs = require("fs");
const babel = require("/home/z/my-project/.tmp-babel/node_modules/@babel/parser");

const FILE = "/home/z/my-project/mouvement-christ-libere/src/components/admin/videos-tabs-client.tsx";
const FILE_PP = "/home/z/my-project/mouvement-christ-libere/src/components/post-production/post-production.tsx";
const FILE_EDIT = "/home/z/my-project/mouvement-christ-libere/src/app/admin/videos/[id]/edit/page.tsx";
let ok = 0, ko = 0;
const check = (label, cond) => {
  if (cond) { ok++; console.log(`  ✔ ${label}`); }
  else { ko++; console.log(`  ✘ ${label}`); }
};
const src = fs.readFileSync(FILE, "utf8");

console.log("── 1) Parse Babel ──");
try {
  babel.parse(src, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: false });
  check("videos-tabs-client.tsx parse (TSX)", true);
} catch (e) {
  check(`parse — ${e.message}`, false);
}

console.log("── 2) Boutons de la carte ──");
check("Crayon = BUTTON ouvrant le modal (setEditVideo(v))", /onClick=\{\(\) => setEditVideo\(v\)\}/.test(src));
check("Crayon : aria-label « Modifier le titre et la description »", src.includes('aria-label="Modifier le titre et la description"'));
check("Plus AUCUN crayon direct vers /edit (l'ancien Link remplacé)", !/aria-label="Modifier"\s*>\s*<Pencil/.test(src));
check("Ciseaux SÉPARÉ vers post-production (/admin/videos/[id]/edit)", /href=\{`\/admin\/videos\/\$\{v\.id\}\/edit`\}[\s\S]{0,300}?aria-label="Post-production \(montage\)"/.test(src));
check("Icône Scissors importée", /Scissors,/.test(src.split("} from \"lucide-react\"")[0]));

console.log("── 3) EditVideoModal ──");
check("Composant EditVideoModal défini", /function EditVideoModal\(/.test(src));
check("State editVideo (VideoWithServant | null)", /useState<VideoWithServant \| null>\(null\)/.test(src));
check("Pré-remplissage à l'ouverture (useEffect sur video)", /useEffect\(\(\) => \{\s*if \(video\) \{[\s\S]{0,200}?setTitle\(video\.title/.test(src));
check("Champ Titre (input, required, maxLength)", /maxLength=\{300\}/.test(src) && /value=\{title\}/.test(src));
check("Champ Description (textarea, rows=5)", /rows=\{5\}/.test(src) && /value=\{description\}/.test(src));
check("PATCH /admin/api/videos/:id avec title + description", /fetch\(`\/admin\/api\/videos\/\$\{video\.id\}`[\s\S]{0,200}?method: "PATCH"[\s\S]{0,300}?title: titrePropre[\s\S]{0,80}?description: description\.trim\(\)/.test(src));
check("onSaved → maj locale + router.refresh()", /onSaved=\{\(id, title, description\)/.test(src) && /prev\.map\(\(v\) => \(v\.id === id \? \{ \.\.\.v, title, description \} : v\)\)/.test(src));
check("Titre vide refusé (validation client)", src.includes('setError("Le titre est obligatoire.")'));
check("ModalError affichée en cas d'échec", /<ModalError error=\{error\} \/>/.test(src));
check("ModalSubmit « Enregistrer »", /<ModalSubmit loading=\{loading\} label="Enregistrer" \/>/.test(src));
check("Annuler présent", />Annuler<\/button>|\>\s*Annuler\s*<\/button>/.test(src));

console.log(`\n${ok}/${ok + ko} vérifications ${ko === 0 ? "✔ V4.02 OK" : "✘ ÉCHEC"}`);
if (ko !== 0) process.exit(1);

console.log("\n── 4) Post-production (en-tête) ──");
const pp = fs.readFileSync(FILE_PP, "utf8");
try {
  babel.parse(pp, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: false });
  check("post-production.tsx parse (TSX)", true);
} catch (e) {
  check(`parse post-production — ${e.message}`, false);
}
check("Prop description ajoutée (optionnelle)", /description\?: string \| null;/.test(pp));
check("Déstructuration descriptionInitiale", /description: descriptionInitiale/.test(pp));
check("Crayon dans l'en-tête (aria-label Modifier…)", pp.includes('aria-label="Modifier le titre et la description"'));
check("Panneau showEditMeta (titre + description)", /showEditMeta && \(/.test(pp) && /value=\{metaTitre\}/.test(pp) && /value=\{metaDescription\}/.test(pp));
check("PATCH apiFetch /admin/api/videos/:id", /apiFetch\(`\/admin\/api\/videos\/\$\{videoId\}`[\s\S]{0,150}?method: "PATCH"/.test(pp));
check("titreAffiche mis à jour après sauvegarde", /setTitreAffiche\(t\)/.test(pp));
check("Pencil + X importés", /Pencil, X,\n\} from "lucide-react"/.test(pp));
const editPage = fs.readFileSync(FILE_EDIT, "utf8");
check("edit page passe description={video.description}", /description=\{video\.description\}/.test(editPage));

console.log(`\n${ok}/${ok + ko} vérifications ${ko === 0 ? "✔ V4.02 OK" : "✘ ÉCHEC"}`);
process.exit(ko === 0 ? 0 : 1);
