/**
 * ⭐ V3.66 — Constantes métier des espaces Secrétariat & Trésorerie.
 *
 * Un seul endroit pour les statuts, catégories, méthodes et libellés des
 * deux sous-domaines — partagé par les pages (affichage), les routes API
 * (validation) et les générateurs PDF (registres).
 */

// ═══════════════════════════════════════════════════════════════════════
// SECRÉTARIAT
// ═══════════════════════════════════════════════════════════════════════

/** Statuts du cycle de vie d'une demande de rencontre. */
export const DEMANDE_STATUTS = {
  RECUE: {
    valeur: "RECUE",
    libelle: "Reçue",
    description: "Déposée — en attente d'examen par la secrétaire",
    couleur: "bg-[#C9A227]/15 text-[#A3821C] border-[#C9A227]/30",
    point: "#C9A227",
  },
  TRANSMISE: {
    valeur: "TRANSMISE",
    libelle: "Transmise",
    description: "Transmise au serviteur de Dieu concerné",
    couleur: "bg-[#5B7052]/15 text-[#3F5039] border-[#5B7052]/30",
    point: "#5B7052",
  },
  TRAITEE: {
    valeur: "TRAITEE",
    libelle: "Traitée",
    description: "Réponse formulée / rendez-vous donné",
    couleur: "bg-[#8C5FA8]/15 text-[#6B4480] border-[#8C5FA8]/30",
    point: "#8C5FA8",
  },
  ARCHIVEE: {
    valeur: "ARCHIVEE",
    libelle: "Archivée",
    description: "Sortie du registre actif (doublon, indésirable…)",
    couleur: "bg-[#8A8378]/15 text-[#6B6459] border-[#8A8378]/30",
    point: "#8A8378",
  },
} as const;

export type DemandeStatut = keyof typeof DEMANDE_STATUTS;
export const DEMANDE_STATUT_VALEURS = Object.keys(DEMANDE_STATUTS);

/** Niveaux d'urgence d'une demande. */
export const DEMANDE_URGENCES = {
  normale: { libelle: "Normale", couleur: "text-[#8A8378]" },
  elevee: { libelle: "Élevée", couleur: "text-[#A3821C]" },
  urgente: { libelle: "Urgente", couleur: "text-[#B3452E]" },
} as const;

export type DemandeUrgence = keyof typeof DEMANDE_URGENCES;
export const DEMANDE_URGENCE_VALEURS = Object.keys(DEMANDE_URGENCES);

/** Serviteurs de Dieu joignables via le secrétariat. */
export const SERVITEURS_RENDEZ_VOUS = {
  pam: {
    code: "pam",
    libelle: "Sœur Pam",
    titre: "Servante de l'Éternel",
  },
  kongo: {
    code: "kongo",
    libelle: "Pasteur Kongo",
    titre: "Pasteur",
  },
} as const;

export type ServiteurCode = keyof typeof SERVITEURS_RENDEZ_VOUS;
export const SERVITEUR_CODES = Object.keys(SERVITEURS_RENDEZ_VOUS);

/** Catégories des annonces officielles du ministère. */
export const ANNONCE_CATEGORIES = {
  generale: { libelle: "Générale", icone: "Megaphone", couleur: "#C9A227" },
  live: { libelle: "Live / Direct", icone: "Radio", couleur: "#8C5FA8" },
  evenement: { libelle: "Événement", icone: "Calendar", couleur: "#5B7052" },
  urgence: { libelle: "Urgente", icone: "AlertTriangle", couleur: "#B3452E" },
} as const;

export type AnnonceCategorie = keyof typeof ANNONCE_CATEGORIES;
export const ANNONCE_CATEGORIES_VALEURS = Object.keys(ANNONCE_CATEGORIES);

// ═══════════════════════════════════════════════════════════════════════
// TRÉSORERIE
// ═══════════════════════════════════════════════════════════════════════

/** Types de mouvements financiers. */
export const MOUVEMENT_TYPES = {
  RECETTE: { valeur: "RECETTE", libelle: "Recette", couleur: "#5B7052" },
  DEPENSE: { valeur: "DEPENSE", libelle: "Dépense", couleur: "#B3452E" },
} as const;

export type MouvementType = keyof typeof MOUVEMENT_TYPES;
export const MOUVEMENT_TYPE_VALEURS = Object.keys(MOUVEMENT_TYPES);

/** Catégories de RECETTES (dons, offrandes, dîmes…). */
export const RECETTE_CATEGORIES = {
  don: "Don",
  offrande: "Offrande",
  dime: "Dîme",
  projet: "Financement projet",
  autre: "Autre",
} as const;

/** Catégories de DÉPENSES (charges, matériel, transport…). */
export const DEPENSE_CATEGORIES = {
  charges: "Charges générales",
  materiel: "Matériel",
  transport: "Transport",
  communication: "Communication",
  aide: "Aide / assistance",
  projet: "Projet",
  autre: "Autre",
} as const;

export const RECETTE_CATEGORIES_VALEURS = Object.keys(RECETTE_CATEGORIES);
export const DEPENSE_CATEGORIES_VALEURS = Object.keys(DEPENSE_CATEGORIES);

/** Méthodes d'encaissement / de décaissement. */
export const MOUVEMENT_METHODS = {
  especes: "Espèces",
  mobile_money: "Mobile money",
  virement: "Virement bancaire",
  carte: "Carte bancaire",
  crypto: "Crypto",
} as const;

export const MOUVEMENT_METHOD_VALEURS = Object.keys(MOUVEMENT_METHODS);

/** Devises admises (le ministère est présent en Europe et en Afrique). */
export const DEVISES = {
  EUR: { code: "EUR", symbole: "€", libelle: "Euro" },
  XOF: { code: "XOF", symbole: "F", libelle: "Franc CFA (UEMOA)" },
  USD: { code: "USD", symbole: "$", libelle: "Dollar US" },
} as const;

export type DeviseCode = keyof typeof DEVISES;
export const DEVISE_CODES = Object.keys(DEVISES);

/**
 * Formate un montant selon la devise — espace insécable avant le symbole,
 * séparateur de milliers français. Les montants XOF sont arrondis au
 * franc près (pas de centimes en CFA).
 */
export function formaterMontant(montant: number, devise: string): string {
  const d = (DEVISES as Record<string, { symbole: string }>)[devise] || {
    symbole: devise,
  };
  const fraction = devise === "XOF" ? 0 : 2;
  const n = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(montant);
  return `${n}\u00A0${d.symbole}`;
}

/** Libellé lisible d'une catégorie (recette ou dépense). */
export function libelleCategorie(categorie: string, type: string): string {
  if (type === "RECETTE") {
    return (RECETTE_CATEGORIES as Record<string, string>)[categorie] || categorie;
  }
  return (DEPENSE_CATEGORIES as Record<string, string>)[categorie] || categorie;
}

/** Libellé lisible d'une méthode d'encaissement. */
export function libelleMethode(methode: string | null): string {
  if (!methode) return "Non précisé";
  return (MOUVEMENT_METHODS as Record<string, string>)[methode] || methode;
}
