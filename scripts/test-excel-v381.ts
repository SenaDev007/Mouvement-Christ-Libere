/**
 * Test V3.81 — Générateur Excel du journal des mouvements (trésorerie).
 *
 * 1. Génère un classeur avec des données réalistes (recettes XOF/EUR/USD,
 *    dépenses, transferts, donateur anonyme, champs vides, section vide) ;
 * 2. Relit le fichier avec ExcelJS (validité .xlsx) ;
 * 3. Vérifie : ordre des feuilles, bandeaux, en-têtes, formats monétaires,
 *    formules SUMIF des totaux, formules cross-sheet de la Synthèse ;
 * 4. Écrit l'exemple dans /home/z/my-project/download/ pour prévisuation.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import ExcelJS from "exceljs";

const LIB = new URL("../src/lib/staff-space/excel.ts", import.meta.url).pathname;

const { genererJournalExcel } = await import(LIB);

const maintenant = Date.now();
const ilYA = (jours: number) => new Date(maintenant - jours * 86400_000);

const transactions = [
  // ── Recettes ──
  {
    id: "r1", type: "RECETTE", category: "dime", amount: 25000, currency: "XOF",
    method: "mobile_money", label: "Dîme du culte dominical", date: ilYA(1),
    reference: "PIECE-001", donorName: "Frère Jonas", isAnonymous: false,
    note: "Reçu en main propre après le culte", caisseId: "c1", caisseNom: "Caisse principale",
  },
  {
    id: "r2", type: "RECETTE", category: "offrande", amount: 187500, currency: "XOF",
    method: "especes", label: "Offrande du culte de louange", date: ilYA(2),
    reference: "PIECE-002", donorName: null, isAnonymous: true,
    note: null, caisseId: "c1", caisseNom: "Caisse principale",
  },
  {
    id: "r3", type: "RECETTE", category: "don", amount: 50, currency: "EUR",
    method: "virement", label: "Don depuis l'Europe", date: ilYA(4),
    reference: "VIR-EUR-77", donorName: "Sœur Marie-Claire", isAnonymous: false,
    note: "Don destiné au projet d'eau potable", caisseId: "c2", caisseNom: "Caisse don",
  },
  {
    id: "r4", type: "RECETTE", category: "projet", amount: 120, currency: "USD",
    method: "carte", label: "Financement projet école", date: ilYA(6),
    reference: null, donorName: "Église partenaire", isAnonymous: false,
    note: null, caisseId: null, caisseNom: null,
  },
  // ── Dépenses ──
  {
    id: "d1", type: "DEPENSE", category: "transport", amount: 15000, currency: "XOF",
    method: "especes", label: "Transport sonorisation", date: ilYA(3),
    reference: "DEP-014", donorName: null, isAnonymous: false,
    note: "Aller-retour Cotonou", caisseId: "c1", caisseNom: "Caisse principale",
  },
  {
    id: "d2", type: "DEPENSE", category: "materiel", amount: 89000.5, currency: "XOF",
    method: "mobile_money", label: "Micro-cravates (2)", date: ilYA(5),
    reference: "DEP-013", donorName: null, isAnonymous: false,
    note: null, caisseId: "c1", caisseNom: "Caisse principale",
  },
  {
    id: "d3", type: "DEPENSE", category: "charges", amount: 30, currency: "EUR",
    method: "virement", label: "Hébergement du site", date: ilYA(8),
    reference: "DEP-EUR-3", donorName: null, isAnonymous: false,
    note: "Abonnement mensuel", caisseId: "c2", caisseNom: "Caisse don",
  },
  // ── Transfert ──
  {
    id: "t1", type: "TRANSFERT", category: "transfert", amount: 60000, currency: "XOF",
    method: null, label: "Mise en sécurité des offrandes", date: ilYA(2),
    reference: "TRF-009", donorName: null, isAnonymous: false,
    note: "Vers le compte bancaire après le culte",
    caisseId: "c1", caisseDestinationId: "c3",
    caisseNom: "Caisse principale", caisseDestinationNom: "Compte bancaire",
  },
];

const tampon = await genererJournalExcel(transactions, {
  du: "2026-09-01",
  au: "2026-09-16",
  devise: null,
  type: null,
  categorie: null,
  caisse: null,
  recherche: null,
});

// ── Écriture pour prévisuation ──
mkdirSync("/home/z/my-project/download", { recursive: true });
const CHEMIN = "/home/z/my-project/download/journal-tresorerie-exemple-v381.xlsx";
writeFileSync(CHEMIN, tampon);

// ── Relecture et vérifications ──
let ok = 0; const echecs = [];
const verifier = (cond: boolean, libelle: string) => {
  if (cond) { ok++; }
  else { echecs.push(libelle); }
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(tampon as unknown as ArrayBuffer);

const nomsFeuilles = wb.worksheets.map((w) => w.name);
verifier(nomsFeuilles.length === 4, `4 feuilles (obtenu : ${nomsFeuilles.join(", ")})`);
verifier(nomsFeuilles[0] === "Synthèse", "La Synthèse est la 1re feuille");
verifier(nomsFeuilles.includes("Recettes"), "Feuille Recettes présente");
verifier(nomsFeuilles.includes("Dépenses"), "Feuille Dépenses présente");
verifier(nomsFeuilles.includes("Transferts"), "Feuille Transferts présente");

const wsR = wb.worksheets.find((w) => w.name === "Recettes")!;
const wsD = wb.worksheets.find((w) => w.name === "Dépenses")!;
const wsT = wb.worksheets.find((w) => w.name === "Transferts")!;
const wsS = wb.worksheets.find((w) => w.name === "Synthèse")!;

// Bandeaux
verifier(wsR.getCell("A1").value === "MOUVEMENT CHRIST LIBÉRÉ", "Bandeau titre Recettes");
verifier(String(wsR.getCell("A2").value).includes("Recettes"), "Sous-titre Recettes");
verifier(String(wsR.getCell("A3").value).includes("4 écritures"), "Compteur recettes affiché");

// En-têtes des tableaux
verifier(wsR.getCell("A5").value === "Date" && wsR.getCell("J5").value === "Devise", "En-têtes Recettes A5/J5");
verifier(wsD.getCell("A5").value === "Date" && wsD.getCell("I5").value === "Devise", "En-têtes Dépenses A5/I5");
verifier(wsT.getCell("C5").value === "Caisse source" && wsT.getCell("D5").value === "Caisse destination", "En-têtes Transferts");

// Données
verifier(wsR.getCell("B6").value === "Dîme du culte dominical", "Libellé 1re recette");
verifier(wsR.getCell("E7").value === "Anonyme", "Donateur anonyme");
verifier(wsR.getCell("I6").value === 25000, "Montant numérique");
verifier(wsR.getCell("I6").numFmt === "#,##0", "Format CFA sans centimes");
verifier(wsR.getCell("I8").numFmt === "#,##0.00", "Format EUR avec centimes");
verifier(wsR.getCell("D9").value === "Non affectée", "Caisse non affectée");
verifier(wsD.getRow(6).getCell(8).value === 15000, "Montant 1re dépense");
verifier(wsT.getCell("C6").value === "Caisse principale", "Caisse source transfert");
verifier(wsT.getCell("D6").value === "Compte bancaire", "Caisse destination transfert");

// Formules de totaux par devise (Recettes : 4 lignes de données 6-9 →
// respiration L10, libellé L11, totaux à partir de L12)
const sommeXOF = wsR.getCell("I12").value;
verifier(
  typeof sommeXOF === "object" && sommeXOF !== null && "formula" in (sommeXOF as object) &&
    (sommeXOF as { formula: string }).formula.includes("SUMIF"),
  `Formule SUMIF total XOF (obtenu : ${JSON.stringify(sommeXOF)})`
);

// Synthèse — formules cross-sheet
let formuleCross = null;
for (let l = 1; l <= 40; l++) {
  const v = wsS.getRow(l).getCell(2).value;
  if (typeof v === "object" && v !== null && "formula" in (v as object)) {
    const f = (v as { formula: string }).formula;
    if (f.includes("Recettes")) { formuleCross = f; break; }
  }
}
verifier(formuleCross !== null, "Formule cross-sheet présente dans la Synthèse");
if (formuleCross) {
  verifier(formuleCross.includes("'Recettes'!"), "Référence feuille Recettes quotée");
}

// La Synthèse contient la mention de période
let texteSynthese = "";
wsS.eachRow((row) => {
  row.eachCell((c) => { texteSynthese += String(c.value || "") + " "; });
});
verifier(texteSynthese.includes("Période"), "Période affichée dans la Synthèse");
verifier(texteSynthese.includes("RÉPARTITION DES RECETTES"), "Répartition recettes présente");
verifier(texteSynthese.includes("RÉPARTITION DES DÉPENSES"), "Répartition dépenses présente");

// Filtre automatique + volets figés
verifier(wsR.autoFilter !== undefined && wsR.autoFilter !== null, "Filtre automatique Recettes");
verifier(Array.isArray(wsR.views) && (wsR.views[0] as { state?: string }).state === "frozen", "Volets figés Recettes");

// Taille du fichier raisonnable
const taille = tampon.length;
verifier(taille > 5000 && taille < 200000, `Taille du .xlsx (${taille} octets)`);

console.log(`\n${ok} vérification(s) OK, ${echecs.length} échec(s)`);
if (echecs.length > 0) {
  console.log("ÉCHECS :");
  for (const e of echecs) console.log("  ✗ " + e);
  process.exit(1);
}
console.log(`Exemple écrit : ${CHEMIN} (${(taille / 1024).toFixed(1)} Ko)`);

// Test 2 : journal VIDE (aucune écriture) — ne doit pas planter
const vide = await genererJournalExcel([], { du: null, au: null, devise: null });
const wbVide = new ExcelJS.Workbook();
await wbVide.xlsx.load(vide as unknown as ArrayBuffer);
const nomsVides = wbVide.worksheets.map((w) => w.name).join(",");
if (nomsVides !== "Synthèse,Recettes,Dépenses,Transferts") {
  console.log("✗ Journal vide : feuilles = " + nomsVides);
  process.exit(1);
}
console.log("Journal vide : 4 feuilles générées sans erreur ✓");

console.log("\n=== TEST V3.81 EXCEL : SUCCÈS ===");
