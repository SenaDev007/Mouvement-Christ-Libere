/**
 * ⭐ V3.46 — RUBRIQUES VIDÉO (partagées site public ↔ back-office)
 *
 * Demandes du pasteur :
 *  - Page Vidéos, section Pam → rubrique « Saint-Esprit réponds-moi » ;
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
 */

/** Rubriques signatures par serviteur (code Servant). */
export const RUBRIQUES: Record<string, string[]> = {
  pam: ["Saint-Esprit réponds-moi"],
  kongo: ["Rhema du matin", "Rhema du soir"],
};

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
export const CATEGORY_ORDER_PAM: string[] = [
  ...RUBRIQUES.pam,
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
  return servantCode === "kongo" ? CATEGORY_ORDER_KONGO : CATEGORY_ORDER_PAM;
}

/**
 * Options du champ « Rubrique » du back-office (formulaires Vidéos, Lives
 * et modals). La valeur vide = catégorisation automatique (par défaut).
 * Les rubriques signatures sont marquées du serviteur concerné pour
 * éviter toute confusion lors de la saisie.
 */
export const RUBRIQUE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Automatique (mots-clés du titre)" },
  { value: "Saint-Esprit réponds-moi", label: "★ Saint-Esprit réponds-moi (Pam)" },
  { value: "Rhema du matin", label: "★ Rhema du matin (Pasteur Kongo)" },
  { value: "Rhema du soir", label: "★ Rhema du soir (Pasteur Kongo)" },
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
