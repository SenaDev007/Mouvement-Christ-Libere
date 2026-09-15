/**
 * ⭐ V3.88 — Conversion automatique entre devises de la Trésorerie.
 *
 * Le ministère opère principalement en francs CFA (XOF) mais tient aussi
 * des écritures en EUR et USD. Devise par défaut : XOF (partout — journal,
 * tableau de bord, caisse, rapports).
 *
 * Règles :
 *  · EUR → XOF : PARITÉ FIXE officielle (1 € = 655,957 F) — exacte au
 *    centième de franc, c'est le taux légal de l'UEMOA ;
 *  · USD → XOF : taux de RÉFÉRENCE ajustable ci-dessous (le dollar flotte,
 *    il n'existe pas de parité légale) — assez stable pour des indicateurs
 *    de trésorerie ; le montant NATIF de chaque écriture reste toujours
 *    affiché à côté de l'équivalent, jamais remplacé ;
 *  · toute conversion passe par le pivot XOF (montant × tauxSource →
 *    XOF → ÷ tauxCible) : impossible d'oublier un sens de conversion.
 */

import { DEVISES, DEVISE_CODES } from "./constants";

/** Devise de référence du ministère — affichée par défaut partout. */
export const DEVISE_PAR_DEFAUT = "XOF";

/**
 * Valeur d'1 unité de chaque devise, exprimée en XOF.
 * EUR = parité fixe légale. USD = référence ajustable (à actualiser
 * occasionnellement — un seul endroit à modifier).
 */
export const TAUX_XOF: Record<string, number> = {
  XOF: 1,
  EUR: 655.957,
  USD: 610,
};

/** Vrai si le code devise est admis par la trésorerie. */
export function deviseAdmise(devise: string | null | undefined): boolean {
  return Boolean(devise && DEVISE_CODES.includes(devise));
}

/** Valeur d'1 unité de la devise en XOF (1 si XOF elle-même). */
export function tauxVersXof(devise: string): number {
  return TAUX_XOF[devise] ?? 1;
}

/**
 * Convertit un montant d'une devise vers une autre (pivot XOF).
 * Devise inconnue → traitée comme XOF (jamais d'écrasement silencieux
 * par 0 : un montant affiché reste toujours visible).
 */
export function convertirMontant(
  montant: number,
  deviseSource: string,
  deviseCible: string
): number {
  if (!Number.isFinite(montant)) return 0;
  if (deviseSource === deviseCible) return montant;
  const enXof = montant * tauxVersXof(deviseSource);
  if (deviseCible === "XOF") return enXof;
  return enXof / tauxVersXof(deviseCible);
}

/**
 * Somme des montants de plusieurs devises, exprimée dans UNE devise
 * commune (conversion avant addition — on n'additionne JAMAIS des
 * montants de devises différentes tels quels).
 */
export function sommeConvertie(
  montants: { montant: number; devise: string }[],
  deviseCible: string
): number {
  return montants.reduce(
    (somme, m) => somme + convertirMontant(m.montant, m.devise, deviseCible),
    0
  );
}

// ─────────────────────────────────────────────────────────────────────
// Formatage
// ─────────────────────────────────────────────────────────────────────

/** Formate un montant avec le symbole de SA devise (affichage natif). */
export function formaterMontantDevise(montant: number, devise: string): string {
  const symbole =
    (DEVISES as Record<string, { symbole: string }>)[devise]?.symbole || devise;
  const fraction = devise === "XOF" ? 0 : 2;
  const n = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(montant);
  return `${n}\u00A0${symbole}`;
}

/**
 * Équivalent converti, prêt à afficher sous un montant natif :
 * « ≈ 9 839 F » — null si aucune conversion nécessaire (même devise
 * ou devise cible inconnue) pour ne pas polluer l'affichage.
 */
export function equivalentFormate(
  montant: number,
  deviseSource: string,
  deviseAffichage: string
): string | null {
  if (
    !Number.isFinite(montant) ||
    deviseSource === deviseAffichage ||
    !deviseAdmise(deviseAffichage)
  ) {
    return null;
  }
  const converti = convertirMontant(montant, deviseSource, deviseAffichage);
  return `≈\u00A0${formaterMontantDevise(converti, deviseAffichage)}`;
}

/** Note de bas de page sur les taux utilisés (affichée sous les totaux). */
export function noteTauxReference(deviseAffichage: string): string {
  if (deviseAffichage === "XOF") {
    return "Taux de référence : 1 € = 655,957 F (parité fixe) · 1 $ = 610 F";
  }
  return `Taux de référence : 1 ${libelleDevise(deviseAffichage)} = ${formaterMontantDevise(tauxVersXof(deviseAffichage), "XOF")} (1 € = 655,957 F, parité fixe)`;
}

/** Libellé lisible d'une devise. */
export function libelleDevise(devise: string): string {
  return (
    (DEVISES as Record<string, { libelle: string }>)[devise]?.libelle || devise
  );
}
