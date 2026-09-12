/**
 * ⭐ V3.61 — TEMPLATES INTÉGRÉS 100 % PERSONNALISABLES (style CapCut).
 * ============================================================================
 * Réponse à la demande pasteur : « est-ce qu'on ne peut pas utiliser
 * directement les templates de façon personnalisée dans notre application ? »
 *
 * VÉRITÉ FACTUELLE : les templates Mixkit (Premiere Pro .prproj, After
 * Effects .aep, Final Cut .moti, DaVinci .drp) sont des fichiers de PROJET
 * pour logiciels de montage DE BUREAU. Ils restent téléchargeables depuis la
 * Bibliothèque (onglet Templates) pour être ouverts dans ces logiciels —
 * un navigateur ne peut pas les éditer.
 *
 * L'ÉQUIVALENT DANS L'APP : chaque template ci-dessous applique une
 * COMPOSITION (textes animés + stickers + transitions + filtre + réglages)
 * entièrement construite avec NOS objets (overlays, transitions, filtres).
 * Après application, TOUT reste modifiable : texte, position, taille,
 * couleurs, fenêtre temporelle (poignées dans la timeline multi-pistes V3.61),
 * sticker remplaçable, filtre changeable. C'est le modèle CapCut : un
 * template = un point de départ éditable, pas une boîte noire.
 */

import type {
  TextOverlay, ImageOverlay, TransitionConfig, VideoFilter, ColorAdjust,
} from "./types";
import { STICKERS_V360, type StickerPro } from "./sticker-catalog";

// ─── Contrat d'application ───

export interface ResultatTemplate {
  /** Overlays à AJOUTER (textes ; les stickers passent par stickersSvg). */
  overlays: TextOverlay[];
  /** Stickers SVG du catalogue à rastériser (fait dans post-production.tsx). */
  stickersSvg: Array<{ sticker: StickerPro; x: number; y: number; scale: number; startTime?: number; endTime?: number; animation?: ImageOverlay["animation"] }>;
  /** Transitions à définir (1 par junction entre clips). */
  transitions?: TransitionConfig[];
  /** Filtre cinéma à appliquer (V3.60). */
  videoFilter?: VideoFilter;
  /** Étalonnage (presets V3.60). */
  colorAdjust?: ColorAdjust;
  /** Volume de la vidéo principale (0-1). */
  mainVolume?: number;
}

export interface TemplateIntegre {
  id: string;
  nom: string;
  description: string;
  categorie: "intro" | "outro" | "habillage" | "social";
  /** Aperçu : dégradé CSS du bouton. */
  swatch: string;
  emoji: string;
  /** Durée par défaut de la composition (pour dimensionner les fenêtres). */
  duree: number;
  build: (dureeVideo: number) => ResultatTemplate;
}

// ─── Helpers ───

const texte = (o: Partial<TextOverlay> & { content: string }): TextOverlay => ({
  id: `tpl-txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  type: "text",
  x: 50, y: 50, fontSize: 48, fontColor: "#FFFFFF",
  startTime: 0, endTime: 4,
  animation: "fade-in", animationDuration: 0.8,
  ...o,
});

const sticker = (idSticker: string): StickerPro => {
  const s = STICKERS_V360.find((x) => x.id === idSticker);
  if (!s) throw new Error(`Sticker inconnu : ${idSticker}`);
  return s;
};

// ─── Catalogue ───

export const TEMPLATES_INTEGRES: TemplateIntegre[] = [
  {
    id: "intro-titre-dore",
    nom: "Intro Titre doré",
    description: "Titre doré animé + rayons lumineux + filtre Heure dorée — cliquez puis modifiez le texte.",
    categorie: "intro",
    swatch: "linear-gradient(135deg, #ffd86b, #b8860b)",
    emoji: "🌅",
    duree: 4,
    build: (dureeVideo) => ({
      overlays: [
        texte({
          content: "TITRE DE LA VIDÉO",
          y: 42, fontSize: 64, fontColor: "#F5C518", bold: true,
          startTime: 0, endTime: Math.min(4, dureeVideo),
          animation: "fade-in", animationDuration: 1,
        }),
        texte({
          content: "Mouvement Christ Libéré",
          y: 56, fontSize: 26, fontColor: "#FFFFFF",
          startTime: 0.6, endTime: Math.min(4, dureeVideo),
          animation: "fade-in", animationDuration: 1,
        }),
      ],
      stickersSvg: [
        { sticker: sticker("light-rays"), x: 50, y: 38, scale: 0.55, startTime: 0, endTime: Math.min(4, dureeVideo) },
      ],
      videoFilter: "golden",
    }),
  },
  {
    id: "intro-gospel-cine",
    nom: "Intro Gospel cinématique",
    description: "Titre blanc + confettis + transition flash + étalonnage Cinéma.",
    categorie: "intro",
    swatch: "linear-gradient(135deg, #93c5fd, #1e3a8a)",
    emoji: "🎬",
    duree: 4,
    build: (dureeVideo) => ({
      overlays: [
        texte({
          content: "ENSEIGNEMENT",
          fontSize: 72, bold: true,
          startTime: 0, endTime: Math.min(3.5, dureeVideo),
          animation: "fade-in-out", animationDuration: 1.2,
        }),
      ],
      stickersSvg: [
        { sticker: sticker("confetti"), x: 50, y: 30, scale: 0.7, startTime: 0.4, endTime: Math.min(4, dureeVideo) },
        { sticker: sticker("star-gold"), x: 18, y: 68, scale: 0.25, startTime: 0.8, endTime: Math.min(4, dureeVideo) },
      ],
      transitions: [{ type: "fadewhite", duration: 0.8 }],
      colorAdjust: { brightness: -0.02, contrast: 1.18, saturation: 0.88, gamma: 1.02 },
    }),
  },
  {
    id: "outro-abonne-capcut",
    nom: "Outro « Abonne-toi » (CapCut)",
    description: "Boutons J'AIME + S'ABONNER + cloche + PARTAGER + texte d'appel — l'outro des YouTubeurs.",
    categorie: "outro",
    swatch: "linear-gradient(135deg, #ff2e97, #A3821C)",
    emoji: "🔔",
    duree: 6,
    build: (dureeVideo) => {
      const debut = Math.max(0, dureeVideo - 6);
      return {
        overlays: [
          texte({
            content: "ABONNEZ-VOUS !",
            y: 22, fontSize: 56, fontColor: "#FFFFFF", bold: true,
            startTime: debut, endTime: dureeVideo,
            animation: "fade-in", animationDuration: 0.5,
          }),
          texte({
            content: "Activez la cloche pour ne rien manquer",
            y: 84, fontSize: 24, fontColor: "#FDE047",
            startTime: debut + 0.4, endTime: dureeVideo,
            animation: "fade-in", animationDuration: 0.6,
          }),
        ],
        stickersSvg: [
          { sticker: sticker("like-rouge"), x: 26, y: 50, scale: 0.35, startTime: debut + 0.2, endTime: dureeVideo },
          { sticker: sticker("subscribe-rouge"), x: 50, y: 50, scale: 0.42, startTime: debut, endTime: dureeVideo },
          { sticker: sticker("bell-waves"), x: 74, y: 50, scale: 0.32, startTime: debut + 0.4, endTime: dureeVideo },
          { sticker: sticker("share-blanc"), x: 50, y: 70, scale: 0.34, startTime: debut + 0.6, endTime: dureeVideo },
        ],
      };
    },
  },
  {
    id: "lower-third",
    nom: "Bandeau-titre (lower third)",
    description: "Bulle de dialogue + nom + fonction, de 2 s à 12 s — déplaissable à la souris dans la timeline.",
    categorie: "habillage",
    swatch: "linear-gradient(135deg, #2e8b8b, #e8853d)",
    emoji: "🏷️",
    duree: 10,
    build: () => ({
      overlays: [
        texte({
          content: "Pasteur Jean Mbala",
          x: 30, y: 84, fontSize: 34, fontColor: "#FFFFFF", bold: true,
          startTime: 2, endTime: 12, animation: "fade-in", animationDuration: 0.6,
        }),
        texte({
          content: "Enseignement — Royaume de Dieu",
          x: 30, y: 91, fontSize: 20, fontColor: "#FDE047",
          startTime: 2.3, endTime: 12, animation: "fade-in", animationDuration: 0.6,
        }),
      ],
      stickersSvg: [
        { sticker: sticker("badge-soli-deo"), x: 12, y: 85, scale: 0.28, startTime: 2, endTime: 12 },
      ],
    }),
  },
  {
    id: "compte-rebours",
    nom: "Compte à rebours 5 s",
    description: "Chiffres géants 5-4-3-2-1 + étoile dorée finale + filtre VHS en option.",
    categorie: "habillage",
    swatch: "linear-gradient(135deg, #f97316, #b45309)",
    emoji: "⏱️",
    duree: 5,
    build: () => ({
      overlays: [5, 4, 3, 2, 1].map((n, i) =>
        texte({
          content: String(n),
          fontSize: 150, bold: true, fontColor: n <= 2 ? "#EF4444" : "#FFFFFF",
          startTime: i, endTime: i + 1,
          animation: "fade-in-out", animationDuration: 0.9,
        }),
      ),
      stickersSvg: [
        { sticker: sticker("burst-lines"), x: 50, y: 50, scale: 0.5, startTime: 4, endTime: 5.4 },
      ],
    }),
  },
  {
    id: "ecran-fin-louange",
    nom: "Écran de fin louange",
    description: "Anneau lumineux + étoile + « Merci d'avoir regardé » — fin douce pour les partages.",
    categorie: "outro",
    swatch: "linear-gradient(135deg, #a5f3fc, #22d3ee)",
    emoji: "✨",
    duree: 5,
    build: (dureeVideo) => {
      const debut = Math.max(0, dureeVideo - 5);
      return {
        overlays: [
          texte({
            content: "Merci d'avoir regardé",
            y: 30, fontSize: 48, bold: true,
            startTime: debut, endTime: dureeVideo,
            animation: "fade-in", animationDuration: 1,
          }),
          texte({
            content: "Partagez cette vidéo autour de vous",
            y: 40, fontSize: 22, fontColor: "#FDE047",
            startTime: debut + 0.5, endTime: dureeVideo,
            animation: "fade-in", animationDuration: 1,
          }),
        ],
        stickersSvg: [
          { sticker: sticker("glow-ring"), x: 50, y: 55, scale: 0.6, startTime: debut, endTime: dureeVideo },
          { sticker: sticker("star-gold"), x: 50, y: 55, scale: 0.3, startTime: debut + 0.3, endTime: dureeVideo },
          { sticker: sticker("hearts-confetti"), x: 50, y: 20, scale: 0.5, startTime: debut + 0.8, endTime: dureeVideo },
        ],
      };
    },
  },
  {
    id: "intro-vhs-retro",
    nom: "Intro VHS rétro",
    description: "Filtre VHS + titre rétro + transition glitch — parfait pour les clips mémoriels.",
    categorie: "intro",
    swatch: "linear-gradient(135deg, #DDBE55, #FF7A1A)",
    emoji: "📼",
    duree: 3,
    build: (dureeVideo) => ({
      overlays: [
        texte({
          content: "RÉTRO 1990",
          fontSize: 60, fontColor: "#F0E9DE", bold: true,
          startTime: 0, endTime: Math.min(3, dureeVideo),
          animation: "fade-in", animationDuration: 0.7,
        }),
      ],
      stickersSvg: [
        { sticker: sticker("arrow-fat-right"), x: 82, y: 20, scale: 0.3, startTime: 0.5, endTime: Math.min(3, dureeVideo) },
      ],
      transitions: [{ type: "glitch", duration: 0.6 }],
      videoFilter: "vhs",
    }),
  },
  {
    id: "habillage-social",
    nom: "Habillage réseaux sociaux",
    description: "Boutons like + partage + vues disposés à droite — incrustation permanente style live.",
    categorie: "social",
    swatch: "linear-gradient(135deg, #ff9a8b, #DDBE55)",
    emoji: "📱",
    duree: 15,
    build: (dureeVideo) => {
      const fin = Math.min(15, dureeVideo);
      return {
        overlays: [
          texte({
            content: "En direct",
            x: 88, y: 10, fontSize: 18, fontColor: "#FFFFFF", bgColor: "#E11D48", bold: true,
            startTime: 0, endTime: fin, animation: "fade-in", animationDuration: 0.4,
          }),
        ],
        stickersSvg: [
          { sticker: sticker("like-rouge"), x: 88, y: 30, scale: 0.16, startTime: 0, endTime: fin },
          { sticker: sticker("share-blanc"), x: 88, y: 44, scale: 0.16, startTime: 0, endTime: fin },
          { sticker: sticker("views-count"), x: 88, y: 58, scale: 0.16, startTime: 0, endTime: fin },
        ],
      };
    },
  },
];

export const templatesParCategorie = (cat: TemplateIntegre["categorie"]) =>
  TEMPLATES_INTEGRES.filter((t) => t.categorie === cat);

export const CATEGORIES_TEMPLATES: { id: TemplateIntegre["categorie"]; nom: string }[] = [
  { id: "intro", nom: "Intros" },
  { id: "outro", nom: "Outros" },
  { id: "habillage", nom: "Habillage" },
  { id: "social", nom: "Réseaux sociaux" },
];
