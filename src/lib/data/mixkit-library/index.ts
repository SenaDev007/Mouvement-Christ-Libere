/**
 * ⭐ V3.59 — Bibliothèque Mixkit intégrée à la post-production.
 *
 * Catalogue construit par `scripts/scrape-mixkit-library.mjs` (métadonnées
 * uniquement — les médias restent sur le CDN Mixkit, licence libre de droits
 * sans attribution : https://mixkit.co/license/).
 *
 * 4 fichiers JSON chargés PAPEARSEUSEMENT (un import dynamique par onglet)
 * pour ne pas alourdir le bundle initial :
 *   - sfx.json       465 effets sonores (16 catégories)
 *   - music.json     759 musiques (103 collections/genres)
 *   - videos.json    258 vidéos stock (14 catégories)
 *   - templates.json 313 templates (Premiere Pro, After Effects,
 *                     Final Cut Pro, DaVinci Resolve)
 */

// ─── Types (clés courtes pour limiter le poids du bundle) ───

export interface MixkitSfx {
  id: string;
  n: string; // nom
  d: number | null; // durée (s)
  p: string; // preview mp3 (pleine longueur)
  w: string; // WAV pleine qualité
  c: string; // slug catégorie
  cl: string; // libellé catégorie (fr)
}

export interface MixkitMusic {
  id: string;
  n: string;
  d: number | null;
  p: string; // mp3 (preview = téléchargement pour la musique)
  g: string; // slug genre
  gl: string; // libellé genre
}

export interface MixkitVideo {
  id: string;
  n: string;
  p: string; // preview mp4 360p
  th: string | null; // miniature jpg
  f: string; // mp4 1080p
  u: string | null; // page Mixkit
  c: string; // slug catégorie
  cl: string; // libellé catégorie (fr)
}

export interface MixkitTemplate {
  id: string;
  n: string;
  s: string; // premiere-pro | after-effects | final-cut-pro | davinci-resolve
  sl: string; // libellé logiciel
  k: string; // ex: "Premiere Pro / mogrt"
  x: string; // description
  p: string; // preview mp4 360p
  th: string | null;
  z: string; // zip du template
  u: string | null; // page Mixkit
  c: string; // sous-catégorie
  cl: string; // libellé sous-catégorie (fr)
}

// ─── Chargement paresseux (un chunk par type) ───

let cacheSfx: MixkitSfx[] | null = null;
let cacheMusic: MixkitMusic[] | null = null;
let cacheVideos: MixkitVideo[] | null = null;
let cacheTemplates: MixkitTemplate[] | null = null;

export async function chargerSfx(): Promise<MixkitSfx[]> {
  if (cacheSfx) return cacheSfx;
  const mod = await import("./sfx.json");
  cacheSfx = (mod.default as unknown) as MixkitSfx[];
  return cacheSfx;
}

export async function chargerMusiques(): Promise<MixkitMusic[]> {
  if (cacheMusic) return cacheMusic;
  const mod = await import("./music.json");
  cacheMusic = (mod.default as unknown) as MixkitMusic[];
  return cacheMusic;
}

export async function chargerVideos(): Promise<MixkitVideo[]> {
  if (cacheVideos) return cacheVideos;
  const mod = await import("./videos.json");
  cacheVideos = (mod.default as unknown) as MixkitVideo[];
  return cacheVideos;
}

export async function chargerTemplates(): Promise<MixkitTemplate[]> {
  if (cacheTemplates) return cacheTemplates;
  const mod = await import("./templates.json");
  cacheTemplates = (mod.default as unknown) as MixkitTemplate[];
  return cacheTemplates;
}

// ─── Libellés des catégories (ordre d'affichage) ───

/** Catégories SFX, dans l'ordre demandé puis bonus. */
export const CATEGORIES_SFX: { slug: string; label: string; icone: string }[] = [
  { slug: "warfare", label: "Guerre", icone: "💥" },
  { slug: "human", label: "Humain", icone: "🧑" },
  { slug: "transport", label: "Transport", icone: "🚗" },
  { slug: "animals", label: "Animaux", icone: "🦁" },
  { slug: "notification", label: "Notifications", icone: "🔔" },
  { slug: "funny", label: "Drôle", icone: "😂" },
  { slug: "technology", label: "Technologie", icone: "💻" },
  { slug: "nature", label: "Nature", icone: "🌲" },
  { slug: "instrument", label: "Instruments", icone: "🎸" },
  { slug: "game", label: "Jeux", icone: "🎮" },
  { slug: "glitch", label: "Glitch", icone: "📺" },
  { slug: "voice", label: "Voix", icone: "🗣️" },
  { slug: "drone", label: "Drone", icone: "🛸" },
  { slug: "ambience", label: "Ambiances", icone: "🌫️" },
  { slug: "alarm", label: "Alarmes", icone: "🚨" },
  { slug: "arcade", label: "Arcade", icone: "🕹️" },
];

export const LOGICIELS_TEMPLATES: { slug: string; label: string; icone: string }[] = [
  { slug: "premiere-pro", label: "Premiere Pro", icone: "🎬" },
  { slug: "after-effects", label: "After Effects", icone: "✨" },
  { slug: "final-cut-pro", label: "Final Cut Pro", icone: "🍎" },
  { slug: "davinci-resolve", label: "DaVinci Resolve", icone: "🎛️" },
];

export const SOUS_CATS_TEMPLATES: { slug: string; label: string }[] = [
  { slug: "populaires", label: "Populaires" },
  { slug: "titles", label: "Titres" },
  { slug: "transitions", label: "Transitions" },
  { slug: "lower-thirds", label: "Tiers inférieurs" },
  { slug: "openers", label: "Intros" },
  { slug: "logo", label: "Logos" },
  { slug: "slideshow", label: "Diaporamas" },
  { slug: "social-media", label: "Réseaux sociaux" },
  { slug: "countdown", label: "Comptes à rebours" },
];

export const CATEGORIES_VIDEOS: { slug: string; label: string; icone: string }[] = [
  { slug: "populaires", label: "Populaires", icone: "🔥" },
  { slug: "nature", label: "Nature", icone: "🌲" },
  { slug: "worship", label: "Louange", icone: "🙏" },
  { slug: "city", label: "Villes", icone: "🏙️" },
  { slug: "people", label: "Personnes", icone: "🧑‍🤝‍🧑" },
  { slug: "business", label: "Business", icone: "💼" },
  { slug: "technology", label: "Technologie", icone: "💻" },
  { slug: "background", label: "Fonds", icone: "🖼️" },
  { slug: "abstract", label: "Abstrait", icone: "🌀" },
  { slug: "fire", label: "Feu", icone: "🔥" },
  { slug: "water", label: "Eau", icone: "💧" },
  { slug: "earth", label: "Terre", icone: "🌍" },
  { slug: "space", label: "Espace", icone: "🚀" },
  { slug: "forest", label: "Forêt", icone: "🌳" },
];

// ─── Helpers ───

/** Formate des secondes en "m:ss" ou "h:mm:ss". */
export function formaterDuree(s: number | null | undefined): string {
  if (s == null || Number.isNaN(s)) return "";
  const sec = Math.round(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Liens de recherche Pixabay par type (licence Pixabay, téléchargement manuel). */
export const PIXABAY_RECHERCHE = {
  sfx: "https://pixabay.com/sound-effects/",
  music: "https://pixabay.com/music/",
  video: "https://pixabay.com/videos/",
} as const;

/** Compte total d'items (affiché dans l'onglet). */
export const NB_TOTAL_BIBLIOTHEQUE = 465 + 759 + 258 + 313;
