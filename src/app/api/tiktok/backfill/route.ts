/**
 * POST /api/tiktok/backfill — Réplique les miniatures TikTok sur R2.
 *
 * ⭐ V3.64 — Le problème : les 336 vidéos TikTok insérées en V3.63 n'ont
 * PAS de thumbnailUrl (l'oEmbed est inaccessible depuis le bac de
 * développement, région bloquée) → back-office et site public affichent
 * un placeholder au lieu d'une vraie miniature comme YouTube.
 *
 * La solution : la PRODUCTION (Vercel, cdg1/Paris) joint TikTok. Cette
 * route (appelée avec la session admin) :
 *  ① sélectionne les vidéos TikTok SANS miniature ;
 *  ② interroge l'oEmbed officiel → thumbnail_url (signée, périssable) ;
 *  ③ TÉLÉCHARGE l'image et la RÉPLIQUE sur Cloudflare R2
 *     (prefixe thumbnails/ — URL publique PERMANENTE) ;
 *  ④ met à jour Video.thumbnailUrl.
 *
 * ⭐ V3.85 — La mécanique vit désormais dans src/lib/tiktok-miniature.ts
 * (partagée avec la création/modification de vidéos et le cron quotidien
 * /api/cron/backfill-miniatures-tiktok). Le traitement se fait par
 * PAQUETS DE 4 en parallèle (≈ 3× plus rapide).
 *
 * Body : { limite?: number, exclure?: string[] } — nombre de vidéos
 * traitées par appel (défaut 15, max 40). `exclure` = ids à IGNORER
 * (échecs déjà constatés par l'appelant — vidéos TikTok supprimées/privées
 * sans miniature oEmbed : les re-essayer consommerait chaque lot en pure
 * perte). Un garde-fou horloge (23 s) rend la main AVANT le plafond
 * serverless (30 s) : le script appelant boucle jusqu'à restantes = 0.
 *
 * Réponse : { traitées, misesAJour, restantes, idsEchecs, erreurs[] }
 *
 * Idempotent : les vidéos déjà pourvues d'une miniature sont exclues —
 * relancer ne fait rien. Les titres/rubriques ne sont JAMAIS modifiés.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isR2Configured } from "@/lib/r2";
import { backfillMiniaturesTiktok } from "@/lib/tiktok-miniature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Auth : session back-office obligatoire (même pattern que multipart).
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 non configuré — impossible de stocker les miniatures" },
      { status: 503 }
    );
  }

  let limite = 15;
  const exclure: string[] = [];
  try {
    const body = (await request.json()) as { limite?: number; exclure?: string[] };
    if (body?.limite && Number.isFinite(body.limite)) {
      limite = Math.min(Math.max(Math.trunc(body.limite), 1), 40);
    }
    if (Array.isArray(body?.exclure)) {
      for (const id of body.exclure) {
        if (typeof id === "string" && id) exclure.push(id);
      }
    }
  } catch {
    // body vide → défaut 15, aucune exclusion
  }

  try {
    const resultat = await backfillMiniaturesTiktok({ limite, exclure });
    return NextResponse.json(resultat);
  } catch (error) {
    console.error("[tiktok/backfill] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur pendant le backfill des miniatures TikTok" },
      { status: 500 }
    );
  }
}
