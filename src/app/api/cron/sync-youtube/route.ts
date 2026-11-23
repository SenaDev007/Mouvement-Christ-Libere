/**
 * GET /api/cron/sync-youtube — ⭐ V4.26 Cron de synchronisation AUTOMATIQUE
 * de TOUS les comptes YouTube liés au back-office.
 *
 * Boucle sur chaque YoutubeAccount actif en base (Afrika + Pasteur Kongo + …)
 * et appelle syncYouTubeChannel pour chacun. Si aucun compte n'existe en base,
 * repli sur le comportement historique (variables d'environnement YOUTUBE_*).
 *
 * Sécurité : Authorization Bearer (Vercel Cron) OU X-Cron-Secret (manuel)
 * — même garde que les autres crons (autoriserCron).
 * Planification : vercel.json → 2×/jour (10:23 et 22:23 UTC).
 *
 * Coût API YouTube : 3 unités de quota par compte synchronisé (channels.list
 * + playlistItems.list + videos.list). Avec 2 comptes : 6 unités par passe,
 * 12 unités/jour → reste très loin du quota de 10 000 unités/jour.
 */

import { NextRequest, NextResponse } from "next/server";
import { autoriserCron } from "@/lib/cron-auth";
import { syncTousComptesYouTube } from "@/lib/youtube-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!autoriserCron(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const resultat = await syncTousComptesYouTube();

  // Logging structuré (Vercel) : on logge chaque compte séparément pour
  // faciliter le diagnostic en cas d'erreur sur un compte spécifique.
  for (const d of resultat.details) {
    if (d.erreur) {
      console.error(
        `[cron/sync-youtube] ❌ servant="${d.servantCode}" erreur="${d.erreur}"`
      );
    } else {
      console.log(
        `[cron/sync-youtube] ✓ servant="${d.servantCode}" chaine="${d.chaine || "?"}" +${d.ajoutees} ~${d.ignorees} ⊘${d.sautees}`
      );
    }
  }

  // Si au moins un compte est en erreur, on renvoie 503 (mais on logge
  // tout de même les comptes qui ont réussi — la réponse JSON contient les
  // détails par compte).
  const uneErreur = resultat.details.some((d) => d.erreur);
  return NextResponse.json(
    {
      ok: !uneErreur,
      comptes: resultat.comptes,
      ajoutees: resultat.ajoutees,
      ignorees: resultat.ignorees,
      sautees: resultat.sautees,
      details: resultat.details,
    },
    { status: uneErreur ? 503 : 200 }
  );
}
