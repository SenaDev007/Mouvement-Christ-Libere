/**
 * ⭐ V3.66 — Socle PDF partagé des espaces Secrétariat & Trésorerie.
 * ============================================================================
 *
 * Documents « registre » (demandes de rencontre, annonces) et « rapport
 * financier » générés côté serveur avec pdf-lib — même famille de design
 * que le PDF du calendrier biblique V3.10 :
 *   · nuit #000000, or #C9A227, crème #F0E9DE, taupe #8A857C ;
 *   · titres serif (DejaVu Serif Bold), corps sans (DejaVu Sans) ;
 *   · polices sous-ensembles DÉDIÉES incluant le symbole € (U+20AC) —
 *     les polices du calendrier ne le contiennent pas ;
 *   · logo officiel embarqué en base64.
 *
 * ⚠️ FORMATAGE DES MONTANTS : Intl.NumberFormat("fr-FR") produit des
 * espaces fines insécables U+202F (absentes du sous-ensemble DejaVu) :
 * les montants sont donc formatés MANUELLEMENT avec U+00A0 (couvert).
 */

import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  rgb,
  type RGB,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  FONT_STAFF_SANS_B64,
  FONT_STAFF_SANS_GRAS_B64,
  FONT_STAFF_SERIF_GRAS_B64,
} from "./fonts";
import { LOGO_CHRIST_LIBERE_B64 } from "@/lib/calendrier/pdf/logo";

// ═══ Palette V3.68 — Noir / Or / Feu (alignement logo) ═══════════════════

export const NUIT = rgb(0, 0, 0); // #000000 — noir pur
export const NUIT_PROFONDE = rgb(0, 0, 0); // #000000 — noir pur
export const OR = rgb(0.788, 0.635, 0.153); // #C9A227
export const FEU = rgb(1, 0.478, 0.102); // #FF7A1A — accents énergie
export const CREME = rgb(0.941, 0.914, 0.871); // #F0E9DE — blanc cassé chaud
export const ENCRE = rgb(0, 0, 0); // #000000 — texte noir
export const TAUPE = rgb(0.541, 0.522, 0.486); // #8A857C — gris chaud
export const BLANC = rgb(1, 1, 1);
export const VERT = rgb(0.357, 0.439, 0.322); // #5B7052 — recettes
export const ROUGE = rgb(0.702, 0.271, 0.180); // #B3452E — dépenses

export const A4: [number, number] = [595.28, 841.89];
export const MARGE = 40;

// ═══ Contexte de document ════════════════════════════════════════════════

export interface ContextePdf {
  doc: PDFDocument;
  page: PDFPage;
  sans: PDFFont;
  sansGras: PDFFont;
  serifGras: PDFFont;
  logo: PDFImage;
  y: number; // curseur vertical courant (descendant)
  numeroPage: number;
  /** Nom de l'espace émetteur (« Secrétariat » / « Trésorerie »). */
  espace: string;
  /** Titre du document (bandeau de couverture). */
  titreDocument: string;
  /** Sous-titre (période, devise…). */
  sousTitre: string;
  /** Date/heure de génération affichée en pied de page. */
  genereLe: Date;
}

/** Crée le document + embarque polices et logo. */
export async function creerDocument(opts: {
  espace: string;
  titreDocument: string;
  sousTitre: string;
}): Promise<ContextePdf> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const sans = await doc.embedFont(
    Buffer.from(FONT_STAFF_SANS_B64, "base64")
  );
  const sansGras = await doc.embedFont(
    Buffer.from(FONT_STAFF_SANS_GRAS_B64, "base64")
  );
  const serifGras = await doc.embedFont(
    Buffer.from(FONT_STAFF_SERIF_GRAS_B64, "base64")
  );
  const logo = await doc.embedPng(
    Buffer.from(LOGO_CHRIST_LIBERE_B64, "base64")
  );

  const page = doc.addPage(A4);

  return {
    doc,
    page,
    sans,
    sansGras,
    serifGras,
    logo,
    y: A4[1] - MARGE,
    numeroPage: 1,
    espace: opts.espace,
    titreDocument: opts.titreDocument,
    sousTitre: opts.sousTitre,
    genereLe: new Date(),
  };
}

// ═══ Helpers texte ═══════════════════════════════════════════════════════

/** Largeur d'un texte dans une police/taille (0 si vide). */
export function largeurTexte(f: PDFFont, taille: number, texte: string): number {
  try {
    return f.widthOfTextAtSize(texte, taille);
  } catch {
    return 0;
  }
}

/** Coupe un texte en lignes tenant dans une largeur donnée. */
export function couperTexte(
  f: PDFFont,
  taille: number,
  texte: string,
  largeurMax: number
): string[] {
  const mots = (texte || "").split(/\s+/).filter(Boolean);
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
export function tronquer(
  f: PDFFont,
  taille: number,
  texte: string,
  largeurMax: number
): string {
  if (largeurTexte(f, taille, texte) <= largeurMax) return texte;
  let t = texte;
  while (t.length > 1 && largeurTexte(f, taille, `${t}…`) > largeurMax) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

/** Dessine du texte et retourne la largeur consommée. */
export function dessinerTexte(
  ctx: ContextePdf,
  texte: string,
  x: number,
  y: number,
  opts: { taille?: number; gras?: boolean; serif?: boolean; couleur?: RGB } = {}
): number {
  const taille = opts.taille ?? 9;
  const f = opts.serif
    ? ctx.serifGras
    : opts.gras
      ? ctx.sansGras
      : ctx.sans;
  ctx.page.drawText(texte, {
    x,
    y,
    size: taille,
    font: f,
    color: opts.couleur ?? ENCRE,
  });
  return largeurTexte(f, taille, texte);
}

/**
 * Formate un montant SANS Intl (espaces fines U+202F non couvertes par le
 * sous-ensemble DejaVu) : regroupement par milliers avec U+00A0, virgule
 * décimale. XOF sans décimales.
 */
export function formaterMontantPdf(montant: number, devise: string): string {
  const sansDecimales = devise === "XOF";
  const abs = Math.abs(montant);
  const fixe = abs.toFixed(sansDecimales ? 0 : 2);
  const [partieEntiere, decimales] = fixe.split(".");
  // Groupement par milliers.
  const groupes: string[] = [];
  for (let i = partieEntiere.length; i > 0; i -= 3) {
    groupes.unshift(partieEntiere.slice(Math.max(0, i - 3), i));
  }
  let resultat = groupes.join("\u00A0");
  if (decimales) resultat += `,${decimales}`;
  return `${montant < 0 ? "−" : ""}${resultat}\u00A0${symboleDevise(devise)}`;
}

/** Symbole de devise pour les PDF. */
export function symboleDevise(devise: string): string {
  switch (devise) {
    case "EUR":
      return "€";
    case "XOF":
      return "F";
    case "USD":
      return "$";
    default:
      return devise;
  }
}

/** Date courte française « 12/09/2026 ». */
export function dateCourte(d: Date): string {
  const j = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${j}/${m}/${d.getFullYear()}`;
}

/** Date longue française « 12 septembre 2026 ». */
export function dateLongue(d: Date): string {
  const mois = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

// ═══ Structure des pages ═════════════════════════════════════════════════

/** Bandeau de COUVERTURE : fond nuit, logo, espace, titre, sous-titre. */
export function dessinerCouverture(ctx: ContextePdf): void {
  const { page } = ctx;
  const hauteurBandeau = 150;

  page.drawRectangle({
    x: 0,
    y: A4[1] - hauteurBandeau,
    width: A4[0],
    height: hauteurBandeau,
    color: NUIT,
  });
  // Filet or sous le bandeau.
  page.drawRectangle({
    x: 0,
    y: A4[1] - hauteurBandeau - 3,
    width: A4[0],
    height: 3,
    color: OR,
  });

  // Logo à gauche.
  const tailleLogo = 84;
  page.drawImage(ctx.logo, {
    x: MARGE,
    y: A4[1] - hauteurBandeau + (hauteurBandeau - tailleLogo) / 2,
    width: tailleLogo,
    height: tailleLogo,
  });

  const xTexte = MARGE + tailleLogo + 24;
  const largeurTexteDispo = A4[0] - xTexte - MARGE;

  // Espace émetteur.
  dessinerTexte(ctx, ctx.espace.toUpperCase(), xTexte, A4[1] - 52, {
    taille: 9,
    gras: true,
    couleur: OR,
  });

  // Titre du document (17 pt : « Rapport financier » comme « Registre des
  // demandes de rencontre » tiennent entiers dans la largeur disponible).
  const titre = tronquer(ctx.serifGras, 17, ctx.titreDocument, largeurTexteDispo);
  dessinerTexte(ctx, titre, xTexte, A4[1] - 82, {
    taille: 17,
    serif: true,
    couleur: BLANC,
  });

  // Sous-titre (période…).
  const sousTitre = tronquer(ctx.sans, 10, ctx.sousTitre, largeurTexteDispo);
  dessinerTexte(ctx, sousTitre, xTexte, A4[1] - 104, {
    taille: 10,
    couleur: rgb(0.87, 0.75, 0.33),
  });

  // « Mouvement Christ Libère ».
  dessinerTexte(ctx, "Mouvement Christ Libère", xTexte, A4[1] - 126, {
    taille: 8,
    couleur: rgb(0.75, 0.7, 0.85),
  });

  ctx.y = A4[1] - hauteurBandeau - 24;
}

/** Pied de page : filet, page courante, date de génération. */
export function dessinerPied(ctx: ContextePdf): void {
  const { page } = ctx;
  page.drawRectangle({
    x: MARGE,
    y: MARGE - 12,
    width: A4[0] - 2 * MARGE,
    height: 0.75,
    color: rgb(0.85, 0.82, 0.78),
  });
  dessinerTexte(
    ctx,
    `${ctx.espace} — Mouvement Christ Libère`,
    MARGE,
    MARGE - 24,
    { taille: 7, couleur: TAUPE }
  );
  dessinerTexte(
    ctx,
    `Généré le ${dateCourte(ctx.genereLe)} à ${ctx.genereLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — page ${ctx.numeroPage}`,
    A4[0] - MARGE - 220,
    MARGE - 24,
    { taille: 7, couleur: TAUPE }
  );
}

/** Nouvelle page avec réinitialisation du curseur. */
export function nouvellePage(ctx: ContextePdf): void {
  dessinerPied(ctx);
  ctx.page = ctx.doc.addPage(A4);
  ctx.numeroPage += 1;
  ctx.y = A4[1] - MARGE;
}

/** Vérifie la place restante ; change de page si nécessaire. */
export function assurerPlace(ctx: ContextePdf, hauteurRequise: number): void {
  if (ctx.y - hauteurRequise < MARGE + 20) {
    nouvellePage(ctx);
  }
}

// ═══ Tableaux ════════════════════════════════════════════════════════════

export interface ColonneTable {
  titre: string;
  largeur: number;
  alignement?: "gauche" | "droite";
}

/**
 * Dessine une ligne de tableau (fond zébré + cellules avec retour à la
 * ligne automatique). Retourne la hauteur consommée.
 */
export function dessinerLigneTable(
  ctx: ContextePdf,
  colonnes: ColonneTable[],
  cellules: string[],
  opts: {
    entete?: boolean;
    zebra?: boolean;
    gras?: boolean;
    couleurs?: (RGB | null)[];
    taille?: number;
    interligne?: number;
  } = {}
): number {
  const taille = opts.taille ?? 8;
  const interligne = opts.interligne ?? 10.5;

  // Calcule les lignes de chaque cellule.
  const lignesParCellule = cellules.map((texte, i) =>
    couperTexte(
      opts.entete ? ctx.sansGras : opts.gras ? ctx.sansGras : ctx.sans,
      taille,
      texte,
      colonnes[i].largeur - 8
    )
  );
  const nbLignes = Math.max(1, ...lignesParCellule.map((l) => l.length));
  const hauteurLigne = 6 + nbLignes * interligne;

  // Fond.
  if (opts.entete) {
    ctx.page.drawRectangle({
      x: MARGE,
      y: ctx.y - hauteurLigne,
      width: A4[0] - 2 * MARGE,
      height: hauteurLigne,
      color: NUIT,
    });
  } else if (opts.zebra) {
    ctx.page.drawRectangle({
      x: MARGE,
      y: ctx.y - hauteurLigne,
      width: A4[0] - 2 * MARGE,
      height: hauteurLigne,
      color: rgb(0.965, 0.95, 0.93),
    });
  }

  // Cellules.
  let x = MARGE;
  for (let i = 0; i < colonnes.length; i++) {
    const col = colonnes[i];
    const lignes = lignesParCellule[i] || [""];
    const f = opts.entete ? ctx.sansGras : opts.gras ? ctx.sansGras : ctx.sans;
    const couleur =
      opts.entete ? BLANC : opts.couleurs?.[i] ?? ENCRE;

    for (let l = 0; l < lignes.length; l++) {
      const texte = lignes[l];
      const largeur = largeurTexte(f, taille, texte);
      const xPos =
        col.alignement === "droite"
          ? x + col.largeur - 4 - largeur
          : x + 4;
      ctx.page.drawText(texte, {
        x: xPos,
        y: ctx.y - 6 - (l + 1) * interligne + 2,
        size: taille,
        font: f,
        color: couleur,
      });
    }
    x += col.largeur;
  }

  ctx.y -= hauteurLigne;
  return hauteurLigne;
}

/** Section titre (filet or + intitulé). */
export function dessinerTitreSection(
  ctx: ContextePdf,
  titre: string,
  couleur: RGB = OR
): void {
  assurerPlace(ctx, 36);
  ctx.page.drawRectangle({
    x: MARGE,
    y: ctx.y - 4,
    width: 3,
    height: 14,
    color: couleur,
  });
  dessinerTexte(ctx, titre, MARGE + 10, ctx.y - 1, {
    taille: 12,
    serif: true,
    couleur: NUIT_PROFONDE,
  });
  ctx.y -= 26;
}

/** Clé/valeur sur une ligne (libellé taupe, valeur encre). */
export function dessinerLigneInfo(
  ctx: ContextePdf,
  libelle: string,
  valeur: string,
  opts: { gras?: boolean; couleurValeur?: RGB; valeurDroite?: boolean } = {}
): void {
  assurerPlace(ctx, 16);
  const libelleTronque = tronquer(ctx.sans, 9, libelle, 180);
  dessinerTexte(ctx, libelleTronque, MARGE, ctx.y - 8, {
    taille: 9,
    couleur: TAUPE,
  });
  if (opts.valeurDroite) {
    const v = tronquer(
      opts.gras ? ctx.sansGras : ctx.sans,
      10,
      valeur,
      A4[0] - 2 * MARGE - 200
    );
    dessinerTexte(ctx, v, A4[0] - MARGE - largeurTexte(opts.gras ? ctx.sansGras : ctx.sans, 10, v), ctx.y - 8, {
      taille: 10,
      gras: opts.gras,
      couleur: opts.couleurValeur ?? ENCRE,
    });
  } else {
    dessinerTexte(ctx, tronquer(opts.gras ? ctx.sansGras : ctx.sans, 10, valeur, A4[0] - 2 * MARGE - 190), MARGE + 190, ctx.y - 8, {
      taille: 10,
      gras: opts.gras,
      couleur: opts.couleurValeur ?? ENCRE,
    });
  }
  ctx.y -= 15;
}

/** Termine le document (pied de la dernière page + sérialisation). */
export async function finaliserDocument(ctx: ContextePdf): Promise<Uint8Array> {
  dessinerPied(ctx);
  return ctx.doc.save();
}
