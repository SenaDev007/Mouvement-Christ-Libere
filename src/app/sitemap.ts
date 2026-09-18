import type { MetadataRoute } from "next";

/**
 * ⭐ V3.93 — SITEMAP.XML (spéc SEO : « absence totale d'indexation »).
 *
 * AVANT : /sitemap.xml renvoyait 404 — Google Search Console n'avait
 * AUCUNE page déclarée à explorer, et `site:mouvementchristlibere.com`
 * restait vide.
 *
 * MAINTENANT : app/sitemap.ts génère /sitemap.xml listant toutes les
 * pages publiques stables du site (les pages dynamiques /temoignages/[id],
 * /enseignements/[id] et /live/[id] sont découvertes par les liens internes
 * puis explorées par le crawl — Google les ajoute de lui-même au fur et à
 * mesure ; les listes parentes sont ici déclarées daily/weekly pour que le
 * crawl revienne souvent chercher les nouveautés).
 *
 * ⚠️ Les back-offices ne figurent JAMAIS ici (ni admin/*, ni secretariat/*,
 * ni tresorerie/*) : le robots.ts par sous-domaine les bloque de toute
 * façon (Disallow: /).
 *
 * Après déploiement : soumettre https://www.mouvementchristlibere.com/
 * sitemap.xml dans Google Search Console (propriété de DOMAINE) et Bing
 * Webmaster Tools, puis demander l'indexation manuelle des pages
 * principales via l'inspection d'URL.
 */

const SITE = "https://www.mouvementchristlibere.com";

type EntreeSitemap = {
  chemin: string;
  priorite: number;
  frequence: "daily" | "weekly" | "monthly";
};

const PAGES: EntreeSitemap[] = [
  // Vitales (parcours du visiteur externe)
  { chemin: "/", priorite: 1.0, frequence: "daily" },
  { chemin: "/contribuer", priorite: 0.9, frequence: "monthly" },
  { chemin: "/videos", priorite: 0.9, frequence: "daily" },
  // Serviteurs
  { chemin: "/afrika", priorite: 0.9, frequence: "weekly" },
  { chemin: "/pasteur-kongo", priorite: 0.9, frequence: "weekly" },
  // Contenus (les listes mènent aux pages détaillées dynamiques)
  { chemin: "/temoignages", priorite: 0.8, frequence: "weekly" },
  { chemin: "/enseignements", priorite: 0.8, frequence: "weekly" },
  { chemin: "/adoration-louanges", priorite: 0.7, frequence: "weekly" },
  { chemin: "/annonces", priorite: 0.7, frequence: "daily" },
  // Vie du mouvement
  { chemin: "/communaute", priorite: 0.6, frequence: "monthly" },
  { chemin: "/intercession", priorite: 0.6, frequence: "weekly" },
  { chemin: "/rendez-vous", priorite: 0.7, frequence: "monthly" },
  { chemin: "/disperses", priorite: 0.6, frequence: "monthly" },
  { chemin: "/bible", priorite: 0.6, frequence: "monthly" },
  { chemin: "/calendrier-biblique", priorite: 0.6, frequence: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({
    url: `${SITE}${page.chemin === "/" ? "" : page.chemin}`,
    lastModified: new Date(),
    changeFrequency: page.frequence,
    priority: page.priorite,
  }));
}
