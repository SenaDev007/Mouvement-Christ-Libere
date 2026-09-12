/**
 * ⭐ V3.67 — Multicaisse : calculs partagés (API, dashboard, PDF).
 * ============================================================================
 *
 * Principes :
 *  · un solde de caisse n'est JAMAIS stocké — il est recalculé à chaque
 *    consultation depuis le journal + le solde d'OUVERTURE de la caisse :
 *      solde = ouverture + recettes − dépenses − transferts sortants
 *              + transferts entrants ;
 *  · un TRANSFERT est interne : il déplace l'argent d'une caisse à l'autre
 *    SANS changer le total consolidé (sortie d'une caisse = entrée dans
 *    une autre) ;
 *  · les écritures saisies avant la multicaisse (caisseId NULL) forment un
 *    compartiment « non affecté », affiché séparément et consolidé avec les
 *    caisses — aucune donnée historique n'est réécrite ;
 *  · la consolidation par devise est l'INVARIANT de contrôle : elle doit
 *    être égale à Σ(ouvertures) + recettes − dépenses du journal, transferts
 *    exclus. Les deux calculs sont faits indépendamment et comparés.
 */

import { db } from "@/lib/db";
import { TRANSFERT_CATEGORIE } from "./constants";

export interface LigneCaisse {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  openingBalance: number;
  isActive: boolean;
  description: string | null;
  recettes: number;
  depenses: number;
  transfertsSortants: number;
  transfertsEntrants: number;
  solde: number;
  nbMouvements: number;
}

export interface LigneDeviseNonAffectee {
  devise: string;
  recettes: number;
  depenses: number;
  solde: number;
  nbMouvements: number;
}

export interface LigneConsolidee {
  devise: string;
  // Σ caisses de la devise (ouvertures incluses) + non affecté.
  soldeCaisses: number;
  soldeNonAffecte: number;
  solde: number;
  nbCaisses: number;
}

export interface SituationMulticaisse {
  caisses: LigneCaisse[];
  nonAffecte: LigneDeviseNonAffectee[];
  consolide: LigneConsolidee[];
  /** Contrôle de cohérence : Σ(soldes) vs Σ(ouvertures)+recettes−dépenses. */
  coherent: boolean;
}

/**
 * Calcule la situation multicaisse complète (toutes caisses, y compris
 * désactivées — l'historique d'une caisse fermée reste consultable).
 */
export async function calculerSituationMulticaisse(): Promise<SituationMulticaisse> {
  const [caisses, transactions] = await Promise.all([
    db.treasuryCashAccount.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    }),
    db.treasuryTransaction.findMany({
      select: {
        type: true,
        amount: true,
        currency: true,
        caisseId: true,
        caisseDestinationId: true,
      },
    }),
  ]);

  const lignes = new Map<string, LigneCaisse>();
  for (const c of caisses) {
    lignes.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      type: c.type,
      currency: c.currency,
      openingBalance: c.openingBalance,
      isActive: c.isActive,
      description: c.description,
      recettes: 0,
      depenses: 0,
      transfertsSortants: 0,
      transfertsEntrants: 0,
      solde: c.openingBalance,
      nbMouvements: 0,
    });
  }

  const nonAffecte = new Map<string, LigneDeviseNonAffectee>();
  // Journal global (contrôle de cohérence) — transferts exclus.
  let recettesGlobales = 0;
  let depensesGlobales = 0;

  for (const t of transactions) {
    if (t.type === "TRANSFERT") {
      // Sortie de la caisse source.
      const source = t.caisseId ? lignes.get(t.caisseId) : null;
      if (source) {
        source.transfertsSortants += t.amount;
        source.solde -= t.amount;
        source.nbMouvements += 1;
      }
      // Entrée dans la caisse de destination.
      const destination = t.caisseDestinationId
        ? lignes.get(t.caisseDestinationId)
        : null;
      if (destination) {
        destination.transfertsEntrants += t.amount;
        destination.solde += t.amount;
        if (!source) destination.nbMouvements += 1;
      }
      continue;
    }

    if (t.type === "RECETTE") recettesGlobales += t.amount;
    else if (t.type === "DEPENSE") depensesGlobales += t.amount;

    const caisse = t.caisseId ? lignes.get(t.caisseId) : null;
    if (caisse) {
      if (t.type === "RECETTE") {
        caisse.recettes += t.amount;
        caisse.solde += t.amount;
      } else {
        caisse.depenses += t.amount;
        caisse.solde -= t.amount;
      }
      caisse.nbMouvements += 1;
    } else {
      // Écriture non affectée (antérieure à la multicaisse).
      const ligne =
        nonAffecte.get(t.currency) ||
        {
          devise: t.currency,
          recettes: 0,
          depenses: 0,
          solde: 0,
          nbMouvements: 0,
        };
      if (t.type === "RECETTE") {
        ligne.recettes += t.amount;
        ligne.solde += t.amount;
      } else {
        ligne.depenses += t.amount;
        ligne.solde -= t.amount;
      }
      ligne.nbMouvements += 1;
      nonAffecte.set(t.currency, ligne);
    }
  }

  // Consolidation par devise (somme des caisses + non affecté).
  const parDevise = new Map<string, LigneConsolidee>();
  for (const c of lignes.values()) {
    const l =
      parDevise.get(c.currency) ||
      {
        devise: c.currency,
        soldeCaisses: 0,
        soldeNonAffecte: 0,
        solde: 0,
        nbCaisses: 0,
      };
    l.soldeCaisses += c.solde;
    l.solde += c.solde;
    l.nbCaisses += 1;
    parDevise.set(c.currency, l);
  }
  for (const n of nonAffecte.values()) {
    const l =
      parDevise.get(n.devise) ||
      {
        devise: n.devise,
        soldeCaisses: 0,
        soldeNonAffecte: 0,
        solde: 0,
        nbCaisses: 0,
      };
    l.soldeNonAffecte += n.solde;
    l.solde += n.solde;
    parDevise.set(n.devise, l);
  }

  // Contrôle de cohérence : Σ soldes caisses + non affecté doit égaler
  // Σ ouvertures + recettes − dépenses (transferts exclus).
  const sommeOuvertures = caisses.reduce((s, c) => s + c.openingBalance, 0);
  const sommeSoldes = Array.from(parDevise.values()).reduce(
    (s, l) => s + l.solde,
    0
  );
  const attendu = sommeOuvertures + recettesGlobales - depensesGlobales;
  const coherent = Math.abs(sommeSoldes - attendu) < 0.01;

  return {
    caisses: Array.from(lignes.values()),
    nonAffecte: Array.from(nonAffecte.values()),
    consolide: Array.from(parDevise.values()).sort((a, b) =>
      a.devise.localeCompare(b.devise)
    ),
    coherent,
  };
}

/** Slug de code de caisse à partir du nom (« Caisse principale » →
 *  « caisse-principale »), avec suffixe aléatoire si déjà pris. */
export function slugifierCaisse(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);
  return base || "caisse";
}

const ALPHABET_SUIVI = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 (ambigus)

/** Code de suivi public d'une demande : « MCL-XXXXXX ». */
export function genererCodeSuivi(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET_SUIVI[Math.floor(Math.random() * ALPHABET_SUIVI.length)];
  }
  return `MCL-${code}`;
}

/** Génère un code de suivi unique (vérifié en base, 5 tentatives). */
export async function genererCodeSuiviUnique(): Promise<string | null> {
  for (let tentative = 0; tentative < 5; tentative++) {
    const code = genererCodeSuivi();
    const existante = await db.meetingRequest.findFirst({
      where: { trackingCode: code },
      select: { id: true },
    });
    if (!existante) return code;
  }
  return null;
}

export { TRANSFERT_CATEGORIE };
