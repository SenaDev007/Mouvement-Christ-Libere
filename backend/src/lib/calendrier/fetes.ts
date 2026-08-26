/**
 * Les Fêtes de l'Éternel (Lévitique 23) sur le calendrier de 364 jours.
 *
 * Grâce à la structure fixe du calendrier (chaque date tombe sur le même
 * jour de semaine chaque année), chaque fête a une position fixe.
 *
 * Mapping complet (mathématiquement dérivé de la formule jourDeSemaine) :
 *
 * | Fête                     | Date biblique  | Jour de semaine (fixe) |
 * |--------------------------|----------------|------------------------|
 * | Tête de l'année          | 1 Aviv          | Mercredi               |
 * | Pessah (Pâque)           | 14 Aviv         | Mardi soir → Mercredi  |
 * | Pains sans levain (1er)  | 15 Aviv         | Mercredi               |
 * | Pains sans levain (7e)   | 21 Aviv         | Mardi                  |
 * | Prémices (Reshit Katzir) | 26 Aviv         | Dimanche               |
 * | Shavouot (Pentecôte)     | 15 Sivan        | Dimanche               |
 * | Yom Teroua (Trompettes)  | 1 Éthanim (7)   | Mercredi               |
 * | Yom Kippour (Expiations) | 10 Éthanim      | Vendredi               |
 * | Souccot (Tabernacles)    | 15 Éthanim      | Mercredi               |
 * | Shemini Atzeret (8e j)   | 22 Éthanim      | Mercredi               |
 * | Shabbat hebdomadaire     | Tous les 7e j.  | Samedi                 |
 */

export type CategorieFete =
  | "convocation_sainte"
  | "sabbat"
  | "jeune"
  | "nouvelle_annee";

export interface DefinitionFete {
  id: string;
  nomFr: string;
  nomHebrew: string | null;
  mois: number; // 1 à 12
  jourDuMois: number; // 1 à 31
  dureeJours: number;
  referenceEcritures: string;
  categorie: CategorieFete;
  description: string;
  travailInterdit: boolean;
  couleur: string; // hex
  jourDeSemaineFixe: number; // 1 à 7 (validé par la formule)
}

// Couleurs des fêtes (cohérentes avec le design system)
const COULEUR_PRINTEMPS = "#C9A227"; // or
const COULEUR_AUTOMNE = "#8C5FA8"; // lavande
const COULEUR_JEUNE = "#B5502F"; // terracotta
const COULEUR_TABERNACLES = "#5B7052"; // vert olive

// Les 11 fêtes de l'Éternel
export const FETES_DEFINITIONS: DefinitionFete[] = [
  {
    id: "tete_annee",
    nomFr: "Tête de l'année",
    nomHebrew: "ראש השנה",
    mois: 1,
    jourDuMois: 1,
    dureeJours: 1,
    referenceEcritures: "Exode 12:2",
    categorie: "nouvelle_annee",
    description:
      "Nouvelle année biblique. Ce jour marque le début du compte des mois selon l'Éternel (Exode 12:2). L'année commence toujours un mercredi, jour de la création des luminaires (Genèse 1:14-19).",
    travailInterdit: false,
    couleur: COULEUR_PRINTEMPS,
    jourDeSemaineFixe: 4, // Mercredi
  },
  {
    id: "pessah",
    nomFr: "Pessah (Pâque)",
    nomHebrew: "פֶּסַח",
    mois: 1,
    jourDuMois: 14,
    dureeJours: 1,
    referenceEcritures: "Lévitique 23:5",
    categorie: "convocation_sainte",
    description:
      "Sacrifice de l'agneau au crépuscule. Commémoration de la sortie d'Égypte. Accomplie en Yeshoua, l'Agneau de Dieu qui ôte le péché du monde (Jean 1:29). La Pâque commence au coucher du soleil du mardi (14 Aviv).",
    travailInterdit: false,
    couleur: COULEUR_PRINTEMPS,
    jourDeSemaineFixe: 3, // Mardi soir → Mercredi
  },
  {
    id: "matsot_1",
    nomFr: "Pains sans levain — 1er jour",
    nomHebrew: "חַג הַמַּצּוֹת",
    mois: 1,
    jourDuMois: 15,
    dureeJours: 1,
    referenceEcritures: "Lévitique 23:6-7",
    categorie: "convocation_sainte",
    description:
      "Convocation sainte, pas de travail. Les sept jours de pain sans levain qui suivent Pessah. Le levain représentant le péché, cette fête illustre la sanctification — ôter le vieux levain pour manger le pain de la pureté (1 Corinthiens 5:7-8).",
    travailInterdit: true,
    couleur: COULEUR_PRINTEMPS,
    jourDeSemaineFixe: 4, // Mercredi
  },
  {
    id: "matsot_7",
    nomFr: "Pains sans levain — 7e jour",
    nomHebrew: "חַג הַמַּצּוֹת",
    mois: 1,
    jourDuMois: 21,
    dureeJours: 1,
    referenceEcritures: "Lévitique 23:8",
    categorie: "convocation_sainte",
    description:
      "Convocation sainte, pas de travail. Dernier jour de la fête des pains sans levain. Clôture de la semaine de sanctification.",
    travailInterdit: true,
    couleur: COULEUR_PRINTEMPS,
    jourDeSemaineFixe: 3, // Mardi
  },
  {
    id: "reshit_katzir",
    nomFr: "Reshit Katzir (Prémices)",
    nomHebrew: "רֵאשִׁית קְצִיר",
    mois: 1,
    jourDuMois: 26,
    dureeJours: 1,
    referenceEcritures: "Lévitique 23:10-11",
    categorie: "convocation_sainte",
    description:
      "Offrande de la gerbe agitée, lendemain du sabbat qui suit Pessah. Accomplie en la résurrection de Yeshoua, « prémices de ceux qui sont morts » (1 Corinthiens 15:20).",
    travailInterdit: false,
    couleur: COULEUR_PRINTEMPS,
    jourDeSemaineFixe: 1, // Dimanche
  },
  {
    id: "shavouot",
    nomFr: "Shavouot (Pentecôte)",
    nomHebrew: "שָׁבוּעוֹת",
    mois: 3,
    jourDuMois: 15,
    dureeJours: 1,
    referenceEcritures: "Lévitique 23:15-16",
    categorie: "convocation_sainte",
    description:
      "50 jours exacts après Reshit Katzir. Commémoration du don de la Torah au Sinaï ET de l'effusion du Saint-Esprit à Jérusalem (Actes 2). Fête de l'alliance scellée par l'Esprit.",
    travailInterdit: true,
    couleur: COULEUR_PRINTEMPS,
    jourDeSemaineFixe: 1, // Dimanche
  },
  {
    id: "yom_teroua",
    nomFr: "Yom Teroua (Trompettes)",
    nomHebrew: "יוֹם תְּרוּעָה",
    mois: 7,
    jourDuMois: 1,
    dureeJours: 1,
    referenceEcritures: "Lévitique 23:24",
    categorie: "convocation_sainte",
    description:
      "Convocation sainte, sonnerie de trompettes. Annonce prophétique du retour du Messie : « le Seigneur lui-même descendra du ciel avec un cri, à la voix d'un archange et au son de la trompette de Dieu » (1 Thessaloniciens 4:16).",
    travailInterdit: true,
    couleur: COULEUR_AUTOMNE,
    jourDeSemaineFixe: 4, // Mercredi
  },
  {
    id: "yom_kippour",
    nomFr: "Yom Kippour (Expiations)",
    nomHebrew: "יוֹם כִּפּוּר",
    mois: 7,
    jourDuMois: 10,
    dureeJours: 1,
    referenceEcritures: "Lévitique 23:27",
    categorie: "jeune",
    description:
      "Jeûne, affliction de l'âme. Le jour le plus saint du calendrier. Accompli en Yeshoua, grand sacrificateur qui est entré une fois pour toutes dans le sanctuaire céleste avec son propre sang (Hébreux 9:12). Prophétiquement : le jour du jugement d'Israël et des nations.",
    travailInterdit: true,
    couleur: COULEUR_JEUNE,
    jourDeSemaineFixe: 6, // Vendredi
  },
  {
    id: "souccot_1",
    nomFr: "Souccot (Tabernacles) — 1er jour",
    nomHebrew: "סוּכּוֹת",
    mois: 7,
    jourDuMois: 15,
    dureeJours: 7,
    referenceEcritures: "Lévitique 23:34",
    categorie: "convocation_sainte",
    description:
      "Convocation sainte, 7 jours sous tentes. En mémoire de l'exode dans le désert. Prophétiquement : l'incarnation de Dieu parmi les hommes (« Il a tabernaclé parmi nous » Jean 1:14) et le rassemblement eschatologique des nations (Zacharie 14:16).",
    travailInterdit: true,
    couleur: COULEUR_TABERNACLES,
    jourDeSemaineFixe: 4, // Mercredi
  },
  {
    id: "shemini_atzeret",
    nomFr: "Shemini Atzeret (8e jour)",
    nomHebrew: "שְׁמִינִי עֲצֶרֶת",
    mois: 7,
    jourDuMois: 22,
    dureeJours: 1,
    referenceEcritures: "Lévitique 23:36",
    categorie: "convocation_sainte",
    description:
      "Assemblée de clôture, le 8e jour après Souccot. Jour de grande joie. Symbolise le huitième jour — l'éternité au-delà du temps créé (sept jours).",
    travailInterdit: true,
    couleur: COULEUR_TABERNACLES,
    jourDeSemaineFixe: 4, // Mercredi
  },
];

/**
 * Calcule le jour de l'année (1-364) pour une fête donnée.
 */
export function calculerJourAnneePourFete(fete: DefinitionFete): number {
  const STRUCTURE_MOIS_JOURS = [30, 30, 31, 30, 30, 31, 30, 30, 31, 30, 30, 31];
  let jourAnnee = 0;
  for (let m = 1; m < fete.mois; m++) {
    jourAnnee += STRUCTURE_MOIS_JOURS[m - 1];
  }
  jourAnnee += fete.jourDuMois;
  return jourAnnee;
}

/**
 * Calcule toutes les occurrences de fêtes pour une année biblique donnée.
 */
export interface OccurrenceFete {
  fete: DefinitionFete;
  jourAnnee: number;
  dateGregorienne: Date;
  jourDeSemaine: number;
  joursRestants: number; // depuis maintenant
}

export function calculerFetesPourAnnee(
  annee: number,
  joursAnnee: Array<{ jourDeAnnee: number; dateGregorienne: Date; jourDeSemaine: number }>,
  maintenant: Date = new Date()
): OccurrenceFete[] {
  const occurrences: OccurrenceFete[] = [];

  for (const fete of FETES_DEFINITIONS) {
    const jourAnnee = calculerJourAnneePourFete(fete);
    const jourData = joursAnnee.find((j) => j.jourDeAnnee === jourAnnee);

    if (jourData) {
      const joursRestants = Math.ceil(
        (jourData.dateGregorienne.getTime() - maintenant.getTime()) / (1000 * 60 * 60 * 24)
      );

      occurrences.push({
        fete,
        jourAnnee,
        dateGregorienne: jourData.dateGregorienne,
        jourDeSemaine: jourData.jourDeSemaine,
        joursRestants,
      });
    }
  }

  // Trier par date grégorienne
  return occurrences.sort(
    (a, b) => a.dateGregorienne.getTime() - b.dateGregorienne.getTime()
  );
}

/**
 * Retourne la prochaine fête à venir.
 */
export function prochaineFete(
  occurrences: OccurrenceFete[],
  maintenant: Date = new Date()
): OccurrenceFete | null {
  for (const occ of occurrences) {
    if (occ.dateGregorienne.getTime() >= maintenant.getTime()) {
      return occ;
    }
  }
  return null;
}
