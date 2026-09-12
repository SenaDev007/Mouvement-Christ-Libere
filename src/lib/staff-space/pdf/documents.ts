/**
 * ⭐ V3.66 — Générateurs PDF des espaces Secrétariat & Trésorerie.
 * ============================================================================
 *
 *  ① genererRegistreDemandes  — registre des demandes de rencontre
 *     (période, filtre statut) : une fiche par demande (demandeur, contact,
 *     serviteur, objet, message, urgence, statut, transmission).
 *  ② genererRegistreAnnonces  — registre des annonces du ministère.
 *  ③ genererRapportFinancier   — rapport financier de la trésorerie :
 *     totaux, récapitulatif par catégorie, journal détaillé avec solde
 *     cumulé (un document PAR DEVISE — jamais de mélange de devises).
 *
 * Tous partagent le socle base.ts (couverture, tableaux, pieds de page).
 */

import {
  DEMANDE_STATUTS,
  DEMANDE_URGENCES,
  SERVITEURS_RENDEZ_VOUS,
  ANNONCE_CATEGORIES,
  RECETTE_CATEGORIES,
  DEPENSE_CATEGORIES,
} from "@/lib/staff-space/constants";
import {
  creerDocument,
  dessinerCouverture,
  dessinerTitreSection,
  dessinerLigneTable,
  dessinerLigneInfo,
  dessinerTexte,
  finaliserDocument,
  assurerPlace,
  dateCourte,
  dateLongue,
  formaterMontantPdf,
  MARGE,
  VERT,
  ROUGE,
  TAUPE,
  NUIT_PROFONDE,
  OR,
  type ContextePdf,
  type ColonneTable,
} from "./base";

// ═══════════════════════════════════════════════════════════════════════
// ① REGISTRE DES DEMANDES DE RENCONTRE
// ═══════════════════════════════════════════════════════════════════════

export interface DemandePdf {
  id: string;
  requesterName: string;
  contact: string;
  servantCode: string;
  subject: string;
  message: string;
  urgency: string;
  country: string | null;
  city: string | null;
  status: string;
  transmissionNote: string | null;
  transmittedAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
}

export async function genererRegistreDemandes(
  demandes: DemandePdf[],
  periode: { du: Date; au: Date; statut?: string }
): Promise<Uint8Array> {
  const ctx = await creerDocument({
    espace: "Secrétariat",
    titreDocument: "Registre des demandes de rencontre",
    sousTitre: `Période : ${dateCourte(periode.du)} → ${dateCourte(periode.au)}${
      periode.statut ? ` · Statut : ${DEMANDE_STATUTS[periode.statut as keyof typeof DEMANDE_STATUTS]?.libelle ?? periode.statut}` : " · Tous statuts"
    } · ${demandes.length} demande${demandes.length > 1 ? "s" : ""}`,
  });
  dessinerCouverture(ctx);

  if (demandes.length === 0) {
    dessinerTitreSection(ctx, "Aucune demande sur la période");
    dessinerTexte(
      ctx,
      "Aucune demande de rencontre n'a été enregistrée sur la période sélectionnée.",
      40,
      ctx.y,
      { taille: 10, couleur: TAUPE }
    );
    return finaliserDocument(ctx);
  }

  // ── Résumé ──
  dessinerTitreSection(ctx, "Résumé");
  const parStatut = Object.keys(DEMANDE_STATUTS).map((s) => ({
    statut: s,
    nombre: demandes.filter((d) => d.status === s).length,
  }));
  for (const { statut, nombre } of parStatut) {
    if (nombre > 0) {
      dessinerLigneInfo(ctx, DEMANDE_STATUTS[statut as keyof typeof DEMANDE_STATUTS].libelle, `${nombre}`, {
        valeurDroite: true,
        gras: true,
      });
    }
  }
  ctx.y -= 8;

  // ── Fiches détaillées ──
  dessinerTitreSection(ctx, "Détail des demandes");
  const colonnes: ColonneTable[] = [
    { titre: "Date", largeur: 52 },
    { titre: "Demandeur", largeur: 92 },
    { titre: "Contact", largeur: 88 },
    { titre: "Serviteur", largeur: 58 },
    { titre: "Objet", largeur: 185 },
    { titre: "Urgence", largeur: 38 },
  ];
  dessinerLigneTable(
    ctx,
    colonnes,
    colonnes.map((c) => c.titre),
    { entete: true }
  );

  demandes.forEach((d, i) => {
    // Ligne résumé.
    assurerPlace(ctx, 40);
    const urgence = DEMANDE_URGENCES[d.urgency as keyof typeof DEMANDE_URGENCES];
    dessinerLigneTable(
      ctx,
      colonnes,
      [
        dateCourte(d.createdAt),
        d.requesterName,
        d.contact,
        SERVITEURS_RENDEZ_VOUS[d.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS]?.libelle ?? d.servantCode,
        d.subject,
        urgence?.libelle ?? d.urgency,
      ],
      { zebra: i % 2 === 0, couleurs: [null, null, null, null, null, d.urgency === "urgente" ? ROUGE : null] }
    );

    // Bloc détails (message, statut, transmission).
    const lignesMessage = Math.min(
      Math.ceil(d.message.length / 90),
      6
    );
    assurerPlace(ctx, 30 + lignesMessage * 12);

    const infosStatut: string[] = [
      `Statut : ${DEMANDE_STATUTS[d.status as keyof typeof DEMANDE_STATUTS]?.libelle ?? d.status}`,
    ];
    if (d.transmittedAt) {
      infosStatut.push(`Transmise le ${dateCourte(d.transmittedAt)}`);
    }
    if (d.processedAt) {
      infosStatut.push(`Traitée le ${dateCourte(d.processedAt)}`);
    }
    dessinerTexte(ctx, infosStatut.join(" · "), MARGE + 4, ctx.y - 4, {
      taille: 7.5,
      gras: true,
      couleur: NUIT_PROFONDE,
    });
    ctx.y -= 14;

    // Localisation éventuelle.
    if (d.city || d.country) {
      dessinerTexte(
        ctx,
        `Localisation : ${[d.city, d.country].filter(Boolean).join(", ")}`,
        MARGE + 4,
        ctx.y,
        { taille: 7.5, couleur: TAUPE }
      );
      ctx.y -= 12;
    }

    // Message (extrait).
    const extrait = d.message.substring(0, 550);
    let reste = extrait;
    let ligne = 0;
    while (reste.length > 0 && ligne < 6) {
      const morceau = reste.substring(0, 92);
      reste = reste.substring(92);
      dessinerTexte(ctx, morceau, MARGE + 4, ctx.y, { taille: 7.5, couleur: TAUPE });
      ctx.y -= 11;
      ligne++;
    }

    // Note de transmission éventuelle.
    if (d.transmissionNote) {
      const note = `Note de transmission : ${d.transmissionNote}`.substring(0, 550);
      dessinerTexte(ctx, note, MARGE + 4, ctx.y, {
        taille: 7.5,
        couleur: OR,
      });
      ctx.y -= 11;
    }

    ctx.y -= 8;
  });

  return finaliserDocument(ctx);
}

// ═══════════════════════════════════════════════════════════════════════
// ② REGISTRE DES ANNONCES
// ═══════════════════════════════════════════════════════════════════════

export interface AnnoncePdf {
  id: string;
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
  publishedAt: Date | null;
  relayedToYeshua: boolean;
  createdAt: Date;
}

export async function genererRegistreAnnonces(
  annonces: AnnoncePdf[],
  periode: { du: Date; au: Date }
): Promise<Uint8Array> {
  const ctx = await creerDocument({
    espace: "Secrétariat",
    titreDocument: "Registre des annonces du ministère",
    sousTitre: `Période : ${dateCourte(periode.du)} → ${dateCourte(periode.au)} · ${annonces.length} annonce${annonces.length > 1 ? "s" : ""}`,
  });
  dessinerCouverture(ctx);

  if (annonces.length === 0) {
    dessinerTitreSection(ctx, "Aucune annonce sur la période");
    return finaliserDocument(ctx);
  }

  const colonnes: ColonneTable[] = [
    { titre: "Publiée le", largeur: 60 },
    { titre: "Catégorie", largeur: 60 },
    { titre: "Titre", largeur: 395 },
  ];
  dessinerLigneTable(ctx, colonnes, colonnes.map((c) => c.titre), { entete: true });

  annonces.forEach((a, i) => {
    assurerPlace(ctx, 60);
    dessinerLigneTable(
      ctx,
      colonnes,
      [
        a.publishedAt ? dateCourte(a.publishedAt) : "brouillon",
        ANNONCE_CATEGORIES[a.category as keyof typeof ANNONCE_CATEGORIES]?.libelle ?? a.category,
        a.title,
      ],
      { zebra: i % 2 === 0 }
    );

    // Contenu (extrait).
    const extrait = a.content.substring(0, 550);
    let reste = extrait;
    let ligne = 0;
    while (reste.length > 0 && ligne < 6) {
      const morceau = reste.substring(0, 100);
      reste = reste.substring(100);
      dessinerTexte(ctx, morceau, MARGE + 4, ctx.y, { taille: 7.5, couleur: TAUPE });
      ctx.y -= 11;
      ligne++;
    }
    if (a.relayedToYeshua) {
      dessinerTexte(ctx, "→ Relayée dans Yeshua Connect", MARGE + 4, ctx.y, {
        taille: 7.5,
        couleur: OR,
      });
      ctx.y -= 11;
    }
    ctx.y -= 8;
  });

  return finaliserDocument(ctx);
}

// ═══════════════════════════════════════════════════════════════════════
// ③ RAPPORT FINANCIER (par devise)
// ═══════════════════════════════════════════════════════════════════════

export interface TransactionPdf {
  id: string;
  type: string; // RECETTE | DEPENSE
  category: string;
  amount: number;
  currency: string;
  method: string | null;
  label: string;
  date: Date;
  reference: string | null;
  donorName: string | null;
  isAnonymous: boolean;
}

export async function genererRapportFinancier(
  transactions: TransactionPdf[],
  periode: { du: Date; au: Date },
  devise: string
): Promise<Uint8Array> {
  const ctx = await creerDocument({
    espace: "Trésorerie",
    titreDocument: "Rapport financier",
    sousTitre: `Période : ${dateLongue(periode.du)} → ${dateLongue(periode.au)} · Devise : ${devise}`,
  });
  dessinerCouverture(ctx);

  // Les transactions arrivent déjà triées par date croissante.
  const recettes = transactions.filter((t) => t.type === "RECETTE");
  const depenses = transactions.filter((t) => t.type === "DEPENSE");
  const totalRecettes = recettes.reduce((s, t) => s + t.amount, 0);
  const totalDepenses = depenses.reduce((s, t) => s + t.amount, 0);
  const solde = totalRecettes - totalDepenses;

  // ── Synthèse ──
  dessinerTitreSection(ctx, "Synthèse de la période");
  dessinerLigneInfo(ctx, "Total des recettes", formaterMontantPdf(totalRecettes, devise), {
    valeurDroite: true,
    gras: true,
    couleurValeur: VERT,
  });
  dessinerLigneInfo(ctx, "Total des dépenses", formaterMontantPdf(totalDepenses, devise), {
    valeurDroite: true,
    gras: true,
    couleurValeur: ROUGE,
  });
  dessinerLigneInfo(ctx, "SOLDE de la période", formaterMontantPdf(solde, devise), {
    valeurDroite: true,
    gras: true,
    couleurValeur: solde >= 0 ? VERT : ROUGE,
  });
  dessinerLigneInfo(ctx, "Nombre de mouvements", `${transactions.length}`, {
    valeurDroite: true,
  });
  ctx.y -= 10;

  // ── Récapitulatif par catégorie ──
  dessinerTitreSection(ctx, "Recettes par catégorie");
  const catsRecettes = Object.keys(RECETTE_CATEGORIES)
    .map((c) => ({
      c,
      total: recettes.filter((t) => t.category === c).reduce((s, t) => s + t.amount, 0),
      nombre: recettes.filter((t) => t.category === c).length,
    }))
    .filter((x) => x.nombre > 0);
  if (catsRecettes.length === 0) {
    dessinerTexte(ctx, "Aucune recette sur la période.", MARGE, ctx.y, {
      taille: 9,
      couleur: TAUPE,
    });
    ctx.y -= 16;
  } else {
    for (const { c, total, nombre } of catsRecettes) {
      dessinerLigneInfo(
        ctx,
        `${RECETTE_CATEGORIES[c as keyof typeof RECETTE_CATEGORIES]} (${nombre})`,
        formaterMontantPdf(total, devise),
        { valeurDroite: true, couleurValeur: VERT }
      );
    }
    ctx.y -= 8;
  }

  dessinerTitreSection(ctx, "Dépenses par catégorie");
  const catsDepenses = Object.keys(DEPENSE_CATEGORIES)
    .map((c) => ({
      c,
      total: depenses.filter((t) => t.category === c).reduce((s, t) => s + t.amount, 0),
      nombre: depenses.filter((t) => t.category === c).length,
    }))
    .filter((x) => x.nombre > 0);
  if (catsDepenses.length === 0) {
    dessinerTexte(ctx, "Aucune dépense sur la période.", MARGE, ctx.y, {
      taille: 9,
      couleur: TAUPE,
    });
    ctx.y -= 16;
  } else {
    for (const { c, total, nombre } of catsDepenses) {
      dessinerLigneInfo(
        ctx,
        `${DEPENSE_CATEGORIES[c as keyof typeof DEPENSE_CATEGORIES]} (${nombre})`,
        formaterMontantPdf(total, devise),
        { valeurDroite: true, couleurValeur: ROUGE }
      );
    }
    ctx.y -= 8;
  }

  // ── Journal détaillé ──
  dessinerTitreSection(ctx, "Journal des mouvements");

  if (transactions.length === 0) {
    dessinerTexte(
      ctx,
      "Aucun mouvement financier sur la période.",
      MARGE,
      ctx.y,
      { taille: 9, couleur: TAUPE }
    );
    return finaliserDocument(ctx);
  }

  const colonnes: ColonneTable[] = [
    { titre: "Date", largeur: 52 },
    { titre: "Libellé", largeur: 150 },
    { titre: "Catégorie", largeur: 72 },
    { titre: "Réf.", largeur: 46 },
    { titre: "Recette", largeur: 65, alignement: "droite" },
    { titre: "Dépense", largeur: 65, alignement: "droite" },
    { titre: "Solde", largeur: 65, alignement: "droite" },
  ];
  dessinerLigneTable(ctx, colonnes, colonnes.map((c) => c.titre), { entete: true });

  let cumul = 0;
  transactions.forEach((t, i) => {
    assurerPlace(ctx, 26);
    cumul += t.type === "RECETTE" ? t.amount : -t.amount;
    dessinerLigneTable(
      ctx,
      colonnes,
      [
        dateCourte(t.date),
        t.label,
        t.category,
        t.reference || "—",
        t.type === "RECETTE" ? formaterMontantPdf(t.amount, devise) : "",
        t.type === "DEPENSE" ? formaterMontantPdf(t.amount, devise) : "",
        formaterMontantPdf(cumul, devise),
      ],
      {
        zebra: i % 2 === 0,
        couleurs: [
          null,
          null,
          null,
          null,
          VERT,
          ROUGE,
          cumul >= 0 ? VERT : ROUGE,
        ],
      }
    );
  });

  // ── Ligne de total ──
  assurerPlace(ctx, 24);
  dessinerLigneTable(
    ctx,
    colonnes,
    [
      "",
      "TOTAL",
      "",
      "",
      formaterMontantPdf(totalRecettes, devise),
      formaterMontantPdf(totalDepenses, devise),
      formaterMontantPdf(solde, devise),
    ],
    {
      gras: true,
      couleurs: [null, null, null, null, VERT, ROUGE, solde >= 0 ? VERT : ROUGE],
    }
  );

  return finaliserDocument(ctx);
}

/** Type utilitaire exporté pour les routes (bytes PDF → réponse). */
export function enTetesPdf(): Record<string, string> {
  return {
    "Content-Type": "application/pdf",
    "Cache-Control": "no-store",
  };
}

export type { ContextePdf };
