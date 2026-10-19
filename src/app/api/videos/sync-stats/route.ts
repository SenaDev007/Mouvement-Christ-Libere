/**
 * POST /api/videos/sync-stats — Synchroniser les compteurs (vues + likes).
 *
 * ⭐ V4.17 — Retour pasteur : « le nombre de vues et le nombre de likes
 * doivent apparaître ». Les compteurs sont peuplés depuis les plateformes
 * sources : YouTube (videos.list par lots de 50, OAuth déjà configuré)
 * et TikTok (tikwm : play_count / digg_count — même résolveur que le
 * backfill MP4 V4.04).
 *
 * Body : { limiteYoutube?: number (défaut 200, max 800),
 *          limiteTiktok?:  number (défaut 20, max 40) }
 *
 * Réponse : { youtube: { traitées, misesAJour, restantes },
 *             tiktok:  { traitées, misesAJour, restantes } }
 *
 * Le bouton back-office boucle jusqu'à restantes = 0 (contrat identique
 * au backfill TikTok). Une passe opportuniste throttlée 6 h tourne aussi
 * automatiquement sur les visites publiques (cf. lib/video-stats.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { synchroniserStatsYouTube } from "@/lib/video-stats";
import { synchroniserStatsTiktok } from "@/lib/tiktok-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Auth : session back-office obligatoire (même pattern que backfills).
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let limiteYoutube = 200;
  let limiteTiktok = 20;
  try {
    const body = (await request.json()) as {
      limiteYoutube?: number;
      limiteTiktok?: number;
    };
    if (body?.limiteYoutube && Number.isFinite(body.limiteYoutube)) {
      limiteYoutube = Math.min(Math.max(Math.trunc(body.limiteYoutube), 1), 800);
    }
    if (body?.limiteTiktok && Number.isFinite(body.limiteTiktok)) {
      limiteTiktok = Math.min(Math.max(Math.trunc(body.limiteTiktok), 1), 40);
    }
  } catch {
    // body vide → défauts
  }

  try {
    // YouTube d'abord (rapide : lots de 50, quelques secondes), puis
    // TikTok (séquentiel ~1,2 s/vidéo via tikwm).
    const youtube = await synchroniserStatsYouTube({ limite: limiteYoutube });
    const tiktok = await synchroniserStatsTiktok({ limite: limiteTiktok });
    return NextResponse.json({ youtube, tiktok });
  } catch (error) {
    console.error("[videos/sync-stats] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur pendant la synchronisation des compteurs" },
      { status: 500 }
    );
  }
}
