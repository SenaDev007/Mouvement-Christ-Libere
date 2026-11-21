/**
 * POST /admin/api/videos/sync-youtube — ⭐ V4.24 Synchronisation manuelle de
 * la chaîne YouTube liée (bouton « Synchroniser YouTube » du module Vidéos).
 *
 * Importe les vidéos publiées sur la chaîne YouTube du pasteur (OAuth déjà
 * configuré pour la récupération des replays de lives) qui ne sont pas
 * encore dans le module Vidéos. Idempotent, et une vidéo volontairement
 * supprimée du back-office n'est JAMAIS ré-importée (⭐ V3.86).
 *
 * Body : { servantCode?: string } — serviteur auquel attribuer les nouvelles
 * vidéos (par défaut : onglet actif côté client, sinon YOUTUBE_SYNC_SERVANT_CODE,
 * sinon « afrika »).
 *
 * Réponse 200 : { ajoutees, ignorees, sautees, titres[], chaine? }
 * Réponse 4xx/5xx : { error }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { syncYouTubeChannel } from "@/lib/youtube-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Auth : session back-office obligatoire (même pattern que
  // /api/tiktok/backfill et /admin/api/videos/multipart).
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
    // body vide → serviteur par défaut
  }

  const resultat = await syncYouTubeChannel({ servantCode });

  if (resultat.erreur) {
    return NextResponse.json(
      { error: resultat.erreur },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ajoutees: resultat.ajoutees,
    ignorees: resultat.ignorees,
    sautees: resultat.sautees,
    titres: resultat.titres,
    chaine: resultat.chaine,
  });
}
