/**
 * Ancrage annuel — détermine le 1 Aviv (premier jour de l'année biblique).
 *
 * Algorithme : mercredi le plus proche de l'équinoxe de printemps à Jérusalem.
 *
 * Référence fournie : l'année biblique 2026-2027 commence mercredi 18 mars 2026.
 * Vérification : 18 mars 2026 est un mercredi ? → OUI (validé).
 *
 * Formule : pour une année grégorienne N, on calcule l'équinoxe de printemps,
 * puis on trouve le mercredi le plus proche (avant ou après, à ±3 jours max).
 */

import { calculerEquinoxePourAnneeBiblique } from "./equinoxe";

/**
 * Trouve le mercredi le plus proche d'une date donnée.
 *
 * En JavaScript, getDay() retourne :
 * 0 = Dimanche, 1 = Lundi, 2 = Mardi, 3 = Mercredi,
 * 4 = Jeudi, 5 = Vendredi, 6 = Samedi
 *
 * @param date Date de référence (équinoxe)
 * @returns Date du mercredi le plus proche (à minuit UTC)
 */
export function mercrediLePlusProche(date: Date): Date {
  const jourSemaine = date.getUTCDay(); // 0=Dim, 3=Mer

  // Différence en jours jusqu'au mercredi le plus proche
  // Si on est mercredi (3), diff = 0
  // Sinon, on calcule le décalage minimal (vers avant ou après)
  let diff = 3 - jourSemaine;
  if (diff < -3) diff += 7;
  if (diff > 3) diff -= 7;

  const mercredi = new Date(date);
  mercredi.setUTCDate(mercredi.getUTCDate() + diff);
  // Caler à minuit UTC
  mercredi.setUTCHours(0, 0, 0, 0);

  return mercredi;
}

/**
 * Calcule la date grégorienne du 1 Aviv pour une année biblique donnée.
 *
 * @param anneeBiblique Année civile de début (ex: 2026 pour l'année biblique 2026-2027)
 * @returns Date grégorienne du 1 Aviv (mercredi le plus proche de l'équinoxe)
 */
export function calculerDebutAnnee(anneeBiblique: number): Date {
  const equinoxe = calculerEquinoxePourAnneeBiblique(anneeBiblique);
  return mercrediLePlusProche(equinoxe);
}

/**
 * Calcule la date de fin de l'année biblique (364 jours plus tard, donc
 * le jour avant le 1 Aviv de l'année suivante).
 *
 * @param anneeBiblique Année civile de début
 * @returns Date grégorienne du dernier jour de l'année biblique
 */
export function calculerFinAnnee(anneeBiblique: number): Date {
  const debut = calculerDebutAnnee(anneeBiblique);
  const fin = new Date(debut);
  fin.setUTCDate(fin.getUTCDate() + 363); // 364 jours au total, index 0 à 363
  return fin;
}

/**
 * Détermine l'année biblique en cours pour une date grégorienne donnée.
 *
 * @param date Date grégorienne (par défaut : maintenant)
 * @returns Année biblique (ex: 2026 pour 2026-2027)
 */
export function determinerAnneeBibliqueEnCours(date: Date = new Date()): number {
  // L'année biblique commence en mars, donc si on est janvier-février,
  // on est encore dans l'année biblique précédente
  const anneeCivile = date.getUTCFullYear();

  // Tester l'année civile courante
  const debutAnneeCourante = calculerDebutAnnee(anneeCivile);
  if (date >= debutAnneeCourante) {
    return anneeCivile;
  }

  // Sinon, on est dans l'année biblique précédente
  return anneeCivile - 1;
}

/**
 * Retourne l'équinoxe de référence utilisé pour l'ancrage.
 */
export function obtenirEquinoxeReference(anneeBiblique: number): Date {
  return calculerEquinoxePourAnneeBiblique(anneeBiblique);
}
