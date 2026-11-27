/**
 * POST /admin/api/videos/sync-tiktok — ⭐ V4.26 Synchronisation manuelle
 * d'un compte TikTok (bouton « Synchroniser TikTok » du module Vidéos).
 *
 * Body : { servantCode?: string } — serviteur auquel attribuer les nouvelles
 * vidéos (par défaut : onglet actif côté client). Si null, synchronise TOUS
 * les comptes TikTok actifs.
 *
 * Réponse 200 : { ajoutees, ignorees, sautees, titres[], username?, displayName? }
 *               (ou { comptes, details[] } si servantCode est null)
 * Réponse 4xx/5xx : { error }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { syncTikTokAccount, syncTousComptesTikTok } from "@/lib/tiktok-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby = 60s max (ScrapingAnt 20s + tikwm 10s + DB 5s = ~35s)

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let servantCode: string | null = null;
  try {
    const body = (await request.json()) as { servantCode?: string | null };
    if (typeof body?.servantCode === "string" && body.servantCode) {
      servantCode = body.servantCode;
    }
  } catch {
    // body vide → sync tous les comptes
  }

  // Pas de servantCode → on sync tous les comptes actifs en une fois.
  if (!servantCode) {
    const resultat = await syncTousComptesTikTok();
    return NextResponse.json(resultat);
  }

  const resultat = await syncTikTokAccount({ servantCode });

  if (resultat.erreur) {
    return NextResponse.json({ error: resultat.erreur }, { status: 503 });
  }

  return NextResponse.json({
    ajoutees: resultat.ajoutees,
    ignorees: resultat.ignorees,
    sautees: resultat.sautees,
    titres: resultat.titres,
    username: resultat.username,
    displayName: resultat.displayName,
  });
}
