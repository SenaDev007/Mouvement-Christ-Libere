/**
 * Conversion bidirectionnelle entre calendrier grégorien et calendrier biblique
 * de 364 jours.
 */

import { genererAnnee, type JourBiblique } from "./generation";
import { calculerDebutAnnee } from "./ancrage";

/**
 * Convertit une date grégorienne en jour biblique.
 *
 * @param dateGregorienne Date à convertir
 * @returns Jour biblique correspondant, ou null si hors année biblique
 */
export function convertirGregorienVersBiblique(
  dateGregorienne: Date
): JourBiblique | null {
  // Déterminer l'année biblique potentielle
  const anneeCivile = dateGregorienne.getUTCFullYear();

  // Tester l'année civile courante et la précédente
  for (const annee of [anneeCivile, anneeCivile - 1, anneeCivile + 1]) {
    const anneeBiblique = genererAnnee(annee);
    const debut = anneeBiblique.debut.getTime();
    const fin = anneeBiblique.fin.getTime();
    const dateMs = dateGregorienne.getTime();

    if (dateMs >= debut && dateMs <= fin + 24 * 60 * 60 * 1000) {
      // Trouver le jour exact
      for (const jour of anneeBiblique.jours) {
        const jourDebut = jour.dateGregorienne.getTime();
        const jourFin = jourDebut + 24 * 60 * 60 * 1000;
        if (dateMs >= jourDebut && dateMs < jourFin) {
          return jour;
        }
      }
    }
  }

  return null;
}

/**
 * Convertit une date biblique en date grégorienne.
 *
 * @param anneeBiblique Année biblique (ex: 2026)
 * @param mois Numéro du mois (1-12)
 * @param jourDuMois Jour du mois (1-31)
 * @returns Date grégorienne correspondante
 */
export function convertirBibliqueVersGregorien(
  anneeBiblique: number,
  mois: number,
  jourDuMois: number
): Date | null {
  const annee = genererAnnee(anneeBiblique);
  const jour = annee.jours.find(
    (j) => j.mois === mois && j.jourDuMois === jourDuMois
  );
  return jour ? jour.dateGregorienne : null;
}

/**
 * Formate une date grégorienne au format français lisible.
 */
export function formaterDateGregorienne(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formate une date grégorienne au format court.
 */
export function formaterDateGregorienneCourt(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formate un jour biblique pour affichage.
 */
export function formaterJourBiblique(jour: JourBiblique): string {
  return `${jour.jourDuMois} ${jour.nomMois} · ${jour.nomJourSemaine}`;
}

/**
 * Génère le libellé d'une année biblique (ex: "2026-2027").
 */
export function libelleAnneeBiblique(annee: number): string {
  const debut = calculerDebutAnnee(annee);
  const anneeFin = debut.getUTCFullYear() + 1;
  return `${annee}-${anneeFin}`;
}
