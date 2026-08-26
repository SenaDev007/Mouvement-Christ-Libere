/**
 * Calcul astronomique de l'équinoxe de printemps.
 *
 * Source : astronomy-engine (lib open-source, calculs éphémérides fiables,
 * zéro dépendance API externe payante).
 *
 * Référence : instant où le Soleil traverse le point vernal (declinaison = 0°)
 * dans son mouvement apparent vers le nord.
 */

import { Seasons, type AstroTime } from "astronomy-engine";

/**
 * Calcule l'instant précis de l'équinoxe de printemps pour une année donnée.
 *
 * @param year Année grégorienne (ex: 2026)
 * @returns Date UTC de l'équinoxe de printemps
 */
export function calculerEquinoxePrintemps(year: number): Date {
  // astronomy-engine fournit directement la fonction
  // Seasons(year) retourne les 4 saisons pour l'année
  const seasons = Seasons(year);
  // mar_equinox est un objet AstroTime, on extrait la Date
  const equinoxTime = seasons.mar_equinox as AstroTime;
  return equinoxTime.date;
}

/**
 * Calcule l'équinoxe de printemps pour l'année biblique qui chevauche
 * une année grégorienne donnée.
 *
 * L'année biblique 2026-2027 commence en mars 2026, donc on prend
 * l'équinoxe de printemps 2026.
 */
export function calculerEquinoxePourAnneeBiblique(
  anneeBiblique: number
): Date {
  // L'année biblique "2026-2027" commence en mars 2026
  // Donc on prend l'équinoxe de l'année civile de début
  return calculerEquinoxePrintemps(anneeBiblique);
}
