/**
 * Modes d'export PDF du calendrier biblique — module LÉGER partagé
 * (client + serveur). Le moteur pdf-lib lourd reste dans generer-pdf.ts
 * (serveur uniquement) ; l'UI importe d'ici pour ne pas embarquer
 * pdf-lib ni les polices dans le bundle client.
 */

export type ModePdfCalendrier = "mois" | "trimestre" | "annee";

export const MODES_PDF: Array<{
  id: ModePdfCalendrier;
  titre: string;
  detail: string;
}> = [
  {
    id: "mois",
    titre: "Par mois",
    detail: "12 planches — un mois par page, avec le détail des fêtes",
  },
  {
    id: "trimestre",
    titre: "Par trimestre",
    detail: "4 planches — les 3 mois du trimestre côte à côte",
  },
  {
    id: "annee",
    titre: "Toute l'année",
    detail: "Vue d'ensemble des 12 mois + table des fêtes de l'Éternel",
  },
];
