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
  dessinerPied,
  finaliserDocument,
  assurerPlace,
  dateCourte,
  dateLongue,
  formaterMontantPdf,
  largeurTexte,
  A4,
  MARGE,
  CREME,
  NUIT,
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
  trackingCode?: string | null;
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
    if (d.trackingCode) {
      infosStatut.push(`Suivi : ${d.trackingCode}`);
    }
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
  type: string; // RECETTE | DEPENSE | TRANSFERT
  category: string;
  amount: number;
  currency: string;
  method: string | null;
  label: string;
  date: Date;
  reference: string | null;
  donorName: string | null;
  isAnonymous: boolean;
  caisseNom?: string | null;
  caisseDestinationNom?: string | null;
}

export interface SituationCaissePdf {
  caisses: {
    name: string;
    type: string;
    currency: string;
    openingBalance: number;
    recettes: number;
    depenses: number;
    transfertsSortants: number;
    transfertsEntrants: number;
    solde: number;
    isActive: boolean;
  }[];
}

export async function genererRapportFinancier(
  transactions: TransactionPdf[],
  periode: { du: Date; au: Date },
  devise: string,
  situationCaisse?: SituationCaissePdf
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
  const transferts = transactions.filter((t) => t.type === "TRANSFERT");
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
  if (transferts.length > 0) {
    dessinerLigneInfo(
      ctx,
      `Transferts internes (${transferts.length}) — sans effet sur le solde`,
      formaterMontantPdf(
        transferts.reduce((s, t) => s + t.amount, 0),
        devise
      ),
      { valeurDroite: true, couleurValeur: NUIT_PROFONDE }
    );
  }
  dessinerLigneInfo(ctx, "Nombre de mouvements", `${transactions.length}`, {
    valeurDroite: true,
  });
  ctx.y -= 10;

  // ── ⭐ V3.67 — Situation par caisse (multicaisse) ──
  if (situationCaisse && situationCaisse.caisses.length > 0) {
    const caissesDevise = situationCaisse.caisses.filter(
      (c) => c.currency === devise
    );
    if (caissesDevise.length > 0) {
      dessinerTitreSection(ctx, "Situation par caisse (toute la période)");
      const colonnesCaisses: ColonneTable[] = [
        { titre: "Caisse", largeur: 150 },
        { titre: "Ouverture", largeur: 75, alignement: "droite" },
        { titre: "Recettes", largeur: 75, alignement: "droite" },
        { titre: "Dépenses", largeur: 75, alignement: "droite" },
        { titre: "Transf.", largeur: 65, alignement: "droite" },
        { titre: "Solde", largeur: 75, alignement: "droite" },
      ];
      dessinerLigneTable(
        ctx,
        colonnesCaisses,
        colonnesCaisses.map((c) => c.titre),
        { entete: true }
      );
      caissesDevise.forEach((c, i) => {
        assurerPlace(ctx, 24);
        const netTransferts = c.transfertsEntrants - c.transfertsSortants;
        dessinerLigneTable(
          ctx,
          colonnesCaisses,
          [
            c.name + (c.isActive ? "" : " (désactivée)"),
            formaterMontantPdf(c.openingBalance, devise),
            formaterMontantPdf(c.recettes, devise),
            formaterMontantPdf(c.depenses, devise),
            (netTransferts >= 0 ? "+" : "") + formaterMontantPdf(netTransferts, devise),
            formaterMontantPdf(c.solde, devise),
          ],
          { zebra: i % 2 === 0 }
        );
      });
      ctx.y -= 10;
    }
  }

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
    const delta =
      t.type === "RECETTE" ? t.amount : -t.amount;
    cumul += t.type === "TRANSFERT" ? 0 : delta;
    dessinerLigneTable(
      ctx,
      colonnes,
      [
        dateCourte(t.date),
        t.type === "TRANSFERT"
          ? `${t.label} — ${t.caisseNom || "?"} → ${t.caisseDestinationNom || "?"}`
          : `${t.label}${t.caisseNom ? ` (${t.caisseNom})` : ""}`,
        t.category,
        t.reference || "—",
        t.type === "RECETTE" ? formaterMontantPdf(t.amount, devise) : "",
        t.type === "DEPENSE" ? formaterMontantPdf(t.amount, devise) : "",
        t.type === "TRANSFERT"
          ? "interne"
          : formaterMontantPdf(cumul, devise),
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
          t.type === "TRANSFERT"
            ? NUIT_PROFONDE
            : cumul >= 0
              ? VERT
              : ROUGE,
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

// ═══════════════════════════════════════════════════════════════════════
// ④ REÇU DE DON (V3.67 — gap du bilan : « pas de reçu de don PDF »)
// ═══════════════════════════════════════════════════════════════════════

import { ENCRE } from "./base";

export interface RecuDonPdf {
  id: string;
  type: string;
  category: string;
  amount: number;
  currency: string;
  method: string | null;
  label: string;
  date: Date;
  reference: string | null;
  donorName: string | null;
  isAnonymous: boolean;
  note: string | null;
  caisseNom: string | null;
}

/**
 * Reçu de don — une page, format acknowledgment : identification du don,
 * montant en grand, catégorie, méthode, caisse, espace de signature du
 * trésorier. Mention discrète : document de confirmation, pas un reçu
 * fiscal (les reçus fiscaux obéissent à des règles propres à chaque pays).
 */
export async function genererRecuDon(recu: RecuDonPdf): Promise<Uint8Array> {
  const ctx = await creerDocument({
    espace: "Trésorerie",
    titreDocument: "Reçu de don",
    sousTitre: `N° ${recu.reference || recu.id.toUpperCase()} · ${dateLongue(recu.date)}`,
  });
  dessinerCouverture(ctx);

  const LARGEUR_UTILE = A4[0] - MARGE * 2;

  // ── Bloc donateur ──
  dessinerTitreSection(ctx, "Donateur");
  dessinerLigneInfo(ctx, "Nom", recu.isAnonymous ? "Don anonyme" : recu.donorName || "Non précisé", {
    gras: true,
  });
  if (recu.isAnonymous) {
    dessinerTexte(
      ctx,
      "Le donateur a souhaité rester anonyme : aucun nom n'est conservé au journal.",
      MARGE,
      ctx.y,
      { taille: 8.5, couleur: TAUPE }
    );
    ctx.y -= 16;
  } else {
    ctx.y -= 8;
  }

  // ── Bloc du don ──
  dessinerTitreSection(ctx, "Détail du don");

  // Encadré montant (bandeau or sur fond nuit).
  const hauteurEncadre = 74;
  ctx.y -= 6;
  ctx.page.drawRectangle({
    x: MARGE,
    y: ctx.y - hauteurEncadre,
    width: LARGEUR_UTILE,
    height: hauteurEncadre,
    color: NUIT,
    borderColor: OR,
    borderWidth: 1.2,
  });
  ctx.page.drawText("MONTANT DU DON", {
    x: MARGE + 16,
    y: ctx.y - 24,
    size: 9,
    font: ctx.sansGras,
    color: CREME,
  });
  const montantTxt = formaterMontantPdf(recu.amount, recu.currency);
  ctx.page.drawText(montantTxt, {
    x: MARGE + 16,
    y: ctx.y - 50,
    size: 24,
    font: ctx.serifGras,
    color: OR,
  });
  // Référence du reçu à droite de l'encadré.
  const refTxt = (recu.reference || recu.id.toUpperCase()).substring(0, 26);
  ctx.page.drawText(`N° ${refTxt}`, {
    x: MARGE + LARGEUR_UTILE - 16 - largeurTexte(ctx.sansGras, 9, `N° ${refTxt}`),
    y: ctx.y - 24,
    size: 9,
    font: ctx.sansGras,
    color: CREME,
  });
  ctx.y -= hauteurEncadre + 14;

  dessinerLigneInfo(
    ctx,
    "Nature",
    RECETTE_CATEGORIES[recu.category as keyof typeof RECETTE_CATEGORIES] || recu.category,
    {}
  );
  dessinerLigneInfo(ctx, "Date du don", dateLongue(recu.date), {});
  dessinerLigneInfo(
    ctx,
    "Méthode d'encaissement",
    recu.method === "especes"
      ? "Espèces"
      : recu.method === "mobile_money"
        ? "Mobile money"
        : recu.method === "virement"
          ? "Virement bancaire"
          : recu.method === "carte"
            ? "Carte bancaire"
            : recu.method === "crypto"
              ? "Crypto"
              : "Non précisée",
    {}
  );
  if (recu.caisseNom) {
    dessinerLigneInfo(ctx, "Encaissé en caisse", recu.caisseNom, {});
  }
  if (recu.label) {
    dessinerLigneInfo(ctx, "Libellé", recu.label.substring(0, 90), {});
  }
  if (recu.note) {
    dessinerLigneInfo(ctx, "Note", recu.note.substring(0, 200), {});
  }
  ctx.y -= 12;

  // ── Mention + signature ──
  dessinerTexte(
    ctx,
    "Ce document confirme l'encaissement du don ci-dessus par la trésorerie du Mouvement Christ Libéré. Il est délivré à la demande du donateur et ne constitue pas un reçu fiscal.",
    MARGE,
    ctx.y,
    { taille: 8, couleur: TAUPE }
  );
  ctx.y -= 26;

  // Ligne de signature (côté droit, à ~120 du bas).
  const ySignature = Math.max(ctx.y - 40, 140);
  ctx.page.drawLine({
    start: { x: A4[0] - MARGE - 170, y: ySignature },
    end: { x: A4[0] - MARGE, y: ySignature },
    thickness: 0.8,
    color: ENCRE,
  });
  ctx.page.drawText("Le trésorier du ministère", {
    x: A4[0] - MARGE - 170,
    y: ySignature - 13,
    size: 8.5,
    font: ctx.sans,
    color: TAUPE,
  });
  ctx.page.drawText(`Fait le ${dateCourte(ctx.genereLe)}`, {
    x: A4[0] - MARGE - 170,
    y: ySignature - 25,
    size: 8.5,
    font: ctx.sans,
    color: TAUPE,
  });

  dessinerPied(ctx);

  return finaliserDocument(ctx);
}

// Export utilitaire conservé pour compatibilité.

export type { ContextePdf };
