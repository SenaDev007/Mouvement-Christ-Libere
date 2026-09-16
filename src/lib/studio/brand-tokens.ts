/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : brand tokens de l'identité visuelle.
 *
 * Système centralisé de variables graphiques du Mouvement CHRIST LIBERE
 * (spécification §41) : noir profond, or/doré, orange feu, rouge feu,
 * blanc — forte contrainte de contraste. Les templates réutilisent ces
 * valeurs : AUCUNE couleur en dur dans le moteur de composition.
 *
 * Direction artistique : premium + forte + spirituelle + moderne +
 * cinématographique + africaine. Éviter : dégradés bon marché, effets
 * excessifs, surcharge décorative.
 */

export const BRAND = {
  colors: {
    black: "#050505",
    blackDeep: "#0A0A0C",
    gold: "#D4AF37",
    goldLight: "#F0D98C",
    goldDark: "#8C6D1F",
    fireOrange: "#FF6A00",
    fireRed: "#B3261E",
    white: "#FFFFFF",
    ivory: "#FAF6EF",
    purple: "#2A0E3D",
  },
  /** Dégradés signature (usage mesuré — jamais « bon marché »). */
  gradients: {
    // ⭐ Leçon VLM : pas de stop trop sombre — le titre doré doit rester
    // CONTRASTÉ sur fond noir (lisibilité en plein soleil mobile).
    goldShimmer: ["#F7E7B0", "#E8C766", "#D4AF37"],
    fireHot: ["#FF6A00", "#B3261E"],
    nightFade: ["rgba(5,5,5,0)", "rgba(5,5,5,0.92)"],
    sideShade: ["rgba(5,5,5,0)", "rgba(5,5,5,0.55)"],
  },
  /** Marge de sécurité relative (le texte/logo ne sort JAMAIS de là). */
  safeMargin: 0.045,
  /** Logo officiel (chemin statique public — jamais déformé). */
  logo: {
    path: "/logo-christ-libere-v3.png",
    /** Hauteur relative du logo par rapport à la hauteur du canvas. */
    heightRatio: 0.072,
    /** Marge de sécurité autour du logo (× hauteur du logo). */
    clearSpace: 0.45,
  },
} as const;

/** Styles prédéfinis proposés à l'utilisateur (spec §6.3 — administrables). */
export interface StyleStudio {
  key: string;
  label: string;
  /** Couleur d'accent principale (titre clé). */
  accent: string;
  /** Couleur secondaire (texte du message). */
  secondary: string;
  /** Couleur de fond de secours (si pas de background). */
  background: string;
  /** Trait d'ambiance courts pour la galerie. */
  ambiance: string;
}

export const STYLES_STUDIO: StyleStudio[] = [
  {
    key: "feu-puissance",
    label: "Feu & Puissance",
    accent: "#FF6A00",
    secondary: "#FFFFFF",
    background: "#0A0A0C",
    ambiance: "Flammes, lumière chaude, force spirituelle",
  },
  {
    key: "noir-or",
    label: "Noir & Or",
    accent: "#D4AF37",
    secondary: "#F0D98C",
    background: "#050505",
    ambiance: "Élégance royale, majesté, précieux",
  },
  {
    key: "royal",
    label: "Royal",
    accent: "#C9A227",
    secondary: "#FAF6EF",
    background: "#141009",
    ambiance: "Couronne, dignité, souveraineté",
  },
  {
    key: "cinematique",
    label: "Cinématique",
    accent: "#F0D98C",
    secondary: "#FFFFFF",
    background: "#0D0D10",
    ambiance: "Bande-annonce, dramatique, contraste profond",
  },
  {
    key: "lion-feu",
    label: "Lion de Feu",
    accent: "#FF6A00",
    secondary: "#FFD9A8",
    background: "#120A05",
    ambiance: "Lion de Juda, courage, autorité",
  },
  {
    key: "aigle-feu",
    label: "Aigle de Feu",
    accent: "#FF8C1A",
    secondary: "#FFFFFF",
    background: "#0B0B12",
    ambiance: "Vision, élévation, prophétique",
  },
  {
    key: "predication",
    label: "Prédication",
    accent: "#D4AF37",
    secondary: "#FAF6EF",
    background: "#100E08",
    ambiance: "Chaire, vérité, parole vivante",
  },
  {
    key: "enseignement",
    label: "Enseignement",
    accent: "#E8C766",
    secondary: "#FFFFFF",
    background: "#0F1116",
    ambiance: "Clarté, profondeur, méthode",
  },
  {
    key: "live",
    label: "Live",
    accent: "#B3261E",
    secondary: "#FFFFFF",
    background: "#0A0505",
    ambiance: "Direct, urgence, « EN DIRECT »",
  },
  {
    key: "temoignage",
    label: "Témoignage",
    accent: "#C9A227",
    secondary: "#FAF6EF",
    background: "#12100A",
    ambiance: "Vie transformée, gratitude",
  },
];

/** Résout un style par sa clé (défaut : Noir & Or).
 * ⭐ V3.91 — palette LIBRE : si `perso` est fourni (sélecteurs ou
 * Directeur IA), ses couleurs REMPLACENT celles du style — n'importe
 * quelle palette devient possible (« choisir la palette qu'on veut »). */
export function styleStudio(
  key: string,
  perso?: { accent?: string; secondary?: string; background?: string }
): StyleStudio {
  const base = STYLES_STUDIO.find((s) => s.key === key) || STYLES_STUDIO[1];
  if (!perso || (!perso.accent && !perso.secondary && !perso.background)) {
    return base;
  }
  return {
    key: `perso:${base.key}`,
    label: "Palette personnalisée",
    accent: perso.accent || base.accent,
    secondary: perso.secondary || base.secondary,
    background: perso.background || base.background,
    ambiance: "Palette libre (directeur IA ou sélecteurs)",
  };
}
