#!/usr/bin/env node
/**
 * Génère le fichier videos-exemple.ts avec les vraies données YouTube de Pam
 */
const fs = require("fs");
const path = require("path");

const titles = JSON.parse(fs.readFileSync(path.join(__dirname, "pam-youtube-titles.json"), "utf8"));

// Catégoriser selon les mots-clés dans le titre
function categorize(title) {
  const t = title.toLowerCase();
  if (t.includes("direct") || t.includes("en direct")) return "Lives & Directs";
  if (t.includes("prière") || t.includes("délivrance") || t.includes("intercession")) return "Prière & Délivrance";
  if (t.includes("enseignement") || t.includes("prédication") || t.includes("prêche") || t.includes("enseigne")) return "Enseignements & Prédications";
  if (t.includes("témoignage") || t.includes("partage") || t.includes("réveille") || t.includes("rêve") || t.includes("vision")) return "Témoignages & Visions";
  if (t.includes("shabbat") || t.includes("fête") || t.includes("pâque") || t.includes("trompette")) return "Fêtes & Shabbat";
  return "Paroles & Exhortations";
}

const categoryDescriptions = {
  "Lives & Directs": "Diffusions en direct de Pam — enseignements, prières et partages en temps réel avec la communauté.",
  "Prière & Délivrance": "Sessions de prière fervente, délivrance spirituelle et intercession pour les âmes et les nations.",
  "Enseignements & Prédications": "Enseignements bibliques approfondis et prédications sur les fondements de la foi en Yeshua HaMashiach.",
  "Témoignages & Visions": "Témoignages authentiques, visions célestes et révélations reçues du Seigneur par Pam.",
  "Fêtes & Shabbat": "Enseignements sur les fêtes de l'Éternel, la sanctification du Shabbat et le calendrier biblique.",
  "Paroles & Exhortations": "Paroles d'exhortation, encouragements et instructions prophétiques pour le peuple de Dieu.",
};

// Construire les vidéos
const videos = titles.map((v, i) => ({
  id: `pam-${i + 1}`,
  youtubeId: v.id,
  title: v.title.trim() || `Vidéo ${i + 1}`,
  description: `Vidéo de Pam — ${v.title.trim()}. Enseignement, témoignage ou prière diffusé sur la chaîne YouTube de Afrika Alkebulane Pamela Dali.`,
  duration: "",
  views: 0,
  publishedAt: "2024-01-01",
  category: categorize(v.title),
  servant: "pam",
}));

// Grouper par catégorie
const categoriesMap = new Map();
for (const video of videos) {
  if (!categoriesMap.has(video.category)) {
    categoriesMap.set(video.category, []);
  }
  categoriesMap.get(video.category).push(video);
}

const categories = Array.from(categoriesMap.entries()).map(([name, vids], i) => ({
  id: `pam-cat-${i}`,
  name,
  description: categoryDescriptions[name] || "",
  servant: "pam",
  videos: vids,
}));

// Générer le fichier TypeScript
const ts = `/**
 * VRAIES vidéos YouTube de Pam (Afrika Alkebulane Pamela Dali)
 * ${videos.length} vidéos récupérées via YouTube oEmbed
 * Catégorisées automatiquement par mots-clés dans le titre
 *
 * Source : liens fournis par l'utilisateur (295 vidéos)
 */

export interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  duration: string;
  views: number;
  publishedAt: string;
  category: string;
  servant: "pam" | "kongo";
}

export interface VideoCategory {
  id: string;
  name: string;
  description: string;
  servant: "pam" | "kongo";
  videos: VideoItem[];
}

// ============================================================
// VIDÉOS DE PAM (${videos.length} vidéos, ${categories.length} catégories)
// ============================================================

const PAM_VIDEOS: VideoItem[] = ${JSON.stringify(videos, null, 2)};

// ============================================================
// VIDÉOS DU PASTEUR KONGO (à venir)
// ============================================================

const KONGO_VIDEOS: VideoItem[] = [];

// ============================================================
// FONCTIONS
// ============================================================

export function getCategoriesByServant(servant: "pam" | "kongo"): VideoCategory[] {
  const vids = servant === "pam" ? PAM_VIDEOS : KONGO_VIDEOS;
  const catsMap = new Map<string, VideoItem[]>();
  for (const v of vids) {
    if (!catsMap.has(v.category)) catsMap.set(v.category, []);
    catsMap.get(v.category)!.push(v);
  }
  return Array.from(catsMap.entries()).map(([name, vs], i) => ({
    id: \`\${servant}-cat-\${i}\`,
    name,
    description: ${JSON.stringify(categoryDescriptions)}[name] || "",
    servant,
    videos: vs,
  }));
}

export function getAllVideos(): VideoItem[] {
  return [...PAM_VIDEOS, ...KONGO_VIDEOS];
}

export function getVideoById(id: string): VideoItem | undefined {
  return getAllVideos().find((v) => v.id === id);
}
`;

fs.writeFileSync(path.join(__dirname, "..", "src", "lib", "data", "videos-exemple.ts"), ts);
console.log(`Fichier généré : ${videos.length} vidéos, ${categories.length} catégories`);
categories.forEach(c => console.log(`  - ${c.name}: ${c.videos.length} vidéos`));
