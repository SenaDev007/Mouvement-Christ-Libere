/**
 * GET /api/cron/sync-tiktok — ⭐ V4.26 Cron de synchronisation AUTOMATIQUE
 * de TOUS les comptes TikTok liés au back-office.
 *
 * Pour chaque TiktokAccount actif en base, récupère les dernières vidéos
 * publiées via tikwm.com (service tiers, ~1 req/s) et les importe dans le
 * module Vidéos. Idempotent, respecte la mémoire des suppressions (V3.86).
 *
 * Sécurité : Authorization Bearer (Vercel Cron) OU X-Cron-Secret (manuel).
 * Planification : vercel.json → 2×/jour (10:33 et 22:33 UTC).
 */

import { NextRequest, NextResponse } from "next/server";
import { autoriserCron } from "@/lib/cron-auth";
import { syncTousComptesTikTok } from "@/lib/tiktok-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // scraping séquentiel tikwm = ~1 req/s

export async function GET(req: NextRequest) {
  if (!autoriserCron(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const resultat = await syncTousComptesTikTok();

  if (resultat.comptes === 0) {
    console.log("[cron/sync-tiktok] Aucun compte TikTok actif en base — rien à faire.");
    return NextResponse.json({
      ok: true,
      comptes: 0,
      ajoutees: 0,
      ignorees: 0,
      sautees: 0,
      details: [],
    });
  }

  for (const d of resultat.details) {
    if (d.erreur) {
      console.error(
        `[cron/sync-tiktok] ❌ servant="${d.servantCode}" username="${d.username || "?"}" erreur="${d.erreur}"`
      );
    } else {
      console.log(
        `[cron/sync-tiktok] ✓ servant="${d.servantCode}" username="${d.username || "?"}" +${d.ajoutees} ~${d.ignorees} ⊘${d.sautees}`
      );
    }
  }

  const uneErreur = resultat.details.some((d) => d.erreur);
  return NextResponse.json(
    {
      ok: !uneErreur,
      ...resultat,
    },
    { status: uneErreur ? 503 : 200 }
  );
}
