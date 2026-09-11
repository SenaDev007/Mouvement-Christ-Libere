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
 * Query : ?url=<URL TikTok complète>  (validée strictement — pas de SSRF)
 * Réponse 200 : { ok: true, titre, auteur, auteurUrl, miniatureUrl, hauteur }
 * Réponse 502 : { ok: false, error }  → le client garde ses replis
 * (hauteur canonique 780, miniature de marque).
 */

import { NextRequest, NextResponse } from "next/server";
import { oembedTiktok } from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RE_URL_STRICTE =
  /^https:\/\/(?:www\.)?tiktok\.com\/@[^/\s]+\/(?:video|photo)\/\d{5,25}\/?$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") || "";

  // Garde anti-SSRF : seule une URL TikTok strictement formée est acceptée.
  if (!url || !RE_URL_STRICTE.test(url)) {
    return NextResponse.json(
      { ok: false, error: "URL TikTok invalide" },
      { status: 400 }
    );
  }

  const donnees = await oembedTiktok(url);
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
