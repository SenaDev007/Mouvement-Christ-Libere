#!/usr/bin/env node
/** Génère videos-exemple.ts avec Pam (295) + Kongo (249) = 544 vidéos */
const fs = require("fs");
const path = require("path");

const pamTitles = JSON.parse(fs.readFileSync(path.join(__dirname, "pam-youtube-titles.json"), "utf8"));
const kongoTitles = JSON.parse(fs.readFileSync(path.join(__dirname, "kongo-youtube-titles.json"), "utf8"));

function categorize(title, servant) {
  const t = title.toLowerCase();
  if (servant === "kongo") {
    if (t.includes("prière") || t.includes("délivrance") || t.includes("intercession")) return "Prière & Délivrance";
    if (t.includes("enseignement") || t.includes("prédication") || t.includes("prêche") || t.includes("enseigne")) return "Enseignements & Prédications";
    if (t.includes("fête") || t.includes("shabbat") || t.includes("pâque") || t.includes("trompette")) return "Fêtes & Shabbat";
    if (t.includes("discernement") || t.includes("occult") || t.includes("démon")) return "Discernement Spirituel";
    return "Paroles & Exhortations";
  }
  if (t.includes("direct") || t.includes("en direct")) return "Lives & Directs";
  if (t.includes("prière") || t.includes("délivrance") || t.includes("intercession")) return "Prière & Délivrance";
  if (t.includes("enseignement") || t.includes("prédication") || t.includes("prêche")) return "Enseignements & Prédications";
  if (t.includes("témoignage") || t.includes("partage") || t.includes("réveille") || t.includes("rêve") || t.includes("vision")) return "Témoignages & Visions";
  if (t.includes("shabbat") || t.includes("fête") || t.includes("pâque") || t.includes("trompette")) return "Fêtes & Shabbat";
  return "Paroles & Exhortations";
}

const catDesc = {
  "Lives & Directs": "Diffusions en direct de Pam — enseignements, prières et partages en temps réel.",
  "Prière & Délivrance": "Sessions de prière fervente, délivrance spirituelle et intercession.",
  "Enseignements & Prédications": "Enseignements bibliques approfondis et prédications.",
  "Témoignages & Visions": "Témoignages authentiques, visions célestes et révélations.",
  "Fêtes & Shabbat": "Enseignements sur les fêtes de l'Éternel et le calendrier biblique.",
  "Discernement Spirituel": "Formation au discernement des esprits et protection contre la séduction.",
  "Paroles & Exhortations": "Paroles d'exhortation, encouragements et instructions prophétiques.",
};

function makeVideos(titles, servant) {
  return titles.map((v, i) => ({
    id: `${servant}-${i + 1}`,
    youtubeId: v.id,
    title: (v.title || `Vidéo ${i+1}`).trim(),
    description: `Vidéo de ${servant === "pam" ? "Pam — Afrika Alkebulane Pamela Dali" : "Pasteur Kongo"}. ${v.title?.trim() || ""}`,
    duration: "",
    views: 0,
    publishedAt: "2024-01-01",
    category: categorize(v.title || "", servant),
    servant,
  }));
}

const pamVideos = makeVideos(pamTitles, "pam");
const kongoVideos = makeVideos(kongoTitles, "kongo");

const ts = `/**
 * VRAIES vidéos YouTube — Pam (295) + Pasteur Kongo (249) = ${pamVideos.length + kongoVideos.length} vidéos
 * Titres récupérés via YouTube oEmbed API
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

const PAM_VIDEOS: VideoItem[] = ${JSON.stringify(pamVideos, null, 2)};

const KONGO_VIDEOS: VideoItem[] = ${JSON.stringify(kongoVideos, null, 2)};

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
    description: ${JSON.stringify(catDesc)}[name] || "",
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
console.log(`Généré: Pam=${pamVideos.length}, Kongo=${kongoVideos.length}, Total=${pamVideos.length + kongoVideos.length}`);
