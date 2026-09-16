/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : templates de démonstration (seed §52).
 *
 * Six templates initiaux respectant l'identité MCL (spec) :
 *   Fire Sermon · Gold Power · Royal Preacher · Cinematic Fire ·
 *   African Glory · Minimal Gold
 * (+ deux templates AFFICHE : Nuit de Délivrance, Programme).
 *
 * Chaque template = un ADN graphique (layoutConfig JSON stocké en base —
 * §19 : les positions ne sont PAS codées dans les composants React). Le
 * moteur de composition (visual-generator/composition.ts) applique cet
 * ADN aux compositions par format × variante.
 *
 * Les images réelles de production (backgrounds) sont ajoutées ensuite
 * depuis le back-office — le seed ne crée que les TEMPLATES.
 */

import { db } from "@/lib/db";
import { ensureStudioTables } from "@/lib/ensure-schema";
import type { ConfigLayout } from "@/lib/visual-generator/types";

/** ADN de base : conforme, lisible, effets mesurés. */
const BASE: ConfigLayout = {
  policeTitre: "anton",
  policeSousTitre: "montserrat-700",
  degradeTitre: false,
  sujet: { ombre: true, halo: false, luminosite: 1.04, contraste: 1.08, saturation: 1.02 },
  voile: { type: "cote", intensite: 0.8 },
  tailleTitre: 1,
};

interface DefTemplate {
  nom: string;
  description: string;
  type: "miniature" | "affiche";
  style: string;
  layout: ConfigLayout;
}

export const TEMPLATES_SEED: DefTemplate[] = [
  {
    nom: "Fire Sermon",
    description:
      "Prédication ardente — orange feu, halo lumineux derrière le serviteur, fort contraste.",
    type: "miniature",
    style: "feu-puissance",
    layout: {
      ...BASE,
      policeTitre: "anton",
      degradeTitre: false,
      sujet: { ombre: true, halo: true, luminosite: 1.05, contraste: 1.12, saturation: 1.08 },
      voile: { type: "cote", intensite: 0.85 },
    },
  },
  {
    nom: "Gold Power",
    description:
      "Noir & or majestueux — titre en dégradé doré, élégance premium du Mouvement.",
    type: "miniature",
    style: "noir-or",
    layout: {
      ...BASE,
      policeTitre: "anton",
      degradeTitre: true,
      sujet: { ombre: true, halo: true, contour: 0.012, luminosite: 1.06, contraste: 1.1 },
      voile: { type: "cote", intensite: 0.78 },
    },
  },
  {
    nom: "Royal Preacher",
    description:
      "Annonce royale — Montserrat Black, voile latéral profond, autorité de la chaire.",
    type: "miniature",
    style: "royal",
    layout: {
      ...BASE,
      policeTitre: "montserrat-900",
      degradeTitre: true,
      sujet: { ombre: true, halo: false, luminosite: 1.03, contraste: 1.06 },
      voile: { type: "cote", intensite: 0.9 },
    },
  },
  {
    nom: "Cinematic Fire",
    description:
      "Bande-annonce — Bebas Neue condensée, voile cinéma, dramatique et moderne.",
    type: "miniature",
    style: "cinematique",
    layout: {
      ...BASE,
      policeTitre: "bebas",
      degradeTitre: false,
      sujet: { ombre: true, halo: true, luminosite: 1.02, contraste: 1.15, saturation: 0.96 },
      voile: { type: "cinema", intensite: 0.75 },
      tailleTitre: 1.12,
    },
  },
  {
    nom: "African Glory",
    description:
      "Gloire africaine — Oswald robuste, lumière chaude, racines et majesté.",
    type: "miniature",
    style: "lion-feu",
    layout: {
      ...BASE,
      policeTitre: "oswald-700",
      degradeTitre: false,
      sujet: { ombre: true, halo: true, luminosite: 1.08, contraste: 1.1, saturation: 1.12 },
      voile: { type: "cote", intensite: 0.82 },
      tailleTitre: 1.05,
    },
  },
  {
    nom: "Minimal Gold",
    description:
      "Sobriété dorée — Inter lisible, voile léger, lisibilité maximale en petite taille.",
    type: "miniature",
    style: "noir-or",
    layout: {
      ...BASE,
      policeTitre: "inter-700",
      degradeTitre: false,
      sujet: { ombre: true, halo: false, luminosite: 1.02, contraste: 1.05 },
      voile: { type: "bas", intensite: 0.65 },
      tailleTitre: 0.92,
    },
  },
  {
    nom: "Nuit de Délivrance",
    description:
      "Affiche événementielle — bloc date/heure/lieu structuré, verset biblique, photo centrée.",
    type: "affiche",
    style: "feu-puissance",
    layout: {
      ...BASE,
      policeTitre: "anton",
      degradeTitre: true,
      sujet: { ombre: true, halo: true, luminosite: 1.04, contraste: 1.1 },
      voile: { type: "bas", intensite: 0.72 },
    },
  },
  {
    nom: "Programme",
    description:
      "Affiche programme — Bebas condensée, voile plein léger, plusieurs infos lisibles.",
    type: "affiche",
    style: "enseignement",
    layout: {
      ...BASE,
      policeTitre: "bebas",
      degradeTitre: false,
      sujet: { ombre: true, halo: false, luminosite: 1.02, contraste: 1.05 },
      voile: { type: "plein", intensite: 0.5 },
      tailleTitre: 1.08,
    },
  },
];

/**
 * Insère les templates s'ils n'existent pas (idempotent — appelé à
 * l'ouverture du studio et par les routes de liste).
 */
export async function ensureSeedStudio(): Promise<void> {
  await ensureStudioTables();
  const total = await db.thumbnailTemplate.count();
  if (total > 0) return;

  for (const t of TEMPLATES_SEED) {
    await db.thumbnailTemplate.create({
      data: {
        name: t.nom,
        description: t.description,
        templateType: t.type,
        styleKey: t.style,
        layoutConfig: t.layout as unknown as object,
        isActive: true,
      },
    });
  }
  console.log(`[studio/seed] ${TEMPLATES_SEED.length} templates initiaux créés ✓`);
}
