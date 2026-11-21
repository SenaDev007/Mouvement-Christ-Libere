/**
 * GET /api/cron/sync-youtube — ⭐ V4.24 Cron de synchronisation AUTOMATIQUE
 * de la chaîne YouTube liée au back-office.
 *
 * Directive : « quand le pasteur publie une vidéo sur YouTube, qu'elle soit
 * récupérée de façon automatique dans le module vidéo pour être rendue sur
 * la page vidéo publique ». Ce cron fait la même passe que le bouton
 * « Synchroniser YouTube » du module Vidéos, sans intervention humaine :
 *   · importe les vidéos publiées absentes du module (≤ 50 par passe) ;
 *   · idempotent (jamais de doublon) ;
 *   · respecte la mémoire des suppressions V3.86 (une vidéo supprimée du
 *     back-office ne revient jamais) ;
 *   · coût YouTube : 3 unités de quota par passe (channels.list +
 *     playlistItems.list + videos.list).
 *
 * Sécurité : Authorization Bearer (Vercel Cron) OU X-Cron-Secret (manuel)
 * — même garde que les autres crons (autoriserCron).
 * Planification : vercel.json → 2×/jour (10:23 et 22:23 UTC).
 */

import { NextRequest, NextResponse } from "next/server";
import { autoriserCron } from "@/lib/cron-auth";
import { syncYouTubeChannel } from "@/lib/youtube-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!autoriserCron(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Serviteur d'attribution : variable d'env (défaut « afrika » dans la lib
  // — toutes les vidéos YouTube actuelles sont les siennes).
  const resultat = await syncYouTubeChannel({
    servantCode: process.env.YOUTUBE_SYNC_SERVANT_CODE || null,
  });

  if (resultat.erreur) {
    console.error("[cron/sync-youtube] Erreur :", resultat.erreur);
    return NextResponse.json(
      { error: resultat.erreur },
      { status: 503 }
    );
  }

  console.log(
    `[cron/sync-youtube] chaîne="${resultat.chaine || "?"}" ajoutees=${resultat.ajoutees} ignorees=${resultat.ignorees} sautees=${resultat.sautees}`
  );
  return NextResponse.json({
    ok: true,
    chaine: resultat.chaine,
    ajoutees: resultat.ajoutees,
    ignorees: resultat.ignorees,
    sautees: resultat.sautees,
    titres: resultat.titres,
  });
}
