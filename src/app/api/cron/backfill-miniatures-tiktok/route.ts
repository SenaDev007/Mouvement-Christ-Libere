import { NextRequest, NextResponse } from "next/server";
import { autoriserCron } from "@/lib/cron-auth";
import { isR2Configured } from "@/lib/r2";
import { backfillMiniaturesTiktok } from "@/lib/tiktok-miniature";

/**
 * ⭐ V3.85 — GET /api/cron/backfill-miniatures-tiktok
 *
 * Auto-réparation QUOTIDIENNE des miniatures TikTok manquantes (directive :
 * « il faut que ça affiche les vraies miniatures »). La production
 * (Vercel, cdg1/Paris) est la seule à joindre TikTok — le cron tourne donc
 * côté serveur, sans intervention humaine :
 *   · les vidéos TikTok sans thumbnailUrl reçoivent leur VRAIE miniature
 *     (oEmbed officiel → réplication R2 permanente) ;
 *   · traitement par paquets de 4 en parallèle sous budget horloge 25 s
 *     (rendre la main avant le plafond serverless 30 s) ;
 *   · idempotent : les vidéos déjà pourvues sont exclues — relancer ne
 *     fait rien ; les échecs (vidéos privées/supprimées) sont retournés
 *     pour diagnostic mais ne bloquent jamais le lot suivant.
 *
 * Sécurité : Authorization Bearer (Vercel Cron) OU X-Cron-Secret (manuel)
 * — même garde que les autres crons (autoriserCron).
 * Planification : vercel.json → tous les jours à 03:17 UTC.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!autoriserCron(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 non configuré — miniatures impossibles à stocker" },
      { status: 503 }
    );
  }

  try {
    // Budget 25 s : le cron rend la main avant le plafond ; le lendemain
    // (ou l'ouverture du module Vidéos par le pasteur) traite le reste.
    const resultat = await backfillMiniaturesTiktok({
      limite: 40,
      budgetMs: 25_000,
    });
    console.log(
      `[cron/backfill-miniatures-tiktok] traitées=${resultat.traitées} misesAJour=${resultat.misesAJour} restantes=${resultat.restantes}`
    );
    return NextResponse.json(resultat);
  } catch (error) {
    console.error("[cron/backfill-miniatures-tiktok] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur pendant le backfill des miniatures TikTok" },
      { status: 500 }
    );
  }
}
