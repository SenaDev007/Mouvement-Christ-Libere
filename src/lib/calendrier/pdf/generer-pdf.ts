/**
 * Génération du PDF « Calendrier Biblique » — édition designée.
 *
 * ⭐ V3.10 : remplace l'export iCal par un vrai DOCUMENT PDF généré par le
 * backend (pdf-lib + fontkit), fidèle au design du site :
 *   · nuit #2A0E3D, or #C9A227, crème #FAF6EF, taupe #8A8378 ;
 *   · titres serif (DejaVu Serif Bold), corps sans (DejaVu Sans) ;
 *   · hébreu sans niquoud rendu par inversion manuelle (le PDF n'a pas
 *     de moteur bidi — exact pour l'hébreu sans ligatures contextuelles).
 *
 * Trois modes (choisis par l'utilisateur avant génération) :
 *   · « mois »      : 12 planches — un mois par page, grande grille +
 *                     panneau des fêtes du mois ;
 *   · « trimestre » : 4 planches — les 3 mois du trimestre côte à côte +
 *                     tableau des fêtes du trimestre ;
 *   · « annee »     : 1 planche récapitulative des 12 mois + 1 planche
 *                     des fêtes de l'Éternel.
 *
 * Chaque édition commence par une page de couverture.
 */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  type RGB,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  FONT_SANS_B64,
  FONT_SANS_GRAS_B64,
  FONT_SERIF_GRAS_B64,
} from "./fonts";
import { MODES_PDF, type ModePdfCalendrier } from "./modes";
export type { ModePdfCalendrier } from "./modes";
import {
  genererAnnee,
  getStructureMois,
  type JourBiblique,
} from "../generation";
import { calculerFetesPourAnnee, type OccurrenceFete } from "../fetes";
import { libelleAnneeBiblique } from "../conversion";
import { JOURS_SEMAINE_HEBREU } from "../jours-semaine-hebreu";

// ═══ Palette ═════════════════════════════════════════════════════════════

const NUIT = rgb(0.165, 0.055, 0.239); // #2A0E3D
const NUIT_PROFONDE = rgb(0.118, 0.059, 0.169); // #1E0F2B
const OR = rgb(0.788, 0.635, 0.153); // #C9A227
const OR_PALE = rgb(0.937, 0.898, 0.749); // #EFE5BF approx
const CREME = rgb(0.980, 0.965, 0.937); // #FAF6EF
const ENCRE = rgb(0.118, 0.059, 0.169); // #1E0F2B
const TAUPE = rgb(0.541, 0.514, 0.471); // #8A8378
const BLANC = rgb(1, 1, 1);

const A4: [number, number] = [595.28, 841.89];
const MARGE = 40;

// ═══ Helpers ═════════════════════════════════════════════════════════════

/** #RRGGBB → RGB pdf-lib (défensif : défaut or). */
function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return OR;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Éclaircit une couleur (mélange vers le blanc) — t=0 → identique. */
function eclaircir(c: RGB, t: number): RGB {
  return rgb(c.red + (1 - c.red) * t, c.green + (1 - c.green) * t, c.blue + (1 - c.blue) * t);
}

/** Assombrit une couleur (mélange vers le noir) — t=0 → identique. */
function assombrir(c: RGB, t: number): RGB {
  return rgb(c.red * (1 - t), c.green * (1 - t), c.blue * (1 - t));
}

/** Retire le niquoud puis inverse l'ordre des caractères (hébreu en PDF). */
export function inverserHebreu(texte: string): string {
  return texte
    .replace(/[\u0591-\u05C7]/g, "") // points vocaliques
    .split("")
    .reverse()
    .join("");
}

/** Largeur d'un texte dans une police/taille (0 si vide). */
function largeurTexte(f: PDFFont, taille: number, texte: string): number {
  try {
    return f.widthOfTextAtSize(texte, taille);
  } catch {
    return 0;
  }
}

/** Coupe un texte en lignes tenant dans une largeur donnée. */
function couperTexte(f: PDFFont, taille: number, texte: string, largeurMax: number): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [];
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (largeurTexte(f, taille, essai) <= largeurMax || !courante) {
      courante = essai;
    } else {
      lignes.push(courante);
      courante = mot;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/** Tronque avec ellipse si trop large. */
function tronquer(f: PDFFont, taille: number, texte: string, largeurMax: number): string {
  if (largeurTexte(f, taille, texte) <= largeurMax) return texte;
  let t = texte;
  while (t.length > 1 && largeurTexte(f, taille, `${t}…`) > largeurMax) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

function formatCourt(d: Date): string {
  const j = d.getUTCDate();
  const m = d.getUTCMonth() + 1;
  return `${String(j).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function formatLong(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function nomJourAbr(num: number): string {
  return JOURS_SEMAINE_HEBREU[num - 1]?.frAbbr ?? "";
}

// ═══ Données de l'année ══════════════════════════════════════════════════

const STRUCTURE_MOIS = getStructureMois();

const SAISONS_TRIMESTRES = [
  { nom: "Trimestre 1 — Printemps", saison: "Printemps" },
  { nom: "Trimestre 2 — Été", saison: "Été" },
  { nom: "Trimestre 3 — Automne", saison: "Automne" },
  { nom: "Trimestre 4 — Hiver", saison: "Hiver" },
];

/** Fêtes indexées par jour de l'année. */
function indexFetesParJour(fetes: OccurrenceFete[], jours: JourBiblique[]): Map<number, OccurrenceFete> {
  const map = new Map<number, OccurrenceFete>();
  for (const occ of fetes) {
    const jour = jours.find((j) => j.jourDeAnnee === occ.jourAnnee);
    if (jour) map.set(jour.jourDeAnnee, occ);
  }
  return map;
}

// ═══ Contexte de dessin ══════════════════════════════════════════════════

interface Ctx {
  doc: PDFDocument;
  sans: PDFFont;
  sansGras: PDFFont;
  serif: PDFFont;
  numPage: number; // pages de contenu (hors couverture)
  nbPages: number; // total pages de contenu (pour « x/y »)
  libelle: string;
}

/** Pied de page commun (filet or + source + pagination). */
function piedDePage(ctx: Ctx, page: PDFPage, sousTitre: string): void {
  const y = 26;
  page.drawLine({
    start: { x: MARGE, y: y + 14 },
    end: { x: A4[0] - MARGE, y: y + 14 },
    thickness: 0.6,
    color: eclaircir(OR, 0.35),
  });
  page.drawText("Calendrier de l'Éternel · 364 jours · Mouvement Christ Libère", {
    x: MARGE,
    y,
    font: ctx.sans,
    size: 6.5,
    color: TAUPE,
  });
  page.drawText(`${sousTitre} · ${ctx.numPage}/${ctx.nbPages}`, {
    x: A4[0] - MARGE - largeurTexte(ctx.sans, 6.5, `${sousTitre} · ${ctx.numPage}/${ctx.nbPages}`),
    y,
    font: ctx.sans,
    size: 6.5,
    color: TAUPE,
  });
}

// ═══ Page de couverture ══════════════════════════════════════════════════

function pageCouverture(
  ctx: Ctx,
  annee: number,
  mode: ModePdfCalendrier,
  debut: Date,
  fin: Date,
  nbFetes: number
): PDFPage {
  const page = ctx.doc.addPage(A4);

  // Fond nuit profonde
  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: NUIT_PROFONDE });

  // Halo doré simulé : cercles concentriques translucides
  const cx = A4[0] / 2;
  const cy = A4[1] - 300;
  const halos: Array<[number, number]> = [
    [220, 0.05],
    [160, 0.07],
    [105, 0.10],
  ];
  for (const [rayon, opacite] of halos) {
    page.drawCircle({
      x: cx,
      y: cy,
      size: rayon,
      color: OR,
      opacity: opacite,
    });
  }

  // Médaillon : cercle double or + corne stylisée (arc conique)
  page.drawCircle({ x: cx, y: cy, size: 62, color: NUIT_PROFONDE });
  page.drawCircle({ x: cx, y: cy, size: 62, borderColor: OR, borderWidth: 1.6 });
  page.drawCircle({ x: cx, y: cy, size: 55, borderColor: eclaircir(OR, 0.4), borderWidth: 0.5 });
  // Corne de shofar stylisée : deux arcs formant un cône courbe
  page.drawSvgPath(
    "M -34 8 C -10 26, 14 30, 30 16 C 20 28, 2 36, -14 30 C -26 26, -34 18, -34 8 Z",
    { x: cx, y: cy - 6, borderColor: OR, borderWidth: 1.4, color: OR, opacity: 0.85 }
  );
  page.drawSvgPath(
    "M -38 -2 C -16 -18, 12 -22, 34 -8 C 16 -26, -12 -24, -30 -12 Z",
    { x: cx, y: cy - 4, borderColor: eclaircir(OR, 0.3), borderWidth: 0.8, color: OR, opacity: 0.4 }
  );

  // Titres
  page.drawText("MOUVEMENT CHRIST LIBÈRE", {
    x: cx - largeurTexte(ctx.sansGras, 10, "MOUVEMENT CHRIST LIBÈRE") / 2,
    y: cy + 108,
    font: ctx.sansGras,
    size: 10,
    color: eclaircir(OR, 0.25),
  });
  page.drawText("Calendrier Biblique", {
    x: cx - largeurTexte(ctx.serif, 34, "Calendrier Biblique") / 2,
    y: cy + 62,
    font: ctx.serif,
    size: 34,
    color: CREME,
  });
  page.drawText(ctx.libelle, {
    x: cx - largeurTexte(ctx.serif, 22, ctx.libelle) / 2,
    y: cy + 34,
    font: ctx.serif,
    size: 22,
    color: OR,
  });

  // Filet or sous le libellé
  page.drawLine({
    start: { x: cx - 70, y: cy + 22 },
    end: { x: cx + 70, y: cy + 22 },
    thickness: 0.8,
    color: OR,
  });

  // Plage de l'année
  const plage = `du ${formatLong(debut)} au ${formatLong(fin)}`;
  page.drawText(plage, {
    x: cx - largeurTexte(ctx.sans, 10.5, plage) / 2,
    y: cy - 92,
    font: ctx.sans,
    size: 10.5,
    color: CREME,
    opacity: 0.85,
  });
  const resume = `364 jours · 52 semaines · 12 mois · ${nbFetes} fêtes de l'Éternel`;
  page.drawText(resume, {
    x: cx - largeurTexte(ctx.sans, 9.5, resume) / 2,
    y: cy - 110,
    font: ctx.sans,
    size: 9.5,
    color: eclaircir(OR, 0.15),
  });

  // Édition choisie
  const modeInfo = MODES_PDF.find((m) => m.id === mode)!;
  const edition = `Édition : ${modeInfo.titre} — ${modeInfo.detail}`;
  const boxW = largeurTexte(ctx.sans, 9, edition) + 28;
  page.drawRectangle({
    x: (A4[0] - boxW) / 2,
    y: cy - 156,
    width: boxW,
    height: 24,
    color: OR,
    opacity: 0.12,
    borderColor: eclaircir(OR, 0.2),
    borderWidth: 0.7,
  });
  page.drawText(edition, {
    x: (A4[0] - largeurTexte(ctx.sans, 9, edition)) / 2,
    y: cy - 148,
    font: ctx.sans,
    size: 9,
    color: eclaircir(OR, 0.1),
  });

  // Citation
  const citation = "« Il y eut un soir, il y eut un matin — un jour. »";
  page.drawText(citation, {
    x: cx - largeurTexte(ctx.sans, 9, citation) / 2,
    y: 150,
    font: ctx.sans,
    size: 9,
    color: CREME,
    opacity: 0.6,
  });
  page.drawText("Genèse 1:5 · L'année commence toujours un mercredi, jour des luminaires", {
    x: cx - largeurTexte(ctx.sans, 8, "Genèse 1:5 · L'année commence toujours un mercredi, jour des luminaires") / 2,
    y: 136,
    font: ctx.sans,
    size: 8,
    color: OR,
    opacity: 0.7,
  });

  // Bas de couverture
  page.drawText("mouvement-christ-libere.vercel.app", {
    x: cx - largeurTexte(ctx.sans, 8.5, "mouvement-christ-libere.vercel.app") / 2,
    y: 60,
    font: ctx.sans,
    size: 8.5,
    color: CREME,
    opacity: 0.45,
  });

  return page;
}


// ═══ MODE MOIS : une planche par mois ════════════════════════════════════

function enTeteBandeau(
  ctx: Ctx,
  page: PDFPage,
  titre: string,
  sousTitre: string,
  hauteur: number
): void {
  const y = A4[1] - hauteur;
  page.drawRectangle({ x: 0, y, width: A4[0], height: hauteur, color: NUIT });
  page.drawRectangle({ x: 0, y, width: A4[0], height: 2.2, color: OR });
  page.drawText(titre, {
    x: MARGE,
    y: y + hauteur - 34,
    font: ctx.serif,
    size: 21,
    color: CREME,
  });
  page.drawText(sousTitre, {
    x: MARGE,
    y: y + hauteur - 52,
    font: ctx.sans,
    size: 8.5,
    color: OR,
  });
  // Libellé d'année à droite
  page.drawText(ctx.libelle, {
    x: A4[0] - MARGE - largeurTexte(ctx.serif, 13, ctx.libelle),
    y: y + hauteur - 34,
    font: ctx.serif,
    size: 13,
    color: OR,
  });
  page.drawText("Calendrier de l'Éternel", {
    x: A4[0] - MARGE - largeurTexte(ctx.sans, 7, "Calendrier de l'Éternel"),
    y: y + hauteur - 50,
    font: ctx.sans,
    size: 7,
    color: eclaircir(CREME, 0.4),
  });
}

/** Dessine une en-tête de colonnes Dim…Sam (abbr + translit). */
function enTeteColonnes(
  ctx: Ctx,
  page: PDFPage,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  compact: boolean
): void {
  const pas = largeur / 7;
  for (let c = 0; c < 7; c++) {
    const info = JOURS_SEMAINE_HEBREU[c];
    const estShabbat = info.numero === 7;
    const cx = x + c * pas;
    page.drawRectangle({
      x: cx,
      y,
      width: pas,
      height: hauteur,
      color: estShabbat ? eclaircir(OR, 0.55) : eclaircir(NUIT, 0.9),
    });
    if (compact) {
      const t = info.frAbbr;
      page.drawText(t, {
        x: cx + pas / 2 - largeurTexte(ctx.sansGras, 6, t) / 2,
        y: y + hauteur / 2 - 2,
        font: ctx.sansGras,
        size: 6,
        color: estShabbat ? NUIT : TAUPE,
      });
    } else {
      const t1 = info.frAbbr;
      page.drawText(t1, {
        x: cx + pas / 2 - largeurTexte(ctx.sansGras, 7.5, t1) / 2,
        y: y + hauteur - 9,
        font: ctx.sansGras,
        size: 7.5,
        color: estShabbat ? NUIT : ENCRE,
      });
      const t2 = info.translit;
      page.drawText(t2, {
        x: cx + pas / 2 - largeurTexte(ctx.sans, 6, t2) / 2,
        y: y + 3,
        font: ctx.sans,
        size: 6,
        color: estShabbat ? assombrir(OR, 0.15) : TAUPE,
      });
    }
    if (c > 0) {
      page.drawLine({
        start: { x: cx, y },
        end: { x: cx, y: y + hauteur },
        thickness: 0.4,
        color: eclaircir(TAUPE, 0.5),
      });
    }
  }
}

function pageMois(
  ctx: Ctx,
  jours: JourBiblique[],
  fetes: OccurrenceFete[],
  mois: number,
  maintenant: Date
): void {
  const page = ctx.doc.addPage(A4);
  const infoMois = STRUCTURE_MOIS[mois - 1];
  const joursMois = jours.filter((j) => j.mois === mois);
  const fetesMois = fetes.filter((f) => f.fete.mois === mois);
  const feteParJour = indexFetesParJour(fetes, jours);

  const trimestre = Math.ceil(mois / 3);
  const saison = SAISONS_TRIMESTRES[trimestre - 1];

  enTeteBandeau(
    ctx,
    page,
    infoMois.nom,
    `Mois ${mois} · Trimestre ${trimestre} · ${saison.saison} · ${infoMois.jours} jours`,
    80
  );

  // Correspondance grégorienne
  const premier = joursMois[0];
  const dernier = joursMois[joursMois.length - 1];
  const correspondance = `Correspondance grégorienne : ${formatLong(premier.dateGregorienne)} — ${formatLong(dernier.dateGregorienne)}`;
  page.drawText(correspondance, {
    x: MARGE,
    y: A4[1] - 100,
    font: ctx.sans,
    size: 9,
    color: TAUPE,
  });

  // ── Grille du mois (gauche) ────────────────────────────────────────────
  const grilleX = MARGE;
  const grilleY = A4[1] - 124; // bas de la zone en-têtes colonnes
  const grilleW = 365;
  const headerH = 22;
  const lignesGrille = 6;
  const caseH = 76;
  const pas = grilleW / 7;

  enTeteColonnes(ctx, page, grilleX, grilleY, grilleW, headerH, false);

  const decalage = joursMois[0].jourDeSemaine - 1;
  const aujourdhuiStr = maintenant.toDateString();

  for (let i = 0; i < joursMois.length; i++) {
    const jour = joursMois[i];
    const pos = decalage + i;
    const col = pos % 7;
    const ligne = Math.floor(pos / 7);
    const x = grilleX + col * pas;
    const y = grilleY - (ligne + 1) * caseH;
    const fete = feteParJour.get(jour.jourDeAnnee);
    const estShabbat = jour.estShabbat;
    const estAujourdhui = jour.dateGregorienne.toDateString() === aujourdhuiStr;

    // Fond
    if (fete) {
      page.drawRectangle({
        x, y, width: pas, height: caseH,
        color: eclaircir(hexToRgb(fete.fete.couleur), 0.72),
        borderColor: hexToRgb(fete.fete.couleur),
        borderWidth: 1,
      });
    } else if (estShabbat) {
      page.drawRectangle({
        x, y, width: pas, height: caseH,
        color: eclaircir(NUIT, 0.93),
        borderColor: eclaircir(OR, 0.35),
        borderWidth: 0.8,
      });
    } else {
      page.drawRectangle({
        x, y, width: pas, height: caseH,
        color: CREME,
        borderColor: eclaircir(TAUPE, 0.55),
        borderWidth: 0.5,
      });
    }

    // Cadre « aujourd'hui »
    if (estAujourdhui) {
      page.drawRectangle({
        x: x + 1.5, y: y + 1.5, width: pas - 3, height: caseH - 3,
        borderColor: OR,
        borderWidth: 1.8,
      });
    }

    // Jour biblique + date grégorienne
    page.drawText(String(jour.jourDuMois), {
      x: x + 5,
      y: y + caseH - 14,
      font: estShabbat || fete ? ctx.sansGras : ctx.sans,
      size: 13,
      color: fete ? assombrir(hexToRgb(fete.fete.couleur), 0.35) : estShabbat ? ENCRE : ENCRE,
    });
    const dGre = formatCourt(jour.dateGregorienne);
    page.drawText(dGre, {
      x: x + pas - largeurTexte(ctx.sans, 6.2, dGre) - 5,
      y: y + caseH - 12,
      font: ctx.sans,
      size: 6.2,
      color: TAUPE,
    });

    // Nom de fête (2 lignes max, centré bas)
    if (fete) {
      const lignes = couperTexte(ctx.sans, 5.8, fete.fete.nomFr, pas - 10).slice(0, 2);
      lignes.forEach((l, li) => {
        page.drawText(l, {
          x: x + pas / 2 - largeurTexte(ctx.sans, 5.8, l) / 2,
          y: y + 26 - li * 7,
          font: ctx.sans,
          size: 5.8,
          color: assombrir(hexToRgb(fete.fete.couleur), 0.3),
        });
      });
    }
  }

  // ── Panneau des fêtes (droite) ─────────────────────────────────────────
  const panneauX = MARGE + grilleW + 16;
  const panneauW = A4[0] - MARGE - panneauX;
  let py = grilleY - 6;

  page.drawText("Fêtes du mois", {
    x: panneauX,
    y: py,
    font: ctx.serif,
    size: 12,
    color: ENCRE,
  });
  page.drawLine({
    start: { x: panneauX, y: py - 5 },
    end: { x: panneauX + panneauW, y: py - 5 },
    thickness: 1,
    color: OR,
  });
  py -= 24;

  if (fetesMois.length === 0) {
    page.drawText("Aucune fête de l'Éternel ce mois-ci.", {
      x: panneauX,
      y: py,
      font: ctx.sans,
      size: 8,
      color: TAUPE,
    });
    py -= 14;
  } else {
    for (const occ of fetesMois) {
      const couleur = hexToRgb(occ.fete.couleur);
      page.drawCircle({ x: panneauX + 3, y: py + 3, size: 3, color: couleur });
      // Nom de fête sur 1-2 lignes (les noms longs comme « Pains sans
      // levain — 1er jour » ne sont plus tronqués)
      const lignesNom = couperTexte(ctx.sansGras, 8.5, occ.fete.nomFr, panneauW - 12);
      lignesNom.slice(0, 2).forEach((l, li) => {
        page.drawText(l, {
          x: panneauX + 11,
          y: py - li * 10,
          font: ctx.sansGras,
          size: 8.5,
          color: ENCRE,
        });
      });
      py -= (lignesNom.length > 1 ? 2 : 1) * 10 + 1;
      if (occ.fete.nomHebrew) {
        page.drawText(inverserHebreu(occ.fete.nomHebrew), {
          x: panneauX + 11,
          y: py,
          font: ctx.sans,
          size: 8,
          color: assombrir(couleur, 0.15),
        });
        py -= 11;
      }
      const dateFete = new Date(occ.dateGregorienne);
      const ligneDate = `${formatCourt(dateFete)} · ${JOURS_SEMAINE_HEBREU[occ.jourDeSemaine - 1]?.fr ?? ""}`;
      page.drawText(ligneDate, {
        x: panneauX + 11,
        y: py,
        font: ctx.sans,
        size: 7.5,
        color: TAUPE,
      });
      py -= 10;
      page.drawText(tronquer(ctx.sans, 6.5, occ.fete.referenceEcritures, panneauW - 12), {
        x: panneauX + 11,
        y: py,
        font: ctx.sans,
        size: 6.5,
        color: assombrir(OR, 0.15),
      });
      py -= 18;
    }
  }

  // Encadré « La semaine hébraïque » en bas du panneau
  const semaineY = Math.min(py - 14, grilleY - 6 - 0);
  const boxH = 7 * 12 + 34;
  page.drawRectangle({
    x: panneauX,
    y: semaineY - boxH,
    width: panneauW,
    height: boxH,
    color: eclaircir(OR, 0.88),
    borderColor: eclaircir(OR, 0.4),
    borderWidth: 0.7,
  });
  page.drawText("LA SEMAINE HÉBRAÏQUE", {
    x: panneauX + 8,
    y: semaineY - 16,
    font: ctx.sansGras,
    size: 7,
    color: assombrir(OR, 0.25),
  });
  for (let d = 0; d < 7; d++) {
    const info = JOURS_SEMAINE_HEBREU[d];
    const ly = semaineY - 32 - d * 12;
    page.drawText(info.translit, {
      x: panneauX + 8,
      y: ly,
      font: ctx.sans,
      size: 6.8,
      color: ENCRE,
    });
    page.drawText(info.frAbbr, {
      x: panneauX + 52,
      y: ly,
      font: ctx.sans,
      size: 6.8,
      color: TAUPE,
    });
    page.drawText(inverserHebreu(info.hebreu), {
      x: panneauX + panneauW - 8 - largeurTexte(ctx.sans, 7, inverserHebreu(info.hebreu)),
      y: ly,
      font: ctx.sans,
      size: 7,
      color: info.numero === 7 ? assombrir(OR, 0.2) : TAUPE,
    });
  }

  // Légende sous la grille
  const legendeY = grilleY - lignesGrille * caseH - 14;
  let lx = MARGE;
  const items: Array<[string, RGB]> = [
    ["Fête de l'Éternel", OR],
    ["Shabbat hebdomadaire (samedi)", eclaircir(NUIT, 0.55)],
    ["Cadre doré : jour en cours", assombrir(OR, 0.1)],
  ];
  for (const [texte, couleur] of items) {
    page.drawRectangle({ x: lx, y: legendeY - 1, width: 7, height: 7, color: couleur });
    page.drawText(texte, {
      x: lx + 11,
      y: legendeY,
      font: ctx.sans,
      size: 7,
      color: TAUPE,
    });
    lx += 11 + largeurTexte(ctx.sans, 7, texte) + 18;
  }

  piedDePage(ctx, page, `${infoMois.nom} · ${ctx.libelle}`);
}

// ═══ MODE TRIMESTRE : une planche par trimestre ══════════════════════════

function pageTrimestre(
  ctx: Ctx,
  jours: JourBiblique[],
  fetes: OccurrenceFete[],
  trimestre: number,
  maintenant: Date
): void {
  const page = ctx.doc.addPage(A4);
  const saison = SAISONS_TRIMESTRES[trimestre - 1];
  const moisTrim = [trimestre * 3 - 2, trimestre * 3 - 1, trimestre * 3];
  const feteParJour = indexFetesParJour(fetes, jours);
  const aujourdhuiStr = maintenant.toDateString();

  enTeteBandeau(
    ctx,
    page,
    saison.nom,
    `91 jours · 13 semaines · Mois ${moisTrim.join(", ")} · ${saison.saison}`,
    80
  );

  // ── 3 mini-mois côte à côte ────────────────────────────────────────────
  const blocW = 165;
  const gap = 10;
  const topY = A4[1] - 108;
  const headerH = 14;
  const caseH = 26;
  const pas = blocW / 7;

  for (let m = 0; m < 3; m++) {
    const numMois = moisTrim[m];
    const infoMois = STRUCTURE_MOIS[numMois - 1];
    const joursMois = jours.filter((j) => j.mois === numMois);
    const bx = MARGE + m * (blocW + gap);

    // Titre du mois
    page.drawText(infoMois.nom, {
      x: bx + blocW / 2 - largeurTexte(ctx.serif, 13, infoMois.nom) / 2,
      y: topY,
      font: ctx.serif,
      size: 13,
      color: ENCRE,
    });
    const sous = `${infoMois.jours} jours · Mois ${numMois}`;
    page.drawText(sous, {
      x: bx + blocW / 2 - largeurTexte(ctx.sans, 6.5, sous) / 2,
      y: topY - 10,
      font: ctx.sans,
      size: 6.5,
      color: TAUPE,
    });

    const headerY = topY - 26;
    enTeteColonnes(ctx, page, bx, headerY, blocW, headerH, true);

    const decalage = joursMois[0].jourDeSemaine - 1;
    for (let i = 0; i < joursMois.length; i++) {
      const jour = joursMois[i];
      const pos = decalage + i;
      const col = pos % 7;
      const ligne = Math.floor(pos / 7);
      const x = bx + col * pas;
      const y = headerY - (ligne + 1) * caseH;
      const fete = feteParJour.get(jour.jourDeAnnee);
      const estAujourdhui = jour.dateGregorienne.toDateString() === aujourdhuiStr;

      if (fete) {
        page.drawRectangle({
          x, y, width: pas, height: caseH,
          color: eclaircir(hexToRgb(fete.fete.couleur), 0.62),
          borderColor: hexToRgb(fete.fete.couleur),
          borderWidth: 0.7,
        });
      } else if (jour.estShabbat) {
        page.drawRectangle({
          x, y, width: pas, height: caseH,
          color: eclaircir(NUIT, 0.9),
          borderColor: eclaircir(OR, 0.4),
          borderWidth: 0.5,
        });
      } else {
        page.drawRectangle({
          x, y, width: pas, height: caseH,
          color: CREME,
          borderColor: eclaircir(TAUPE, 0.6),
          borderWidth: 0.4,
        });
      }
      if (estAujourdhui) {
        page.drawRectangle({
          x: x + 1.2, y: y + 1.2, width: pas - 2.4, height: caseH - 2.4,
          borderColor: OR,
          borderWidth: 1.4,
        });
      }

      page.drawText(String(jour.jourDuMois), {
        x: x + 4,
        y: y + caseH - 9,
        font: fete || jour.estShabbat ? ctx.sansGras : ctx.sans,
        size: 7.5,
        color: fete ? assombrir(hexToRgb(fete.fete.couleur), 0.35) : ENCRE,
      });
      const dGre = formatCourt(jour.dateGregorienne);
      page.drawText(dGre, {
        x: x + pas - largeurTexte(ctx.sans, 5, dGre) - 3,
        y: y + caseH - 9,
        font: ctx.sans,
        size: 5,
        color: TAUPE,
      });
    }
  }

  // ── Tableau des fêtes du trimestre ─════════════════════════════════════
  const fetesTrim = fetes.filter((f) => moisTrim.includes(f.fete.mois));
  let ty = topY - 26 - 14 - 6 * caseH - 26;

  page.drawText(`Les fêtes du trimestre — ${saison.saison}`, {
    x: MARGE,
    y: ty,
    font: ctx.serif,
    size: 13,
    color: ENCRE,
  });
  page.drawLine({
    start: { x: MARGE, y: ty - 5 },
    end: { x: A4[0] - MARGE, y: ty - 5 },
    thickness: 1,
    color: OR,
  });
  ty -= 16;

  if (fetesTrim.length === 0) {
    page.drawText("Aucune fête de l'Éternel ce trimestre.", {
      x: MARGE,
      y: ty,
      font: ctx.sans,
      size: 8.5,
      color: TAUPE,
    });
  } else {
    // En-têtes de colonnes
    const cols: Array<[string, number]> = [
      ["Fête", 150],
      ["Hébreu", 70],
      ["Date biblique", 85],
      ["Date grégorienne", 95],
      ["Jour", 45],
      ["Référence", 70],
    ];
    let cx = MARGE;
    for (const [titre, w] of cols) {
      page.drawText(titre.toUpperCase(), {
        x: cx,
        y: ty,
        font: ctx.sansGras,
        size: 6.5,
        color: TAUPE,
      });
      cx += w;
    }
    ty -= 6;
    page.drawLine({
      start: { x: MARGE, y: ty },
      end: { x: A4[0] - MARGE, y: ty },
      thickness: 0.5,
      color: eclaircir(TAUPE, 0.5),
    });
    ty -= 16;

    for (const occ of fetesTrim) {
      const couleur = hexToRgb(occ.fete.couleur);
      const dGre = new Date(occ.dateGregorienne);
      const dateBib = `${occ.fete.jourDuMois} ${STRUCTURE_MOIS[occ.fete.mois - 1].nom}`;
      cx = MARGE;
      // Pastille + nom
      page.drawCircle({ x: cx + 3, y: ty + 3, size: 3, color: couleur });
      page.drawText(tronquer(ctx.sansGras, 8.5, occ.fete.nomFr, cols[0][1] - 14), {
        x: cx + 10,
        y: ty,
        font: ctx.sansGras,
        size: 8.5,
        color: ENCRE,
      });
      cx += cols[0][1];
      if (occ.fete.nomHebrew) {
        page.drawText(inverserHebreu(occ.fete.nomHebrew), {
          x: cx,
          y: ty,
          font: ctx.sans,
          size: 8,
          color: assombrir(couleur, 0.15),
        });
      }
      cx += cols[1][1];
      page.drawText(dateBib, {
        x: cx,
        y: ty,
        font: ctx.sans,
        size: 8,
        color: ENCRE,
      });
      cx += cols[2][1];
      page.drawText(formatLong(dGre), {
        x: cx,
        y: ty,
        font: ctx.sans,
        size: 8,
        color: TAUPE,
      });
      cx += cols[3][1];
      page.drawText(nomJourAbr(occ.jourDeSemaine), {
        x: cx,
        y: ty,
        font: ctx.sans,
        size: 8,
        color: ENCRE,
      });
      cx += cols[4][1];
      page.drawText(tronquer(ctx.sans, 6.5, occ.fete.referenceEcritures, cols[5][1] - 4), {
        x: cx,
        y: ty,
        font: ctx.sans,
        size: 6.5,
        color: assombrir(OR, 0.15),
      });
      ty -= 17;
    }
  }

  // Légende
  const legendeY2 = 62;
  page.drawText("Case dorée teintée : fête de l'Éternel (Lévitique 23) · Case grise : Shabbat hebdomadaire · Cadre or : jour en cours", {
    x: MARGE,
    y: legendeY2,
    font: ctx.sans,
    size: 6.5,
    color: TAUPE,
  });

  piedDePage(ctx, page, `Trimestre ${trimestre} · ${ctx.libelle}`);
}

// ═══ MODE ANNÉE : récapitulatif + fêtes ══════════════════════════════════

function pageAnneeRecap(
  ctx: Ctx,
  jours: JourBiblique[],
  fetes: OccurrenceFete[],
  maintenant: Date
): void {
  const page = ctx.doc.addPage(A4);
  const feteParJour = indexFetesParJour(fetes, jours);
  const aujourdhuiStr = maintenant.toDateString();

  enTeteBandeau(
    ctx,
    page,
    `Année biblique ${ctx.libelle}`,
    "12 mois · 364 jours · 52 semaines · 4 trimestres de 91 jours",
    74
  );

  const blocW = 165;
  const gap = 10;
  const caseH = 15.5;
  const pas = blocW / 7;
  let topY = A4[1] - 96;

  for (let tri = 1; tri <= 4; tri++) {
    const saison = SAISONS_TRIMESTRES[tri - 1];
    page.drawText(saison.nom.toUpperCase(), {
      x: MARGE,
      y: topY,
      font: ctx.sansGras,
      size: 8,
      color: assombrir(OR, 0.15),
    });
    page.drawLine({
      start: { x: MARGE + largeurTexte(ctx.sansGras, 8, saison.nom.toUpperCase()) + 10, y: topY + 3 },
      end: { x: A4[0] - MARGE, y: topY + 3 },
      thickness: 0.5,
      color: eclaircir(OR, 0.5),
    });
    topY -= 12;

    for (let m = 0; m < 3; m++) {
      const numMois = (tri - 1) * 3 + m + 1;
      const infoMois = STRUCTURE_MOIS[numMois - 1];
      const joursMois = jours.filter((j) => j.mois === numMois);
      const bx = MARGE + m * (blocW + gap);

      page.drawText(infoMois.nom, {
        x: bx + 2,
        y: topY,
        font: ctx.serif,
        size: 10.5,
        color: ENCRE,
      });
      const nbJ = `${infoMois.jours} j.`;
      page.drawText(nbJ, {
        x: bx + blocW - largeurTexte(ctx.sans, 6, nbJ),
        y: topY + 1,
        font: ctx.sans,
        size: 6,
        color: TAUPE,
      });

      const headerY = topY - 13;
      enTeteColonnes(ctx, page, bx, headerY, blocW, 10, true);

      const decalage = joursMois[0].jourDeSemaine - 1;
      for (let i = 0; i < joursMois.length; i++) {
        const jour = joursMois[i];
        const pos = decalage + i;
        const col = pos % 7;
        const ligne = Math.floor(pos / 7);
        const x = bx + col * pas;
        const y = headerY - (ligne + 1) * caseH;
        const fete = feteParJour.get(jour.jourDeAnnee);
        const estAujourdhui = jour.dateGregorienne.toDateString() === aujourdhuiStr;

        if (fete) {
          page.drawRectangle({
            x, y, width: pas, height: caseH,
            color: eclaircir(hexToRgb(fete.fete.couleur), 0.55),
            borderColor: hexToRgb(fete.fete.couleur),
            borderWidth: 0.5,
          });
        } else if (jour.estShabbat) {
          page.drawRectangle({
            x, y, width: pas, height: caseH,
            color: eclaircir(NUIT, 0.86),
          });
        } else {
          page.drawRectangle({
            x, y, width: pas, height: caseH,
            color: CREME,
            borderColor: eclaircir(TAUPE, 0.65),
            borderWidth: 0.35,
          });
        }
        if (estAujourdhui) {
          page.drawRectangle({
            x: x + 1, y: y + 1, width: pas - 2, height: caseH - 2,
            borderColor: OR,
            borderWidth: 1.2,
          });
        }
        const t = String(jour.jourDuMois);
        page.drawText(t, {
          x: x + pas / 2 - largeurTexte(ctx.sans, 6.5, t) / 2,
          y: y + caseH / 2 - 2.4,
          font: fete ? ctx.sansGras : ctx.sans,
          size: 6.5,
          color: fete ? assombrir(hexToRgb(fete.fete.couleur), 0.35) : ENCRE,
        });
      }
    }
    topY -= 13 + 10 + 6 * caseH + 14;
  }

  // Légende bas de page
  page.drawText("Case dorée : fête de l'Éternel (Lévitique 23) · Case grise : Shabbat (samedi) · Cadre or : jour en cours · Chaque trimestre reproduit la même structure de semaine", {
    x: MARGE,
    y: 56,
    font: ctx.sans,
    size: 6.5,
    color: TAUPE,
  });

  piedDePage(ctx, page, `Vue d'ensemble · ${ctx.libelle}`);
}

function pageAnneeFetes(ctx: Ctx, jours: JourBiblique[], fetes: OccurrenceFete[]): void {
  const page = ctx.doc.addPage(A4);

  enTeteBandeau(
    ctx,
    page,
    "Les fêtes de l'Éternel",
    "Lévitique 23 · dates fixes sur le calendrier de 364 jours",
    74
  );

  let ty = A4[1] - 96;
  const cols: Array<[string, number]> = [
    ["Fête", 150],
    ["Hébreu", 70],
    ["Date biblique", 85],
    ["Date grégorienne", 100],
    ["Jour", 50],
    ["Référence", 60],
  ];

  for (const occ of fetes) {
    const couleur = hexToRgb(occ.fete.couleur);
    const dGre = new Date(occ.dateGregorienne);
    const dateBib = `${occ.fete.jourDuMois} ${STRUCTURE_MOIS[occ.fete.mois - 1].nom}`;

    // Ligne de fond alternée
    page.drawRectangle({
      x: MARGE - 6,
      y: ty - 8,
      width: A4[0] - 2 * MARGE + 12,
      height: 38,
      color: eclaircir(OR, 0.92),
    });
    // Barrette de couleur
    page.drawRectangle({
      x: MARGE - 6,
      y: ty - 8,
      width: 3.2,
      height: 38,
      color: couleur,
    });

    page.drawText(occ.fete.nomFr, {
      x: MARGE + 4,
      y: ty + 12,
      font: ctx.sansGras,
      size: 9.5,
      color: ENCRE,
    });
    // Description tronquée sur 1 ligne
    page.drawText(tronquer(ctx.sans, 6.5, occ.fete.description, cols[0][1] - 8), {
      x: MARGE + 4,
      y: ty + 1,
      font: ctx.sans,
      size: 6.5,
      color: TAUPE,
    });

    let cx = MARGE + cols[0][1];
    if (occ.fete.nomHebrew) {
      page.drawText(inverserHebreu(occ.fete.nomHebrew), {
        x: cx,
        y: ty + 6,
        font: ctx.sans,
        size: 9,
        color: assombrir(couleur, 0.15),
      });
    }
    cx += cols[1][1];
    page.drawText(dateBib, {
      x: cx,
      y: ty + 6,
      font: ctx.sans,
      size: 8.5,
      color: ENCRE,
    });
    cx += cols[2][1];
    page.drawText(formatLong(dGre), {
      x: cx,
      y: ty + 6,
      font: ctx.sans,
      size: 8.5,
      color: TAUPE,
    });
    cx += cols[3][1];
    const jourNom = JOURS_SEMAINE_HEBREU[occ.jourDeSemaine - 1]?.fr ?? "";
    page.drawText(jourNom, {
      x: cx,
      y: ty + 6,
      font: ctx.sansGras,
      size: 8,
      color: assombrir(OR, 0.2),
    });
    cx += cols[4][1];
    page.drawText(tronquer(ctx.sans, 7, occ.fete.referenceEcritures, cols[5][1] - 4), {
      x: cx,
      y: ty + 6,
      font: ctx.sans,
      size: 7,
      color: assombrir(OR, 0.15),
    });

    ty -= 48;
  }

  // Shabbat hebdomadaire (hors liste d'occurrences)
  page.drawRectangle({
    x: MARGE - 6,
    y: ty - 8,
    width: A4[0] - 2 * MARGE + 12,
    height: 38,
    color: eclaircir(NUIT, 0.9),
  });
  page.drawText("Shabbat hebdomadaire", {
    x: MARGE + 4,
    y: ty + 12,
    font: ctx.sansGras,
    size: 9.5,
    color: ENCRE,
  });
  page.drawText("Chaque septième jour — sainte convocation perpétuelle", {
    x: MARGE + 4,
    y: ty + 1,
    font: ctx.sans,
    size: 6.5,
    color: TAUPE,
  });
  page.drawText(inverserHebreu("שבת"), {
    x: MARGE + cols[0][1],
    y: ty + 6,
    font: ctx.sans,
    size: 9,
    color: assombrir(OR, 0.2),
  });
  page.drawText("Tous les mois", {
    x: MARGE + cols[0][1] + cols[1][1] + cols[2][1],
    y: ty + 6,
    font: ctx.sans,
    size: 8.5,
    color: TAUPE,
  });
  page.drawText("Samedi", {
    x: MARGE + cols[0][1] + cols[1][1] + cols[2][1] + cols[3][1],
    y: ty + 6,
    font: ctx.sansGras,
    size: 8,
    color: assombrir(OR, 0.2),
  });
  page.drawText("Genèse 2:2-3", {
    x: MARGE + cols[0][1] + cols[1][1] + cols[2][1] + cols[3][1] + cols[4][1],
    y: ty + 6,
    font: ctx.sans,
    size: 7,
    color: assombrir(OR, 0.15),
  });

  piedDePage(ctx, page, `Fêtes de l'Éternel · ${ctx.libelle}`);
}


// ═══ Fonction principale ═════════════════════════════════════════════════

/**
 * Génère le document PDF du calendrier biblique.
 *
 * @param anneeBiblique Année civile de début (ex: 2026 pour 2026-2027)
 * @param mode          « mois » | « trimestre » | « annee »
 * @param maintenant    Date de référence (marqueur du jour en cours)
 * @returns Les octets du PDF prêt à télécharger.
 */
export async function genererPdfCalendrier(
  anneeBiblique: number,
  mode: ModePdfCalendrier,
  maintenant: Date = new Date()
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Calendrier biblique ${libelleAnneeBiblique(anneeBiblique)} — Mouvement Christ Libère`);
  doc.setAuthor("Mouvement Christ Libère");
  doc.setSubject("Calendrier de l'Éternel · 364 jours · Fêtes de Lévitique 23");
  doc.setProducer("mouvement-christ-libere.vercel.app");

  const sans = await doc.embedFont(FONT_SANS_B64, { subset: true });
  const sansGras = await doc.embedFont(FONT_SANS_GRAS_B64, { subset: true });
  const serif = await doc.embedFont(FONT_SERIF_GRAS_B64, { subset: true });

  const anneeGeneree = genererAnnee(anneeBiblique);
  const fetes = calculerFetesPourAnnee(anneeBiblique, anneeGeneree.jours, maintenant);
  const libelle = libelleAnneeBiblique(anneeBiblique);

  const ctx: Ctx = {
    doc,
    sans,
    sansGras,
    serif,
    numPage: 0,
    nbPages: mode === "mois" ? 12 : mode === "trimestre" ? 4 : 2,
    libelle,
  };

  // Couverture (hors numérotation)
  pageCouverture(ctx, anneeBiblique, mode, anneeGeneree.debut, anneeGeneree.fin, fetes.length);

  // Pages de contenu selon le mode
  if (mode === "mois") {
    for (let mois = 1; mois <= 12; mois++) {
      ctx.numPage = mois;
      pageMois(ctx, anneeGeneree.jours, fetes, mois, maintenant);
    }
  } else if (mode === "trimestre") {
    for (let tri = 1; tri <= 4; tri++) {
      ctx.numPage = tri;
      pageTrimestre(ctx, anneeGeneree.jours, fetes, tri, maintenant);
    }
  } else {
    ctx.numPage = 1;
    pageAnneeRecap(ctx, anneeGeneree.jours, fetes, maintenant);
    ctx.numPage = 2;
    pageAnneeFetes(ctx, anneeGeneree.jours, fetes);
  }

  return doc.save();
}
