/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : types partagés du moteur de composition.
 *
 * ⚠️ Ce fichier est importé CÔTÉ CLIENT (aperçu, formulaires) et côté
 * serveur (rendu) : AUCUN import serveur (canvas, fs, prisma…).
 *
 * Principes (spécification §2/§19/§20) :
 *  · l'utilisateur ne gère JAMAIS de coordonnées x/y ;
 *  · les templates définissent l'ADN graphique (polices, effets, voiles) ;
 *  · le moteur applique des COMPOSITIONS par format × variante
 *    (paysage / portrait / carré ne partagent pas les mêmes zones — §18) ;
 *  · les couleurs passent par des JETONS (accent, secondary…) résolus
 *    par le style choisi (§41 brand tokens).
 */

// ─── Types de visuels & formats ────────────────────────────────────────

export type TypeVisuel = "miniature" | "affiche";

/** Clés des formats exportables (spec §8 / §17). */
export type CleFormat =
  | "youtube" // miniature 1280×720 (16:9)
  | "square" // miniature 1080×1080 (1:1)
  | "reels" // miniature 1080×1920 (9:16 — Reels/Shorts/TikTok)
  | "instagram" // affiche 1080×1350 (portrait 4:5)
  | "story" // affiche 1080×1920 (9:16 — Story/WhatsApp)
  | "print"; // affiche A4 2480×3508 (300 DPI)

export type CleVariante = "A" | "B" | "C" | "D";

/** Polices enregistrées dans le moteur (fichiers TTF locaux — §9). */
export type ClePolice =
  | "anton"
  | "bebas"
  | "oswald-600"
  | "oswald-700"
  | "montserrat-700"
  | "montserrat-800"
  | "montserrat-900"
  | "inter-400"
  | "inter-700"
  | "poppins-600";

/** Jetons de couleur résolus par le style (brand tokens §41). */
export type JetonCouleur =
  | "accent"
  | "secondary"
  | "white"
  | "black"
  | "ivory"
  | "gold"
  | "goldLight"
  | "fireOrange";

// ─── Effets du sujet (photo intervenant — §13) ─────────────────────────

export interface EffetsSujet {
  /** Ombre portée derrière le sujet. */
  ombre?: boolean;
  /** Halo lumineux (glow) aux couleurs du style. */
  halo?: boolean;
  /** Contour lumineux (largeur relative, 0/défini = aucun). */
  contour?: number;
  /** Luminosité (1 = neutre). */
  luminosite?: number;
  /** Contraste (1 = neutre). */
  contraste?: number;
  /** Saturation (1 = neutre). */
  saturation?: number;
}

// ─── Voile de lisibilité entre fond et sujet/texte (§15) ───────────────

export type TypeVoile = "aucun" | "bas" | "cote" | "plein" | "cinema";

export interface ConfigVoile {
  type: TypeVoile;
  /** Intensité 0-1 (couleur : noir profond du brand). */
  intensite: number;
}

// ─── ADN graphique stocké dans le template (layoutConfig JSON) ─────────

export interface ConfigLayout {
  /** Police du titre (headline niveau 1-2). */
  policeTitre: ClePolice;
  /** Police du sous-titre / intervenant (niveau 3). */
  policeSousTitre: ClePolice;
  /** Titre en dégradé doré (si couleur = accent). */
  degradeTitre?: boolean;
  /** Effets appliqués à la photo de l'intervenant. */
  sujet: EffetsSujet;
  /** Voile de lisibilité au-dessus du fond. */
  voile: ConfigVoile;
  /** Taille relative du titre (1 = taille standard du format). */
  tailleTitre?: number;
  /**
   * Overrides par famille de format — chaque template PEUT affiner
   * (ex. police plus grande en paysage). Fusion profonde sur la
   * composition calculée par le moteur.
   */
  overrides?: {
    paysage?: Partial<ConfigLayout>;
    portrait?: Partial<ConfigLayout>;
    carre?: Partial<ConfigLayout>;
  };
}

// ─── Données d'une génération ──────────────────────────────────────────

export interface DonneesVisuel {
  type: TypeVisuel;
  /** Titre complet (ex. « Comment vaincre les attaques de l'ennemi ? »). */
  titre: string;
  /** Accroche miniature (ex. « VAINCRE LES ATTAQUES DE L'ENNEMI ! ») —
   *  si vide, le titre est utilisé (§6.1). */
  accroche?: string;
  /** Sous-titre (intervenant, ex. « Pasteur Kongo »). */
  sousTitre?: string;
  /** Nom de l'intervenant affiché (Kongo & Pam → deux photos). */
  intervenant?: "kongo" | "pam" | "kongo-pam" | "aucun";
  /** URL de la photo détourée (préférée) ou originale. */
  photoUrl?: string;
  /** ⭐ La photo est-elle un PNG DÉTOURÉ (transparent) ? true → la photo
   *  est contenue dans sa zone (silhouette) ; false (photo opaque) →
   *  couverture pleine de la zone (crop), rendu propre sans bandes. */
  photoDecoupee?: boolean;
  /** URL du fond de la bibliothèque (vide = fond généré par le style). */
  fondUrl?: string;
  /** Style choisi (clé STYLES_STUDIO). */
  style: string;
  /** Clé du template en base (le moteur y lit l'ADN graphique). */
  templateId?: string;
  /** Champs événementiels (affiches — §16). */
  dateEvenement?: string; // 2026-10-18
  heureEvenement?: string; // 19h00
  lieuEvenement?: string; // Cotonou
  verset?: string; // Ésaïe 61:1
  description?: string;
}

// ─── Résultat d'un rendu ──────────────────────────────────────────────

export interface ResultatFormat {
  format: CleFormat;
  largeur: number;
  hauteur: number;
  /** URL publique R2 (après upload) OU data URL (aperçu local). */
  url: string;
  octets?: number;
}

export interface DefinitionFormat {
  cle: CleFormat;
  libelle: string;
  largeur: number;
  hauteur: number;
  famille: "paysage" | "portrait" | "carre";
  /** Formats autorisés par type de visuel. */
  types: TypeVisuel[];
  description: string;
}

/** Définitions des formats (spec §8 / §17). */
export const FORMATS: Record<CleFormat, DefinitionFormat> = {
  youtube: {
    cle: "youtube",
    libelle: "YouTube",
    largeur: 1280,
    hauteur: 720,
    famille: "paysage",
    types: ["miniature"],
    description: "Miniature 16:9 — YouTube, Facebook, site",
  },
  square: {
    cle: "square",
    libelle: "Carré",
    largeur: 1080,
    hauteur: 1080,
    famille: "carre",
    types: ["miniature"],
    description: "Carré 1:1 — fil Facebook, Instagram",
  },
  reels: {
    cle: "reels",
    libelle: "Reels / TikTok",
    largeur: 1080,
    hauteur: 1920,
    famille: "portrait",
    types: ["miniature"],
    description: "Vertical 9:16 — Shorts, Reels, TikTok",
  },
  instagram: {
    cle: "instagram",
    libelle: "Instagram portrait",
    largeur: 1080,
    hauteur: 1350,
    famille: "portrait",
    types: ["affiche"],
    description: "Portrait 4:5 — publications Instagram",
  },
  story: {
    cle: "story",
    libelle: "Story / WhatsApp",
    largeur: 1080,
    hauteur: 1920,
    famille: "portrait",
    types: ["affiche"],
    description: "Vertical 9:16 — Story, statut WhatsApp",
  },
  print: {
    cle: "print",
    libelle: "A4 (impression)",
    largeur: 2480,
    hauteur: 3508,
    famille: "portrait",
    types: ["affiche"],
    description: "A4 300 DPI — impression",
  },
};

/** Formats par défaut selon le type de visuel. */
export const FORMATS_PAR_DEFAUT: Record<TypeVisuel, CleFormat[]> = {
  miniature: ["youtube", "square", "reels"],
  affiche: ["instagram", "story", "print"],
};

/** Nom de fichier normalisé (spec §27 — mcl-puissance-priere-youtube.png). */
export function nomFichierVisuel(
  titre: string,
  format: CleFormat,
  variante: CleVariante
): string {
  const base = titre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60) || "visuel";
  return `mcl-${base}-${format.toLowerCase()}-${variante.toLowerCase()}.png`;
}
