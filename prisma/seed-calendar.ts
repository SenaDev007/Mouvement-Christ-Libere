/**
 * Seed — Calendrier liturgique (V2)
 * Peuple la table LiturgicalEvent avec les 7 fêtes bibliques pour 2025-2026.
 * Exécuter avec : bun run db:seed:calendar
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env", override: true });

const db = new PrismaClient();

type FeastType = "SPRING_FEAST" | "FALL_FEAST" | "SHABBAT" | "NEW_MOON" | "OTHER";

interface Feast {
  name: string;
  nameFr: string;
  nameHe?: string;
  type: FeastType;
  description: string;
  startDate: string; // ISO
  endDate?: string;
  color: string;
}

// Dates grégoriennes calculées pour 2025-2026
// Source : calendrier hébraïque officiel
const FEASTS_2025_2026: Feast[] = [
  // === FÊTES DE PRINTEMPS 2025 ===
  {
    name: "Pessah",
    nameFr: "Pâque",
    nameHe: "פֶּסַח",
    type: "SPRING_FEAST",
    description:
      "Commémoration de la sortie d'Égypte. La Pâque célèbre la délivrance du peuple d'Israël de l'esclavage. Accomplie en Yeshoua, l'Agneau de Dieu qui ôte le péché du monde (Jean 1:29).",
    startDate: "2025-04-12T19:00:00Z",
    endDate: "2025-04-13T19:00:00Z",
    color: "#C9A227",
  },
  {
    name: "Matsot",
    nameFr: "Pain sans levain",
    nameHe: "מַצָּה",
    type: "SPRING_FEAST",
    description:
      "Les sept jours de pain sans levain qui suivent Pessah. Le levain représentant le péché, cette fête illustre la sanctification — ôter le vieux levain pour manger le pain de la pureté (1 Corinthiens 5:7-8).",
    startDate: "2025-04-13T19:00:00Z",
    endDate: "2025-04-20T19:00:00Z",
    color: "#C9A227",
  },
  {
    name: "Reshit",
    nameFr: "Prémices",
    nameHe: "רֵאשִׁית",
    type: "SPRING_FEAST",
    description:
      "Offrande des premiers fruits de l'orge. Accomplie en la résurrection de Yeshoua, « prémices de ceux qui sont morts » (1 Corinthiens 15:20). Tombait le lendemain du shabbat qui suit Pessah.",
    startDate: "2025-04-14T19:00:00Z",
    endDate: "2025-04-15T19:00:00Z",
    color: "#C9A227",
  },
  {
    name: "Shavouot",
    nameFr: "Pentecôte",
    nameHe: "שָׁבוּעוֹת",
    type: "SPRING_FEAST",
    description:
      "Cinquante jours après les Prémices. Commémoration du don de la Torah au Sinaï ET de l'effusion du Saint-Esprit à Jérusalem (Actes 2). Fête de l'alliance scellée par l'Esprit.",
    startDate: "2025-06-01T19:00:00Z",
    endDate: "2025-06-02T19:00:00Z",
    color: "#C9A227",
  },

  // === FÊTES D'AUTOMNE 2025 ===
  {
    name: "Yom Terouah",
    nameFr: "Fête des Trompettes",
    nameHe: "יוֹם תְּרוּעָה",
    type: "FALL_FEAST",
    description:
      "Le jour où retentit le chofar. Nouvel an civil du calendrier hébraïque (Rosh Hashana). Annonce prophétique du retour du Messie : « le Seigneur lui-même descendra du ciel avec un cri, à la voix d'un archange et au son de la trompette de Dieu » (1 Thessaloniciens 4:16).",
    startDate: "2025-09-23T19:00:00Z",
    endDate: "2025-09-24T19:00:00Z",
    color: "#8C5FA8",
  },
  {
    name: "Yom Kippour",
    nameFr: "Jour des Expiations",
    nameHe: "יוֹם כִּפּוּר",
    type: "FALL_FEAST",
    description:
      "Le jour le plus saint du calendrier. Jeûne solennel, repentance, expiation. Accompli en Yeshoua, grand sacrificateur qui est entré une fois pour toutes dans le sanctuaire céleste avec son propre sang (Hébreux 9:12). Prophétiquement : le jour du jugement d'Israël et des nations.",
    startDate: "2025-10-02T19:00:00Z",
    endDate: "2025-10-03T19:00:00Z",
    color: "#B5502F",
  },
  {
    name: "Soukkot",
    nameFr: "Fête des Tabernacles",
    nameHe: "סוּכּוֹת",
    type: "FALL_FEAST",
    description:
      "Sept jours durant lesquels on demeure dans des cabanes, en mémoire de l'exode dans le désert. Prophétiquement : l'incarnation de Dieu parmi les hommes (« Il a tabernaclé parmi nous » Jean 1:14) et le rassemblement eschatologique des nations (Zacharie 14:16).",
    startDate: "2025-10-07T19:00:00Z",
    endDate: "2025-10-14T19:00:00Z",
    color: "#5B7052",
  },

  // === FÊTES DE PRINTEMPS 2026 ===
  {
    name: "Pessah",
    nameFr: "Pâque",
    nameHe: "פֶּסַח",
    type: "SPRING_FEAST",
    description:
      "Commémoration de la sortie d'Égypte. La Pâque célèbre la délivrance du peuple d'Israël de l'esclavage. Accomplie en Yeshoua, l'Agneau de Dieu qui ôte le péché du monde (Jean 1:29).",
    startDate: "2026-04-01T19:00:00Z",
    endDate: "2026-04-02T19:00:00Z",
    color: "#C9A227",
  },
  {
    name: "Matsot",
    nameFr: "Pain sans levain",
    nameHe: "מַצָּה",
    type: "SPRING_FEAST",
    description:
      "Les sept jours de pain sans levain qui suivent Pessah. Le levain représentant le péché, cette fête illustre la sanctification — ôter le vieux levain pour manger le pain de la pureté (1 Corinthiens 5:7-8).",
    startDate: "2026-04-02T19:00:00Z",
    endDate: "2026-04-09T19:00:00Z",
    color: "#C9A227",
  },
  {
    name: "Shavouot",
    nameFr: "Pentecôte",
    nameHe: "שָׁבוּעוֹת",
    type: "SPRING_FEAST",
    description:
      "Cinquante jours après les Prémices. Commémoration du don de la Torah au Sinaï ET de l'effusion du Saint-Esprit à Jérusalem (Actes 2). Fête de l'alliance scellée par l'Esprit.",
    startDate: "2026-05-21T19:00:00Z",
    endDate: "2026-05-22T19:00:00Z",
    color: "#C9A227",
  },

  // === AUTRES FÊTES ===
  {
    name: "Pourim",
    nameFr: "Sort",
    nameHe: "פּוּרִים",
    type: "OTHER",
    description:
      "Commémoration de la délivrance du peuple juif par l'intermédiaire d'Esther, telle que racontée dans le livre d'Esther. Fête de la joie, de la délivrance et de la providence divine cachée.",
    startDate: "2025-03-14T19:00:00Z",
    endDate: "2025-03-15T19:00:00Z",
    color: "#8C5FA8",
  },
  {
    name: "Hanoucca",
    nameFr: "Dédicace",
    nameHe: "חֲנֻכָּה",
    type: "OTHER",
    description:
      "Fête des lumières, commémoration de la reconsécration du Temple après la victoire des Maccabées. Yeshoua lui-même célébrait cette fête (Jean 10:22). Symbole de la lumière qui ne s'éteint pas.",
    startDate: "2025-12-14T19:00:00Z",
    endDate: "2025-12-22T19:00:00Z",
    color: "#C9A227",
  },
];

async function main() {
  console.log("📅 Seed calendrier liturgique...");

  // Nettoyer
  await db.liturgicalEvent.deleteMany();
  console.log("  ⚠ Anciens événements supprimés");

  for (const feast of FEASTS_2025_2026) {
    await db.liturgicalEvent.create({
      data: {
        name: feast.name,
        nameFr: feast.nameFr,
        nameHe: feast.nameHe,
        type: feast.type,
        description: feast.description,
        startDate: new Date(feast.startDate),
        endDate: feast.endDate ? new Date(feast.endDate) : null,
        color: feast.color,
      },
    });
  }

  console.log(`  ✓ ${FEASTS_2025_2026.length} fêtes bibliques créées (2025-2026)`);
  console.log("\n✅ Seed calendrier terminé !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
