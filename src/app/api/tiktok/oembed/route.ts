/**
 * GET /api/tiktok/oembed — Proxy oEmbed TikTok (PUBLIQUE).
 *
 * ⭐ V3.64 — Pourquoi cette route existe :
 *  ① Le poste de développement/bac local est dans une région où TikTok
 *    redirige tout le trafic vers une page « service indisponible » —
 *    mais la PRODUCTION (Vercel, région cdg1/Paris) joint TikTok
 *    normalement. Le proxy fait donc le fetch CÔTÉ SERVEUR.
 *  ② Le lecteur public a besoin de la HAUTEUR D'EMBED EXACTE de chaque
 *    TikTok (vidéo + légende + bouton « Regarder maintenant ») pour
 *    dimensionner l'iframe sans scrollbar ni textes tronqués.
 *  ③ Les miniatures oEmbed TikTok sont signées et périment — elles ne
 *    servent que de repli temporaire : les vraies miniatures sont
 *    répliquées sur R2 par /api/tiktok/backfill (URL permanentes).
 *
 * ⭐ V4.24 — Élargissement : la route accepte désormais AUSSI
 *  ① les URL avec paramètres de suivi (…?is_from_webapp=1&sender_device=pc
 *     — c'est ce que colle le bouton « Copier le lien » du site TikTok) ;
 *  ② les LIENS COURTS de partage vm./vt.tiktok.com (bouton Partager de
 *     l'app) — résolus côté serveur vers l'URL canonique, renvoyée dans
 *     `urlCanonique` pour que le modal « Nouvelle vidéo » remplace le
 *     lien court par l'URL complète (l'embed public en a besoin).
 *
 * Query : ?url=<URL TikTok complète ou lien court>  (validée — pas de SSRF)
 * Réponse 200 : { ok: true, titre, auteur, auteurUrl, miniatureUrl, hauteur,
 *                 urlCanonique }
 * Réponse 502 : { ok: false, error }  → le client garde ses replis
 * (hauteur canonique 780, miniature de marque).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  oembedTiktok,
  estLienCourtTiktok,
  resoudreLienCourtTiktok,
} from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RE_URL_STRICTE =
  /^https:\/\/(?:www\.)?tiktok\.com\/@[^/\s?]+\/(?:video|photo)\/\d{5,25}\/?(?:\?[^\s]*)?$/;

/** Extrait l'URL canonique (sans paramètres de suivi) d'une URL TikTok. */
function canoniser(url: string): string {
  const chemin = url.match(
    /tiktok\.com\/@[^\s?/]+\/(?:video|photo)\/\d{5,25}/
  )?.[0];
  return chemin ? `https://www.${chemin}` : url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlBrute = (searchParams.get("url") || "").trim();

  // Garde anti-SSRF : seules les URL TikTok strictement formées (avec ou
  // sans paramètres de suivi) et les liens courts vm./vt. sont acceptées.
  if (!urlBrute) {
    return NextResponse.json(
      { ok: false, error: "URL TikTok manquante" },
      { status: 400 }
    );
  }

  let urlCanonique: string | null = null;

  if (estLienCourtTiktok(urlBrute)) {
    // Lien court de partage → résolution serveur de la redirection.
    urlCanonique = await resoudreLienCourtTiktok(urlBrute);
    if (!urlCanonique) {
      return NextResponse.json(
        { ok: false, error: "Lien court TikTok irrésolvable" },
        { status: 502, headers: { "cache-control": "public, max-age=60" } }
      );
    }
  } else if (RE_URL_STRICTE.test(urlBrute)) {
    urlCanonique = canoniser(urlBrute);
  } else {
    return NextResponse.json(
      { ok: false, error: "URL TikTok invalide" },
      { status: 400 }
    );
  }

  const donnees = await oembedTiktok(urlCanonique);
  if (!donnees) {
    return NextResponse.json(
      { ok: false, error: "oEmbed TikTok indisponible" },
      {
        status: 502,
        headers: { "cache-control": "public, max-age=60" }, // réessaie vite
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      titre: donnees.titre,
      auteur: donnees.auteur,
      auteurUrl: donnees.auteurUrl,
      miniatureUrl: donnees.miniatureUrl,
      hauteur: donnees.hauteurEmbed,
      urlCanonique,
    },
    {
      // Cache CDN 24 h : une vidéo populaire ne re-frappe pas TikTok à
      // chaque visite ; le contenu est stable (titre/hauteur immuables).
      headers: {
        "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
