/**
 * Validation V3.81 — Export Excel (trésorerie) + Suppression multiple (vidéos).
 *
 * Vérifie statiquement TOUS les points d'intégration des deux fonctionnalités :
 *   A. Export Excel du journal des mouvements ;
 *   B. Suppression multiple des vidéos du back-office.
 */
const { readFileSync, existsSync } = require("node:fs");

const RACINE = "/home/z/my-project/mouvement-christ-libere";
let ok = 0;
const echecs = [];

const verifie = (cond, libelle) => {
  if (cond) ok++;
  else echecs.push(libelle);
};
const lit = (p) => readFileSync(`${RACINE}/${p}`, "utf8");

// ═══════════════════════════════════════════════════════════════════
// A. EXPORT EXCEL — Journal des mouvements (trésorerie)
// ═══════════════════════════════════════════════════════════════════

// A1. Dépendance
const pkg = JSON.parse(lit("package.json"));
verifie(
  pkg.dependencies && pkg.dependencies.exceljs,
  "exceljs présent dans les dépendances"
);

// A2. Bibliothèque de génération
const excelLib = lit("src/lib/staff-space/excel.ts");
verifie(excelLib.includes("export async function genererJournalExcel"), "genererJournalExcel exporté");
verifie(excelLib.includes('"Synthèse"'), "Feuille Synthèse");
verifie(excelLib.includes('"Recettes"'), "Feuille Recettes");
verifie(excelLib.includes('"Dépenses"'), "Feuille Dépenses");
verifie(excelLib.includes('"Transferts"'), "Feuille Transferts");
verifie(excelLib.includes("SUMIF"), "Formules SUMIF des totaux");
verifie(excelLib.includes("COUNTIF"), "Formules COUNTIF de la Synthèse");
verifie(excelLib.includes("Africa/Porto-Novo"), "Dates au fuseau du Bénin");
verifie(excelLib.includes('devise === "XOF" ? "#,##0"'), "CFA sans centimes");
verifie(excelLib.includes("autoFilter"), "Filtre automatique");
verifie(excelLib.includes('state: "frozen"'), "Volets figés");
verifie(excelLib.includes("printTitlesRow"), "En-tête répété à l'impression");
verifie(excelLib.includes("Anonyme"), "Donateurs anonymes gérés");
verifie(excelLib.includes("Aucune écriture ne correspond"), "État vide géré");

// A3. Route API — format=xlsx
const route = lit("src/app/tresorerie/api/transactions/route.ts");
verifie(route.includes('format === "xlsx"'), "Branchement format=xlsx");
verifie(
  route.includes('format === "csv" || format === "xlsx"'),
  "Export complet (toutes lignes) pour csv ET xlsx"
);
verifie(
  route.includes("genererJournalExcel"),
  "Appel du générateur Excel"
);
verifie(
  route.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  "Content-Type .xlsx correct"
);
verifie(
  route.includes('filename="journal-tresorerie-'),
  "Nom de fichier journal-tresorerie-…"
);
verifie(route.includes("maxDuration = 30"), "maxDuration 30 s (génération lourde)");
// La session trésorerie reste exigée AVANT tout export.
verifie(
  route.includes("exigerSession(request, ROLES_TRESORERIE)"),
  "Garde de session trésorerie intacte"
);
// Le CSV reste disponible (compatibilité).
verifie(route.includes('format === "csv"'), "Export CSV conservé (compatibilité)");

// A4. Interface — bouton Export Excel
const page = lit("src/app/tresorerie/transactions/page.tsx");
verifie(page.includes("exporterExcel"), "Handler exporterExcel");
verifie(page.includes('params.set("format", "xlsx")'), "Paramètre format=xlsx");
verifie(page.includes("FileSpreadsheet"), "Icône tableur");
verifie(page.includes("Export Excel"), "Bouton « Export Excel »");
verifie(!page.includes("exporterCsv"), "Plus de bouton CSV dans l'interface");
verifie(
  page.includes("caisseFiltre) params.set(\"caisse\""),
  "Filtres actifs transmis (caisse)"
);
verifie(
  page.includes('params.set("du", du)'),
  "Filtres actifs transmis (période)"
);

// ═══════════════════════════════════════════════════════════════════
// B. SUPPRESSION MULTIPLE — Module Vidéos (back-office)
// ═══════════════════════════════════════════════════════════════════

// B1. Route API dédiée
const routeBulk = "src/app/admin/api/videos/bulk-delete/route.ts";
verifie(existsSync(`${RACINE}/${routeBulk}`), "Route bulk-delete présente");
const bulk = lit(routeBulk);
verifie(bulk.includes("deleteMany"), "Suppression physique deleteMany");
verifie(bulk.includes("MAX_PAR_LOT = 100"), "Plafond de 100 vidéos par lot");
verifie(bulk.includes("purgerArtefactsR2"), "Purge R2 incluse");
verifie(bulk.includes('`videos/video-${v.id}`'), "Préfixe artefacts fichier principal");
verifie(
  bulk.includes("`rendered-videos/video-${v.id}`"),
  "Préfixe artefacts post-production"
);
verifie(bulk.includes("isR2Configured()"), "Purge conditionnelle à R2");
verifie(
  bulk.includes("introuvables"),
  "Les vidéos déjà supprimées sont rapportées, pas en erreur"
);
verifie(bulk.includes("maxDuration = 30"), "maxDuration 30 s");

// B2. Composant — mode sélection
const videos = lit("src/components/admin/videos-tabs-client.tsx");
verifie(videos.includes("modeSelection"), "État modeSelection");
verifie(videos.includes("idsSelection"), "État idsSelection (Set)");
verifie(videos.includes("basculerSelection"), "Bascule de sélection");
verifie(videos.includes("toutSelectionner"), "Tout sélectionner (visible)");
verifie(videos.includes("confirmerSuppressionMultiple"), "Confirmation groupée");
verifie(
  videos.includes("/admin/api/videos/bulk-delete"),
  "Appel à l'API bulk-delete"
);
verifie(
  videos.includes("TAILLE_LOT = 50"),
  "Lots séquentiels de 50 côté client"
);
verifie(videos.includes("progressionSuppression"), "Progression affichée");
verifie(videos.includes("ListChecks"), "Icône ListChecks");
verifie(
  videos.includes("Suppression multiple — cocher plusieurs vidéos"),
  "Bouton Sélection expliqué au survol"
);
verifie(
  videos.includes("Supprimer définitivement"),
  "Bouton de confirmation explicite"
);
verifie(
  videos.includes("purge incluse"),
  "L'avertissement mentionne la purge cloud"
);
verifie(
  videos.includes("quitterModeSelection"),
  "Sortie du mode sélection"
);
verifie(
  videos.includes("retourSuppressionMultiple"),
  "Bandeau de retour après suppression"
);
verifie(
  videos.includes("pointer-events-none opacity-30"),
  "Actions unitaires neutralisées en mode sélection"
);
verifie(
  videos.includes("ring-2 ring-[#C9A227]"),
  "Carte sélectionnée mise en évidence (or)"
);
// La suppression unitaire existante reste en place.
verifie(
  videos.includes('<DeleteButton entity="videos" id={v.id} />'),
  "Suppression unitaire conservée hors mode sélection"
);
// Import du modal admin réutilisé.
verifie(
  videos.includes("AdminModal"),
  "Modal admin réutilisé pour la confirmation"
);

// B3. Le proxy protège toujours la nouvelle route (garde /admin/*).
const proxy = lit("src/proxy.ts");
verifie(
  proxy.includes('pathname.startsWith("/admin")'),
  "Garde d'authentification admin inchangée (couvre /admin/api/videos/bulk-delete)"
);
verifie(
  !proxy.includes('"/admin/api/videos/bulk-delete"'),
  "bulk-delete PAS exempté de la garde (protégé)"
);

// ═══════════════════════════════════════════════════════════════════
const total = ok + echecs.length;
console.log(`\n${ok}/${total} vérification(s) OK`);
if (echecs.length > 0) {
  console.log("ÉCHECS :");
  for (const e of echecs) console.log("  ✗ " + e);
  process.exit(1);
}
console.log("=== VALIDATION V3.81 : SUCCÈS ===");
