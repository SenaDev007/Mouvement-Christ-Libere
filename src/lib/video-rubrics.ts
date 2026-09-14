/**
 * ⭐ V3.46 — RUBRIQUES VIDÉO (partagées site public ↔ back-office)
 *
 * Demandes du pasteur :
 *  - Page Vidéos, section Afrika → rubrique « Saint-Esprit réponds-moi » ;
 *  - Section Pasteur Kongo → rubriques « Rhema du matin » et « Rhema du soir » ;
 *  - ces rubriques sont gérées depuis le back-office (module Vidéos et
 *    module Lives — le replay d'un live hérite de la rubrique du live) ;
 *  - les croyants les voient sur la page publique /videos pour les suivre.
 *
 * La rubrique est stockée dans Video.category / LiveStream.category (TEXT
 * nullable — null = catégorisation AUTOMATIQUE par mots-clés du titre,
 * comportement historique inchangé pour tout le contenu existant).
 *
 * Ce module est le SEUL point de vérité : la page publique, l'API
 * /api/videos et le back-office importent les mêmes définitions —
 * impossible de diverger.
 *
 * ⭐ V3.79 — Adoration & Louanges : catégories « Adoration » et
 * « Louanges » (page dédiée /adoration-louanges d'Afrika, chantre de
 * l'Éternel) — voir CATEGORIES_ADORATION ci-dessous.
 */

/** Rubriques signatures par serviteur (code Servant). */
export const RUBRIQUES: Record<string, string[]> = {
  afrika: ["Saint-Esprit réponds-moi"],
  kongo: ["Rhema du matin", "Rhema du soir"],
};

// ────────────────────────────────────────────────────────────────
// ⭐ V3.79 — ADORATION & LOUANGES (page dédiée d'Afrika)
// ────────────────────────────────────────────────────────────────
// Afrika est aussi ARTISTE et CHANTRE de l'Éternel : ses clips,
// adoration et louanges vivent sur une PAGE À PART ENTIÈRE
// (/adoration-louanges), avec la catégorie ADORATION d'un côté et la
// catégorie LOUANGES de l'autre — jamais mélangées sur /videos.
//
// Ces catégories ne sont PAS des rubriques signatures « classiques » :
// elles ne sont pas épinglées sur /videos (la page publique /videos les
// EXCLUT même — scission demandée par le pasteur), elles ne
// s'attribuent PAS par mots-clés (uniquement en EXPLICITE depuis le
// module dédié /admin/adoration) et le module back-office les gère
// séparément (bascule Adoration ↔ Louanges en ligne, comme RubricSelect).

/** Les deux catégories de la page Adoration & Louanges (ordre d'affichage). */
export const CATEGORIES_ADORATION: string[] = ["Adoration", "Louanges"];

/** Cette catégorie appartient-elle à la page Adoration & Louanges ? */
export function estCategorieAdoration(name: string | null | undefined): boolean {
  return !!name && CATEGORIES_ADORATION.includes(name);
}

/** Toutes les rubriques signatures, tous serviteurs (ordre d'affichage). */
export const TOUTES_RUBRIQUES: string[] = [
  "Saint-Esprit réponds-moi",
  "Rhema du matin",
  "Rhema du soir",
];

export function estRubrique(name: string | null | undefined): boolean {
  return !!name && TOUTES_RUBRIQUES.includes(name);
}

/** Rubriques d'un serviteur (vide si code inconnu — robustesse). */
export function rubriquesDe(servantCode: string | null | undefined): string[] {
  if (!servantCode) return [];
  return RUBRIQUES[servantCode] ?? [];
}

/**
 * Ordre d'affichage des catégories PAR SERVITEUR (page publique + admin) :
 * les rubriques signatures en TÊTE (elles sont la vitrine du ministère),
 * puis les catégories historiques dans leur ordre d'origine.
 */
export const CATEGORY_ORDER_AFRIKA: string[] = [
  ...RUBRIQUES.afrika,
  "Paroles & Exhortations",
  "Lives & Directs",
  "Prière & Délivrance",
  "Enseignements & Prédications",
  "Témoignages & Visions",
  "Fêtes & Shabbat",
  "Vie Pastorale",
];

export const CATEGORY_ORDER_KONGO: string[] = [
  ...RUBRIQUES.kongo,
  "Paroles & Exhortations",
  "Lives & Directs",
  "Prière & Délivrance",
  "Enseignements & Prédications",
  "Fêtes & Shabbat",
  "Discernement Spirituel",
];

/** Ordre des catégories pour un serviteur donné. */
export function categoryOrder(servantCode: string | null | undefined): string[] {
  return servantCode === "kongo" ? CATEGORY_ORDER_KONGO : CATEGORY_ORDER_AFRIKA;
}

/**
 * Options du champ « Rubrique » du back-office (formulaires Vidéos, Lives
 * et modals). La valeur vide = catégorisation automatique (par défaut).
 * Les rubriques signatures sont marquées du serviteur concerné pour
 * éviter toute confusion lors de la saisie.
 */
export const RUBRIQUE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Automatique (mots-clés du titre)" },
  { value: "Saint-Esprit réponds-moi", label: "★ Saint-Esprit réponds-moi (Afrika)" },
  { value: "Rhema du matin", label: "★ Rhema du matin (Pasteur Kongo)" },
  { value: "Rhema du soir", label: "★ Rhema du soir (Pasteur Kongo)" },
  // ⭐ V3.79 — Catégories de la page dédiée Adoration & Louanges (Afrika) :
  // assignables ici (module Vidéos) ou depuis le module dédié /admin/adoration.
  { value: "Adoration", label: "♪ Adoration (Afrika — page Adoration & Louanges)" },
  { value: "Louanges", label: "♪ Louanges (Afrika — page Adoration & Louanges)" },
  { value: "Paroles & Exhortations", label: "Paroles & Exhortations" },
  { value: "Lives & Directs", label: "Lives & Directs" },
  { value: "Prière & Délivrance", label: "Prière & Délivrance" },
  { value: "Enseignements & Prédications", label: "Enseignements & Prédications" },
  { value: "Témoignages & Visions", label: "Témoignages & Visions" },
  { value: "Fêtes & Shabbat", label: "Fêtes & Shabbat" },
  { value: "Discernement Spirituel", label: "Discernement Spirituel" },
  { value: "Vie Pastorale", label: "Vie Pastorale" },
];

/**
 * Catégorisation d'une vidéo — AV3.46 : si une rubrique/catégorie
 * EXPLICITE est posée en base (Video.category / LiveStream.category),
 * elle PRIME sur le devin par mots-clés. Sinon, comportement historique
 * exact (mêmes mots-clés, même ordre) — aucune régression possible pour
 * le contenu existant.
 */
export function categorizeVideo(
  title: string,
  servantCode: string,
  explicitCategory?: string | null
): string {
  const explicite = (explicitCategory ?? "").trim();
  if (explicite) return explicite;

  const t = (title || "").toLowerCase();
  // Les replays de lives vont dans "Lives & Directs"
  if (t.includes("replay") || t.includes("(live)")) return "Lives & Directs";
  if (servantCode === "kongo") {
    if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
    if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
    if (t.includes("fête") || t.includes("shabbat")) return "Fêtes & Shabbat";
    if (t.includes("discernement") || t.includes("occult")) return "Discernement Spirituel";
    return "Paroles & Exhortations";
  }
  if (t.includes("direct") || t.includes("en direct")) return "Lives & Directs";
  if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
  if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
  if (t.includes("témoignage") || t.includes("vision")) return "Témoignages & Visions";
  if (t.includes("shabbat") || t.includes("fête")) return "Fêtes & Shabbat";
  return "Paroles & Exhortations";
}
