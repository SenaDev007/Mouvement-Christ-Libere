import ExcelJS from "exceljs";
import { formatInTimeZone } from "date-fns-tz";
import {
  RECETTE_CATEGORIES,
  DEPENSE_CATEGORIES,
  libelleCategorie,
  libelleMethode,
} from "./constants";
// ⭐ V3.88/V3.81 — conversion vers la devise d'affichage (défaut XOF) pour
// le TOTAL CONSOLIDÉ de la Synthèse ; les tableaux détaillés restent en
// devises natives (règle comptable : jamais de mélange).
import { convertirMontant } from "./devises";

/**
 * ⭐ V3.81 — Export EXCEL du journal des mouvements (Trésorerie).
 *
 * Un classeur .xlsx STRUCTURÉ et DESIGNÉ (palette du ministère : violet
 * profond #2A0E3D, or #C9A227, vert recettes #5B7052, rouge dépenses
 * #B3452E, violet transferts #8C5FA8, ivoire #FAF6EF) :
 *
 *   1. « Synthèse »     — période + filtres, totaux par devise (formules
 *                         SUMIF/COUNTIF vives pointant vers les feuilles),
 *                         répartition par catégorie (recettes/dépenses) ;
 *   2. « Recettes »     — tableau designé : date, libellé, catégorie,
 *                         caisse, donateur, méthode, référence, note,
 *                         montant (format monétaire par devise), devise ;
 *   3. « Dépenses »     — idem sans donateur ;
 *   4. « Transferts »   — caisse source → caisse destination.
 *
 * Chaque feuille : bandeau titre, en-tête coloré figé (freeze), zébrures,
 * bordures fines, filtre automatique, format d'impression paysage, totaux
 * par devise en BAS du tableau (SUMIF — recalculés si le trésorier édite).
 *
 * Les dates sont exprimées au fuseau du ministère (Africa/Porto-Novo) —
 * elles correspondent à ce que le trésorier voit dans le journal.
 */

const FUSEAU_MINISTERE = "Africa/Porto-Novo";

/** Palette du ministère (ARGB, préfixe FF pour l'opacité). */
const C = {
  violetFonce: "FF2A0E3D",
  violetFonce2: "FF3D1A54",
  violet: "FF8C5FA8",
  violetClair: "FFF3EDF8",
  or: "FFC9A227",
  orClair: "FFDDBE55",
  ivoire: "FFFAF6EF",
  blanc: "FFFFFFFF",
  texte: "FF1E0F2B",
  gris: "FF8A8378",
  vert: "FF5B7052",
  vertClair: "FFEFF3EC",
  rouge: "FFB3452E",
  rougeClair: "FFF8EDEA",
  bordure: "FFDCD5C9",
  bordureForte: "FF8A8378",
} as const;

const POLICE = "Calibri";

/** Format monétaire Excel selon la devise (le CFA n'a pas de centimes). */
function numFmtMontant(devise: string): string {
  return devise === "XOF" ? "#,##0" : "#,##0.00";
}

/** Date → valeur Excel UTC-minuit affichée dd/mm/yyyy (fuseau du Bénin). */
function dateExcel(d: Date | string): Date {
  const iso = formatInTimeZone(new Date(d), FUSEAU_MINISTERE, "yyyy-MM-dd");
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

function texteDate(d: Date | string): string {
  return formatInTimeZone(new Date(d), FUSEAU_MINISTERE, "dd/MM/yyyy");
}

/** Bordure fine sur les quatre côtés. */
const bordureFine = (): Partial<ExcelJS.Borders> => ({
  top: { style: "thin", color: { argb: C.bordure } },
  left: { style: "thin", color: { argb: C.bordure } },
  bottom: { style: "thin", color: { argb: C.bordure } },
  right: { style: "thin", color: { argb: C.bordure } },
});

/** Bordure haute plus marquée pour les totaux. */
const bordureTotal = (): Partial<ExcelJS.Borders> => ({
  top: { style: "medium", color: { argb: C.bordureForte } },
  left: { style: "thin", color: { argb: C.bordure } },
  bottom: { style: "double", color: { argb: C.bordureForte } },
  right: { style: "thin", color: { argb: C.bordure } },
});

// ─────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────

export interface TransactionJournal {
  id: string;
  type: string;
  category: string;
  amount: number;
  currency: string;
  method: string | null;
  label: string;
  date: Date | string;
  reference: string | null;
  donorName: string | null;
  isAnonymous: boolean;
  note: string | null;
  caisseId?: string | null;
  caisseDestinationId?: string | null;
  caisseNom?: string | null;
  caisseDestinationNom?: string | null;
  /** ⭐ V3.88 — don en ligne rattaché (référence don_xxx) : coordonnées
   * complètes du donateur — son nom prime sur le nom saisi à la main. */
  don?: {
    donorName: string | null;
    donorEmail: string | null;
  } | null;
}

export interface MetaExportJournal {
  du?: string | null;
  au?: string | null;
  /** Filtres actifs au moment de l'export (affichés sur chaque feuille). */
  devise?: string | null;
  caisse?: string | null;
  type?: string | null;
  categorie?: string | null;
  recherche?: string | null;
  /** ⭐ V3.88/V3.81 — devise d'affichage des totaux consolidés (défaut XOF). */
  afficher?: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Construction d'une feuille « tableau » (Recettes / Dépenses / Transferts)
// ─────────────────────────────────────────────────────────────────────

interface ConfigFeuilleJournal {
  ws: ExcelJS.Worksheet;
  titre: string;
  couleur: string; // argb de l'en-tête du tableau
  entetes: string[];
  largeurs: number[];
  /** Lignes déjà formatées (le montant est un nombre, la date une Date Excel). */
  lignes: { cellules: (string | number | Date | null)[]; devise: string }[];
  periodeTexte: string;
  filtresTexte: string;
  /** Index 1-based de la colonne Montant. */
  colMontant: number;
}

/** Remplit une feuille-journal et retourne la plage de données (pour la Synthèse). */
function remplirFeuilleJournal(cfg: ConfigFeuilleJournal): { premiere: number; derniere: number } {
  const { ws, entetes, largeurs, lignes } = cfg;
  const nbCols = entetes.length;
  const colonne = (i: number) => String.fromCharCode(64 + i); // 1 → A

  // Largeurs
  ws.columns = largeurs.map((l) => ({ width: l }));

  // ── Bandeau titre (lignes 1-3 fusionnées) ──
  ws.mergeCells(1, 1, 1, nbCols);
  ws.mergeCells(2, 1, 2, nbCols);
  ws.mergeCells(3, 1, 3, nbCols);
  const t1 = ws.getCell(1, 1);
  t1.value = "MOUVEMENT CHRIST LIBÉRÉ";
  t1.font = { name: POLICE, bold: true, size: 14, color: { argb: C.orClair } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.violetFonce } };
  const t2 = ws.getCell(2, 1);
  t2.value = `${cfg.titre} — Journal des mouvements`;
  t2.font = { name: POLICE, bold: true, size: 12, color: { argb: C.ivoire } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.violetFonce } };
  const t3 = ws.getCell(3, 1);
  t3.value = `${cfg.periodeTexte} — ${lignes.length} écriture${lignes.length > 1 ? "s" : ""}${
    cfg.filtresTexte ? ` — ${cfg.filtresTexte}` : ""
  }`;
  t3.font = { name: POLICE, size: 10, italic: true, color: { argb: C.gris } };
  t3.alignment = { horizontal: "center", vertical: "middle" };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.ivoire } };
  ws.getRow(1).height = 26;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 16;
  ws.getRow(4).height = 8; // respiration

  // ── En-tête du tableau (ligne 5) ──
  const LIGNE_ENTETE = 5;
  const enteteRow = ws.getRow(LIGNE_ENTETE);
  enteteRow.height = 22;
  entetes.forEach((e, i) => {
    const c = enteteRow.getCell(i + 1);
    c.value = e;
    c.font = { name: POLICE, bold: true, size: 10.5, color: { argb: C.blanc } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cfg.couleur } };
    c.border = {
      top: { style: "thin", color: { argb: C.bordureForte } },
      left: { style: "thin", color: { argb: C.bordureForte } },
      bottom: { style: "medium", color: { argb: C.violetFonce } },
      right: { style: "thin", color: { argb: C.bordureForte } },
    };
  });

  const premiere = LIGNE_ENTETE + 1;
  let derniere = LIGNE_ENTETE;

  if (lignes.length === 0) {
    // État vide explicite (tableau toujours présent, bien structuré).
    ws.mergeCells(premiere, 1, premiere, nbCols);
    const c = ws.getCell(premiere, 1);
    c.value = "Aucune écriture ne correspond à la période / aux filtres.";
    c.font = { name: POLICE, italic: true, size: 10, color: { argb: C.gris } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.ivoire } };
    for (let i = 1; i <= nbCols; i++) {
      ws.getCell(premiere, i).border = bordureFine();
    }
    ws.getRow(premiere).height = 28;
    return { premiere, derniere: premiere };
  }

  // ── Lignes de données (zébrures ivoire / blanc) ──
  lignes.forEach((l, idx) => {
    const r = ws.getRow(premiere + idx);
    l.cellules.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v as string | number | Date | null;
      const estMontant = i + 1 === cfg.colMontant;
      const estDate = v instanceof Date;
      c.font = {
        name: POLICE,
        size: 10,
        color: { argb: C.texte },
        bold: estMontant,
      };
      c.border = bordureFine();
      if (estDate) {
        c.numFmt = "dd/mm/yyyy";
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else if (estMontant) {
        c.numFmt = numFmtMontant(l.devise);
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        c.alignment = { horizontal: "left", vertical: "middle", wrapText: false };
      }
      if (idx % 2 === 1) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.ivoire } };
      }
    });
    r.height = 18;
    derniere = premiere + idx;
  });

  // ── Totaux par devise (formules SUMIF vives) ──
  const devises = [...new Set(lignes.map((l) => l.devise))];
  const colM = colonne(cfg.colMontant);
  const colD = colonne(nbCols); // la devise est toujours la dernière colonne
  ws.getRow(derniere + 1).height = 8; // respiration

  const bas = "TOTAUX PAR DEVISE";
  const ligneTitreTotaux = derniere + 2;
  ws.mergeCells(ligneTitreTotaux, 1, ligneTitreTotaux, nbCols);
  const ct = ws.getCell(ligneTitreTotaux, 1);
  ct.value = bas;
  ct.font = { name: POLICE, bold: true, size: 10, color: { argb: C.orClair } };
  ct.alignment = { horizontal: "right", vertical: "middle" };
  ct.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.violetFonce } };
  for (let i = 1; i <= nbCols; i++) {
    ws.getCell(ligneTitreTotaux, i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: C.violetFonce },
    };
  }

  devises.forEach((d, k) => {
    const r = ws.getRow(ligneTitreTotaux + 1 + k);
    // SOMME des montants (colMontant) selon la devise (colonne Devise).
    r.getCell(cfg.colMontant).value = {
      formula: `SUMIF(${colD}${premiere}:${colD}${derniere},"${d}",${colM}${premiere}:${colM}${derniere})`,
    } as ExcelJS.CellFormulaValue;
    r.getCell(nbCols).value = d;
    r.getCell(1).value = k === 0 ? `Total ${d}` : "";
    for (let i = 1; i <= nbCols; i++) {
      const c = r.getCell(i);
      c.border = k === devises.length - 1 ? bordureTotal() : bordureFine();
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.violetClair } };
      c.font = { name: POLICE, bold: true, size: 10, color: { argb: C.texte } };
      c.alignment = { horizontal: "center", vertical: "middle" };
    }
    r.getCell(cfg.colMontant).numFmt = numFmtMontant(d);
    r.getCell(cfg.colMontant).alignment = { horizontal: "right", vertical: "middle" };
    r.height = 19;
  });

  // Ligne nombre d'écritures
  const rNb = ws.getRow(ligneTitreTotaux + 1 + devises.length);
  rNb.getCell(1).value = `Nombre d'écritures : ${lignes.length}`;
  rNb.getCell(1).font = { name: POLICE, italic: true, size: 9, color: { argb: C.gris } };
  rNb.getCell(1).alignment = { horizontal: "right", vertical: "middle" };

  // ── Confort de lecture : volets figés + filtre automatique ──
  ws.views = [{ state: "frozen", ySplit: LIGNE_ENTETE }];
  ws.autoFilter = {
    from: { row: LIGNE_ENTETE, column: 1 },
    to: { row: LIGNE_ENTETE, column: nbCols },
  };

  // ── Impression : paysage, largeur sur une page, en-tête répété ──
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.pageSetup.printTitlesRow = `${LIGNE_ENTETE}:${LIGNE_ENTETE}`;

  return { premiere, derniere };
}

// ─────────────────────────────────────────────────────────────────────
// Feuille « Synthèse »
// ─────────────────────────────────────────────────────────────────────

interface PlageFeuille {
  feuille: string; // nom de la feuille (avec accent éventuel)
  colMontant: string; // lettre de la colonne Montant
  colDevise: string; // lettre de la colonne Devise
  premiere: number;
  derniere: number;
}

function blocTitre(
  ws: ExcelJS.Worksheet,
  ligne: number,
  texte: string,
  nbCols: number,
  couleurFond: string,
  couleurTexte: string
): number {
  ws.mergeCells(ligne, 1, ligne, nbCols);
  const c = ws.getCell(ligne, 1);
  c.value = texte;
  c.font = { name: POLICE, bold: true, size: 11, color: { argb: couleurTexte } };
  c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  for (let i = 1; i <= nbCols; i++) {
    ws.getCell(ligne, i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: couleurFond },
    };
  }
  ws.getRow(ligne).height = 22;
  return ligne + 1;
}

function remplirSynthese(
  ws: ExcelJS.Worksheet,
  meta: MetaExportJournal,
  periodeTexte: string,
  filtresTexte: string,
  devises: string[],
  recettes: TransactionJournal[],
  depenses: TransactionJournal[],
  transferts: TransactionJournal[],
  plages: { recettes: PlageFeuille; depenses: PlageFeuille; transferts: PlageFeuille }
): void {
  const NB = 7; // colonnes A→G
  ws.columns = [
    { width: 34 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 13 }, { width: 13 }, { width: 13 },
  ];

  // Bandeau
  ws.mergeCells(1, 1, 1, NB);
  ws.mergeCells(2, 1, 2, NB);
  ws.mergeCells(3, 1, 3, NB);
  const t1 = ws.getCell(1, 1);
  t1.value = "MOUVEMENT CHRIST LIBÉRÉ — TRÉSORERIE";
  t1.font = { name: POLICE, bold: true, size: 15, color: { argb: C.orClair } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.violetFonce } };
  const t2 = ws.getCell(2, 1);
  t2.value = "Journal des mouvements — Synthèse";
  t2.font = { name: POLICE, bold: true, size: 12, color: { argb: C.ivoire } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.violetFonce } };
  const t3 = ws.getCell(3, 1);
  t3.value = periodeTexte;
  t3.font = { name: POLICE, size: 10, italic: true, color: { argb: C.gris } };
  t3.alignment = { horizontal: "center", vertical: "middle" };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.ivoire } };
  ws.getRow(1).height = 28;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 16;

  // Filtres + génération
  ws.mergeCells(4, 1, 4, NB);
  const t4 = ws.getCell(4, 1);
  t4.value = filtresTexte
    ? `Filtres appliqués : ${filtresTexte}`
    : "Aucun filtre — export complet du journal.";
  t4.font = { name: POLICE, size: 9.5, color: { argb: C.gris } };
  t4.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(4).height = 14;
  ws.getRow(5).height = 8;

  let ligne = 6;

  // ── 1. Totaux par devise (formules vives vers les 3 feuilles) ──
  ligne = blocTitre(ws, ligne, "①  TOTAUX PAR DEVISE", NB, C.violetFonce, C.orClair);
  const entetes = ["Devise", "Recettes", "Dépenses", "Solde", "Nb recettes", "Nb dépenses", "Nb transferts"];
  const rEnt = ws.getRow(ligne);
  entetes.forEach((e, i) => {
    const c = rEnt.getCell(i + 1);
    c.value = e;
    c.font = { name: POLICE, bold: true, size: 10, color: { argb: C.blanc } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.gris } };
    c.border = bordureFine();
  });
  ligne += 1;

  if (devises.length === 0) {
    ws.mergeCells(ligne, 1, ligne, NB);
    const c = ws.getCell(ligne, 1);
    c.value = "Aucune écriture sur la période.";
    c.font = { name: POLICE, italic: true, size: 10, color: { argb: C.gris } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    for (let i = 1; i <= NB; i++) ws.getCell(ligne, i).border = bordureFine();
    ligne += 1;
  } else {
    devises.forEach((d, k) => {
      const r = ws.getRow(ligne);
      const ref = (p: PlageFeuille) =>
        `'${p.feuille}'!$${p.colDevise}$${p.premiere}:$${p.colDevise}$${p.derniere}`;
      const refM = (p: PlageFeuille) =>
        `'${p.feuille}'!$${p.colMontant}$${p.premiere}:$${p.colMontant}$${p.derniere}`;
      r.getCell(1).value = d;
      r.getCell(2).value = {
        formula: `SUMIF(${ref(plages.recettes)},"${d}",${refM(plages.recettes)})`,
      } as ExcelJS.CellFormulaValue;
      r.getCell(3).value = {
        formula: `SUMIF(${ref(plages.depenses)},"${d}",${refM(plages.depenses)})`,
      } as ExcelJS.CellFormulaValue;
      r.getCell(4).value = {
        formula: `B${ligne}-C${ligne}`,
      } as ExcelJS.CellFormulaValue;
      r.getCell(5).value = {
        formula: `COUNTIF(${ref(plages.recettes)},"${d}")`,
      } as ExcelJS.CellFormulaValue;
      r.getCell(6).value = {
        formula: `COUNTIF(${ref(plages.depenses)},"${d}")`,
      } as ExcelJS.CellFormulaValue;
      r.getCell(7).value = {
        formula: `COUNTIF(${ref(plages.transferts)},"${d}")`,
      } as ExcelJS.CellFormulaValue;
      for (let i = 1; i <= NB; i++) {
        const c = r.getCell(i);
        c.border = k === devises.length - 1 ? bordureTotal() : bordureFine();
        if (k % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.ivoire } };
        }
        c.font = { name: POLICE, size: 10, color: { argb: C.texte } };
        c.alignment = { horizontal: "center", vertical: "middle" };
      }
      r.getCell(1).font = { name: POLICE, bold: true, size: 10, color: { argb: C.texte } };
      for (const i of [2, 3, 4]) {
        r.getCell(i).numFmt = numFmtMontant(d);
        r.getCell(i).alignment = { horizontal: "right", vertical: "middle" };
        r.getCell(i).font = { name: POLICE, bold: true, size: 10, color: { argb: C.texte } };
      }
      r.getCell(4).font = {
        name: POLICE,
        bold: true,
        size: 10,
        color: { argb: C.or } ,
      };
      r.height = 19;
      ligne += 1;
    });
  }
  ws.getRow(ligne).height = 14;
  ligne += 1;

  // ── ⭐ V3.88/V3.81 — TOTAL CONSOLIDÉ dans la devise d'affichage ──
  // (défaut XOF) : toutes les devises converties (taux de référence —
  // EUR parité fixe 655,957 F, USD référence) pour UNE vision d'ensemble.
  // Valeurs calculées à la génération (les taux ne vivent pas dans le
  // classeur) — les tableaux détaillés restent en devises natives.
  const deviseConsolidee = meta.afficher || "XOF";
  if (devises.length > 0) {
    const consolide = (liste: TransactionJournal[]) =>
      liste.reduce(
        (s, t) => s + convertirMontant(t.amount, t.currency, deviseConsolidee),
        0
      );
    const totalRecettes = consolide(recettes);
    const totalDepenses = consolide(depenses);
    const rC = ws.getRow(ligne);
    rC.getCell(1).value = `TOTAL CONSOLIDÉ (${deviseConsolidee} — toutes devises converties)`;
    rC.getCell(2).value = totalRecettes;
    rC.getCell(3).value = totalDepenses;
    rC.getCell(4).value = totalRecettes - totalDepenses;
    for (let i = 1; i <= NB; i++) {
      const c = rC.getCell(i);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.or } };
      c.font = { name: POLICE, bold: true, size: 10, color: { argb: C.violetFonce.slice(2) } };
      c.border = bordureTotal();
      c.alignment = { horizontal: "center", vertical: "middle" };
    }
    rC.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    for (const i of [2, 3, 4]) {
      rC.getCell(i).numFmt = numFmtMontant(deviseConsolidee);
      rC.getCell(i).alignment = { horizontal: "right", vertical: "middle" };
    }
    rC.height = 21;
    ligne += 1;
  }

  // ── 2 / 3. Répartitions par catégorie ──
  ligne = blocRepartition(
    ws,
    ligne,
    "②  RÉPARTITION DES RECETTES PAR CATÉGORIE",
    RECETTE_CATEGORIES,
    recettes,
    C.vert
  );
  ws.getRow(ligne).height = 14;
  ligne += 1;
  ligne = blocRepartition(
    ws,
    ligne,
    "③  RÉPARTITION DES DÉPENSES PAR CATÉGORIE",
    DEPENSE_CATEGORIES,
    depenses,
    C.rouge
  );

  // ── Pied de synthèse ──
  ligne += 1;
  ws.mergeCells(ligne, 1, ligne, NB);
  const pied = ws.getCell(ligne, 1);
  pied.value =
    "Les tableaux détaillés restent en devises d'origine (EUR, XOF, USD — le CFA n'a pas de centimes) : on n'additionne jamais des devises différentes. " +
    "Le TOTAL CONSOLIDÉ convertit toutes les devises vers la devise d'affichage (EUR : parité fixe 1 € = 655,957 F ; USD : taux de référence). " +
    "Feuilles détaillées : Recettes, Dépenses, Transferts. Les totaux par devise sont des formules : ils se recalculent si des lignes sont modifiées.";
  pied.font = { name: POLICE, italic: true, size: 9, color: { argb: C.gris } };
  pied.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  ws.getRow(ligne).height = 30;

  ws.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

/** Bloc « répartition par catégorie » (une sous-table par devise présente). */
function blocRepartition(
  ws: ExcelJS.Worksheet,
  ligne: number,
  titre: string,
  categoriesRef: Record<string, string>,
  ecritures: TransactionJournal[],
  couleur: string
): number {
  let l = blocTitre(ws, ligne, titre, 7, C.violetFonce, C.orClair);

  if (ecritures.length === 0) {
    ws.mergeCells(l, 1, l, 7);
    const c = ws.getCell(l, 1);
    c.value = "Aucune écriture sur la période.";
    c.font = { name: POLICE, italic: true, size: 10, color: { argb: C.gris } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    for (let i = 1; i <= 7; i++) ws.getCell(l, i).border = bordureFine();
    return l + 1;
  }

  const devises = [...new Set(ecritures.map((t) => t.currency))];
  for (const devise of devises) {
    // Sous-titre devise
    ws.mergeCells(l, 1, l, 7);
    const st = ws.getCell(l, 1);
    st.value = `Devise : ${devise}`;
    st.font = { name: POLICE, bold: true, size: 10, color: { argb: C.blanc } };
    st.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    for (let i = 1; i <= 7; i++) {
      ws.getCell(l, i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: couleur } };
    }
    ws.getRow(l).height = 18;
    l += 1;

    // En-têtes (tableau compact : 3 colonnes — pas de bordures vides à droite)
    const rEnt = ws.getRow(l);
    ["Catégorie", "Montant", "Part"].forEach((e, i) => {
      const c = rEnt.getCell(i + 1);
      c.value = e;
      c.font = { name: POLICE, bold: true, size: 9.5, color: { argb: C.texte } };
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", indent: i === 0 ? 1 : 0 };
      c.border = bordureFine();
    });
    l += 1;

    const lignesCat = Object.entries(categoriesRef).map(([cle, libelle]) => {
      const total = ecritures
        .filter((t) => t.currency === devise && t.category === cle)
        .reduce((s, t) => s + t.amount, 0);
      return { cle, libelle, total };
    });
    const totalGeneral = lignesCat.reduce((s, x) => s + x.total, 0);

    lignesCat.forEach((x, k) => {
      const r = ws.getRow(l);
      r.getCell(1).value = x.libelle;
      r.getCell(2).value = x.total;
      r.getCell(3).value =
        totalGeneral > 0 ? x.total / totalGeneral : 0;
      for (let i = 1; i <= 3; i++) {
        const c = r.getCell(i);
        c.border = bordureFine();
        c.font = { name: POLICE, size: 10, color: { argb: C.texte } };
        if (k % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.ivoire } };
        }
      }
      r.getCell(2).numFmt = numFmtMontant(devise);
      r.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(3).numFmt = "0.0%";
      r.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      r.height = 17;
      l += 1;
    });

    // Ligne total
    const r = ws.getRow(l);
    r.getCell(1).value = "TOTAL";
    r.getCell(2).value = totalGeneral;
    r.getCell(2).numFmt = numFmtMontant(devise);
    for (let i = 1; i <= 3; i++) {
      const c = r.getCell(i);
      c.border = bordureTotal();
      c.font = { name: POLICE, bold: true, size: 10, color: { argb: C.texte } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.ivoire } };
    }
    r.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    r.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
    r.height = 19;
    l += 1;
  }
  return l;
}

// ─────────────────────────────────────────────────────────────────────
// Point d'entrée : classeur complet
// ─────────────────────────────────────────────────────────────────────

export async function genererJournalExcel(
  transactions: TransactionJournal[],
  meta: MetaExportJournal
): Promise<Buffer> {
  const recettes = transactions.filter((t) => t.type === "RECETTE");
  const depenses = transactions.filter((t) => t.type === "DEPENSE");
  const transferts = transactions.filter((t) => t.type === "TRANSFERT");
  const devises = [...new Set(transactions.map((t) => t.currency))];

  const periodeTexte =
    meta.du || meta.au
      ? `Période : ${meta.du ? texteDate(`${meta.du}T12:00:00Z`) : "…"} – ${
          meta.au ? texteDate(`${meta.au}T12:00:00Z`) : "aujourd'hui"
        }`
      : "Période : l'ensemble du journal";
  const filtres: string[] = [];
  if (meta.type) filtres.push("type " + meta.type.toLowerCase());
  if (meta.categorie)
    filtres.push(
      "catégorie « " + libelleCategorie(meta.categorie, meta.type || "RECETTE") + " »"
    );
  if (meta.devise) filtres.push("devise " + meta.devise);
  if (meta.caisse) filtres.push(`caisse « ${meta.caisse} »`);
  if (meta.recherche) filtres.push(`recherche « ${meta.recherche} »`);
  const filtresTexte = filtres.join(" · ");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Mouvement Christ Libéré — Trésorerie";
  wb.lastModifiedBy = "Trésorerie";
  wb.created = new Date();
  wb.modified = new Date();

  const wsSynthese = wb.addWorksheet("Synthèse", {
    properties: { tabColor: { argb: C.violetFonce } },
  });
  const wsRecettes = wb.addWorksheet("Recettes", {
    properties: { tabColor: { argb: C.vert } },
  });
  const wsDepenses = wb.addWorksheet("Dépenses", {
    properties: { tabColor: { argb: C.rouge } },
  });
  const wsTransferts = wb.addWorksheet("Transferts", {
    properties: { tabColor: { argb: C.violet } },
  });

  // ── Feuille Recettes (10 colonnes) ──
  const lignesRecettes = recettes.map((t) => ({
    devise: t.currency,
    cellules: [
      dateExcel(t.date),
      t.label,
      libelleCategorie(t.category, t.type),
      t.caisseNom || "Non affectée",
      // ⭐ V3.88 — le nom du don en ligne (don_xxx) prime sur la saisie
      // manuelle ; les donateurs anonymes restent « Anonyme ».
      t.isAnonymous
        ? "Anonyme"
        : t.don?.donorName || t.donorName || "Non précisé",
      libelleMethode(t.method),
      t.reference || null,
      t.note || null,
      t.amount,
      t.currency,
    ] as (string | number | Date | null)[],
  }));
  const plageRecettes = remplirFeuilleJournal({
    ws: wsRecettes,
    titre: "Recettes",
    couleur: C.vert,
    entetes: [
      "Date", "Libellé", "Catégorie", "Caisse", "Donateur", "Méthode",
      "Référence", "Note", "Montant", "Devise",
    ],
    largeurs: [11, 44, 18, 22, 24, 17, 14, 36, 14, 8],
    lignes: lignesRecettes,
    periodeTexte,
    filtresTexte,
    colMontant: 9,
  });

  // ── Feuille Dépenses (9 colonnes) ──
  const lignesDepenses = depenses.map((t) => ({
    devise: t.currency,
    cellules: [
      dateExcel(t.date),
      t.label,
      libelleCategorie(t.category, t.type),
      t.caisseNom || "Non affectée",
      libelleMethode(t.method),
      t.reference || null,
      t.note || null,
      t.amount,
      t.currency,
    ] as (string | number | Date | null)[],
  }));
  const plageDepenses = remplirFeuilleJournal({
    ws: wsDepenses,
    titre: "Dépenses",
    couleur: C.rouge,
    entetes: [
      "Date", "Libellé", "Catégorie", "Caisse", "Méthode",
      "Référence", "Note", "Montant", "Devise",
    ],
    largeurs: [11, 44, 20, 22, 17, 14, 38, 14, 8],
    lignes: lignesDepenses,
    periodeTexte,
    filtresTexte,
    colMontant: 8,
  });

  // ── Feuille Transferts (8 colonnes) ──
  const lignesTransferts = transferts.map((t) => ({
    devise: t.currency,
    cellules: [
      dateExcel(t.date),
      t.label,
      t.caisseNom || "?",
      t.caisseDestinationNom || "?",
      t.reference || null,
      t.note || null,
      t.amount,
      t.currency,
    ] as (string | number | Date | null)[],
  }));
  const plageTransferts = remplirFeuilleJournal({
    ws: wsTransferts,
    titre: "Transferts internes",
    couleur: C.violet,
    entetes: [
      "Date", "Libellé", "Caisse source", "Caisse destination",
      "Référence", "Note", "Montant", "Devise",
    ],
    largeurs: [11, 44, 22, 24, 14, 40, 14, 8],
    lignes: lignesTransferts,
    periodeTexte,
    filtresTexte,
    colMontant: 7,
  });

  // ── Feuille Synthèse (en tête du classeur) ──
  remplirSynthese(
    wsSynthese,
    meta,
    `${periodeTexte} — ${formatInTimeZone(
      new Date(),
      FUSEAU_MINISTERE,
      "'généré le' dd/MM/yyyy 'à' HH'h'mm"
    )} (heure de Cotonou)`,
    filtresTexte,
    devises,
    recettes,
    depenses,
    transferts,
    {
      recettes: { feuille: "Recettes", colMontant: "I", colDevise: "J", ...plageRecettes },
      depenses: { feuille: "Dépenses", colMontant: "H", colDevise: "I", ...plageDepenses },
      transferts: { feuille: "Transferts", colMontant: "G", colDevise: "H", ...plageTransferts },
    }
  );

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
