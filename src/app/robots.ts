import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * ⭐ V3.93 — robots.txt DYNAMIQUE PAR SOUS-DOMAINE (spéc SEO).
 *
 * AVANT : un fichier public/robots.txt UNIQUE était servi tel quel sur
 * les QUATRE points d'entrée — admin.mouvementchristlibere.com,
 * secretariat.… et tresorerie.… répondaient « Allow: / » : les back-offices
 * étaient donc explicitement INVITÉS au crawl (l'en-tête X-Robots-Tag
 * noindex existait, mais robots.txt est la première porte que Google lit).
 *
 * MAINTENANT (app/robots.ts remplace public/robots.txt) :
 *  · www.mouvementchristlibere.com (et tout hôte public) :
 *      User-agent: * / Allow: / + déclaration du sitemap.xml.
 *  · admin / secretariat / tresorerie.<domaine> :
 *      User-agent: * / Disallow: /  → aucun crawl des espaces internes,
 *      ni des /admin/*, /secretariat/*, /tresorerie/* servis sur www.
 *      (belt & suspenders avec l'en-tête X-Robots-Tag de next.config.ts).
 *
 * L'hôte d'origine est préservé par le proxy Cloudflare → Vercel
 * (cf. src/proxy.ts) : headers().get("host") reflète le sous-domaine réel.
 * En dev (localhost), le comportement public s'applique.
 */

const SITE_PUBLIC = "https://www.mouvementchristlibere.com";
const SOUS_DOMAINES_ESPACE = new Set(["admin", "secretariat", "tresorerie"]);

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = (
    h.get("x-forwarded-host") ||
    h.get("host") ||
    ""
  )
    .split(",")[0]
    .split(":")[0]
    .toLowerCase();

  const sousDomaine = host.split(".")[0];

  // ── Back-offices : jamais crawlés, jamais indexés ──
  if (SOUS_DOMAINES_ESPACE.has(sousDomaine)) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  // ── Site public : indexation complète + sitemap ──
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Pages privées du site public elles-mêmes (login/inscription) :
        // aucun intérêt dans les résultats de recherche.
        disallow: ["/login", "/register", "/profil", "/coffre-fort", "/api/"],
      },
    ],
    sitemap: `${SITE_PUBLIC}/sitemap.xml`,
    host: SITE_PUBLIC,
  };
}
