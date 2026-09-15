/**
 * ⭐ V3.82 — Types partagés des passerelles de paiement (dons en ligne).
 *
 * Unique point de vérité des vocabulaires utilisés par la page /contribuer,
 * les API /api/dons/* et /api/webhooks/*, le back-office /admin/donations
 * et le dispatch automatique vers la trésorerie.
 *
 * Règle d'architecture : fedapay.service.ts et paystack.service.ts ne se
 * connaissent JAMAIS — toute décision de routage passe par
 * /api/dons/initier (créerTransactionDon()).
 */

import { randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────────────
// Vocabulaires
// ─────────────────────────────────────────────────────────────────────

/** Types de don proposés sur la page publique (clés = catégories trésorerie). */
export const TYPES_DON = {
  offrande: "Offrande",
  dime: "Dîme",
  don: "Don",
} as const;

export type TypeDon = keyof typeof TYPES_DON;
export const TYPES_DON_VALEURS = Object.keys(TYPES_DON) as TypeDon[];

/** Passerelles disponibles (canal local / canal international). */
export const PROVIDERS = {
  fedapay: "FedaPay",
  paystack: "Paystack",
} as const;

export type ProviderId = keyof typeof PROVIDERS;
export const PROVIDERS_VALEURS = Object.keys(PROVIDERS) as ProviderId[];

/** Statuts d'un don (source de vérité : la base, jamais l'URL de retour). */
export const STATUTS_DON = {
  pending: "pending",
  approved: "approved",
  failed: "failed",
} as const;

export type StatutDon = (typeof STATUTS_DON)[keyof typeof STATUTS_DON];

/** Montants bornés (XOF — entier, sans sous-unité). */
export const MONTANT_MIN_XOF = 100; // ~0,15 €
export const MONTANT_MAX_XOF = 5_000_000; // ~7 600 € — au-delà : contact direct

/** Devise unique de la page de don (les deux passerelles la acceptent). */
export const DEVISE_DON = "XOF";

// ─────────────────────────────────────────────────────────────────────
// Demandes / réponses
// ─────────────────────────────────────────────────────────────────────

/** Payload attendu de POST /api/dons/initier (front → back). */
export interface DemandeDon {
  provider: ProviderId;
  type_don: TypeDon;
  montant: number;
  devise: string;
  email: string;
  nom?: string | null;
  recurrent?: boolean;
}

/** Résultat de la création d'une transaction chez le fournisseur. */
export interface TransactionDon {
  reference: string;
  provider: ProviderId;
  providerRef: string | null;
  paymentUrl: string;
}

/** Erreur typée d'une passerelle (message français affichable). */
export class ErreurPasserelle extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ErreurPasserelle";
  }
}

// ─────────────────────────────────────────────────────────────────────
// Utilitaires partagés
// ─────────────────────────────────────────────────────────────────────

/**
 * Génère la référence interne d'un don, côté serveur, AVANT tout appel
 * externe : le don reste retrouvable même si le fournisseur ne répond
 * jamais (la ligne existe déjà en base avec ce libellé).
 * Format : don_<base36 temps>_<10 hex> (ex. don_lz3k9f2a_4b1c2d3e4f).
 */
export function genererReferenceDon(): string {
  const temps = Date.now().toString(36);
  const alea = randomBytes(5).toString("hex");
  return `don_${temps}_${alea}`;
}

/** Vrai si l'adresse email a un format plausible (RFC allégée). */
export function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Vrai si le montant est un entier XOF valide. */
export function montantValide(montant: number): boolean {
  return (
    Number.isInteger(montant) &&
    montant >= MONTANT_MIN_XOF &&
    montant <= MONTANT_MAX_XOF
  );
}

/**
 * Formate un montant XOF pour l'affichage — « 10 000 FCFA ».
 * Regroupement par milliers à espace fine INSÉCABLE (U+202F) identique
 * côté serveur et client (aucune dépendance ICU — pas d'écart d'hydratation).
 */
export function formaterMontantXof(montant: number): string {
  const partieEntiere = Math.round(Math.abs(montant))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return `${montant < 0 ? "−" : ""}${partieEntiere}\u00A0FCFA`;
}

/** URL de base du site (callback de retour fournisseur + liens des emails). */
export function urlSite(): string {
  return (
    process.env.SITE_URL ||
    "https://www.mouvementchristlibere.com"
  ).replace(/\/$/, "");
}

/** Libellé lisible d'un type de don. */
export function libelleTypeDon(typeDon: string | null | undefined): string {
  return (
    (TYPES_DON as Record<string, string>)[typeDon || ""] || "Don"
  );
}

/** Libellé lisible d'un fournisseur. */
export function libelleProvider(provider: string | null | undefined): string {
  return (
    (PROVIDERS as Record<string, string>)[provider || ""] || "—"
  );
}
