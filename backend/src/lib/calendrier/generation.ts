/**
 * Génération de l'année biblique complète — 364 jours, 12 mois, 4 trimestres.
 *
 * Structure (Hénoch 72-82, Qumrân, Jubilés) :
 * - 364 jours = 52 semaines × 7 jours (exact, sans reste)
 * - 4 trimestres × 91 jours = 13 semaines
 * - 12 mois : 30, 30, 31 jours × 4 trimestres
 *
 * Propriété mathématique clé : 91 = 13 × 7, donc chaque trimestre
 * reproduit la même structure de semaine.
 *
 * Formule du jour de semaine (validée) :
 *   jourDeSemaine(n) = ((n - 1 + 3) mod 7) + 1
 *   où n = jour de l'année (1 à 364)
 *   1 = Dimanche ... 7 = Samedi
 *
 * Vérification :
 *   n=1 → 4 (Mercredi) ✓ (1 Aviv est toujours un mercredi)
 *   n=14 → 3 (Mardi) → Pessah tombe toujours un mardi ✓
 */

import { calculerDebutAnnee, calculerFinAnnee } from "./ancrage";

export interface JourBiblique {
  jourDeAnnee: number; // 1 à 364
  mois: number; // 1 à 12
  nomMois: string;
  jourDuMois: number; // 1 à 31
  jourDeSemaine: number; // 1 à 7 (1=Dim, 7=Sam)
  nomJourSemaine: string;
  estShabbat: boolean;
  dateGregorienne: Date;
  trimestre: number; // 1 à 4
}

export interface AnneeBiblique {
  annee: number;
  debut: Date;
  fin: Date;
  jours: JourBiblique[];
}

// Structure des mois : [numéro, nom, nombre de jours]
const STRUCTURE_MOIS = [
  { numero: 1, nom: "Aviv", jours: 30 },
  { numero: 2, nom: "Ziv", jours: 30 },
  { numero: 3, nom: "Sivan", jours: 31 },
  { numero: 4, nom: "Tammouz", jours: 30 },
  { numero: 5, nom: "Av", jours: 30 },
  { numero: 6, nom: "Éloul", jours: 31 },
  { numero: 7, nom: "Éthanim", jours: 30 },
  { numero: 8, nom: "Boul", jours: 30 },
  { numero: 9, nom: "Kislev", jours: 31 },
  { numero: 10, nom: "Tévet", jours: 30 },
  { numero: 11, nom: "Shevat", jours: 30 },
  { numero: 12, nom: "Adar", jours: 31 },
];

const NOMS_JOURS_SEMAINE = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

/**
 * Calcule le jour de semaine à partir du jour de l'année.
 *
 * @param jourDeAnnee Numéro du jour dans l'année (1 à 364)
 * @returns Numéro du jour de semaine (1 = Dimanche, 7 = Samedi)
 */
export function calculerJourDeSemaine(jourDeAnnee: number): number {
  return ((jourDeAnnee - 1 + 3) % 7) + 1;
}

/**
 * Calcule le mois et le jour du mois à partir du jour de l'année.
 *
 * @param jourDeAnnee Numéro du jour dans l'année (1 à 364)
 * @returns { mois, jourDuMois, nomMois, trimestre }
 */
export function calculerMoisEtJour(
  jourDeAnnee: number
): {
  mois: number;
  jourDuMois: number;
  nomMois: string;
  trimestre: number;
} {
  let joursRestants = jourDeAnnee;
  let trimestre = 1;

  for (const moisInfo of STRUCTURE_MOIS) {
    if (joursRestants <= moisInfo.jours) {
      // Trimestre = ceil(mois / 3)
      trimestre = Math.ceil(moisInfo.numero / 3);
      return {
        mois: moisInfo.numero,
        jourDuMois: joursRestants,
        nomMois: moisInfo.nom,
        trimestre,
      };
    }
    joursRestants -= moisInfo.jours;
  }

  // Ne devrait jamais arriver (364 jours au total)
  throw new Error(`Jour de l'année invalide : ${jourDeAnnee}`);
}

/**
 * Ajoute des jours à une date (sans mutation).
 */
function ajouterJours(date: Date, jours: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + jours);
  return result;
}

/**
 * Génère l'année biblique complète (364 jours).
 *
 * @param annee Année civile de début (ex: 2026 pour 2026-2027)
 * @returns Objet AnneeBiblique avec les 364 jours
 */
export function genererAnnee(annee: number): AnneeBiblique {
  const debut = calculerDebutAnnee(annee);
  const fin = calculerFinAnnee(annee);

  const jours: JourBiblique[] = [];

  for (let n = 1; n <= 364; n++) {
    const dateGregorienne = ajouterJours(debut, n - 1);
    const { mois, jourDuMois, nomMois, trimestre } = calculerMoisEtJour(n);
    const jourDeSemaine = calculerJourDeSemaine(n);
    const nomJourSemaine = NOMS_JOURS_SEMAINE[jourDeSemaine - 1];

    jours.push({
      jourDeAnnee: n,
      mois,
      nomMois,
      jourDuMois,
      jourDeSemaine,
      nomJourSemaine,
      estShabbat: jourDeSemaine === 7,
      dateGregorienne,
      trimestre,
    });
  }

  return {
    annee,
    debut,
    fin,
    jours,
  };
}

/**
 * Retourne la structure des mois (pour affichage).
 */
export function getStructureMois() {
  return STRUCTURE_MOIS;
}

/**
 * Retourne les noms des jours de la semaine.
 */
export function getNomsJoursSemaine() {
  return NOMS_JOURS_SEMAINE;
}
