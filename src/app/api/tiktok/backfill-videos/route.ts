/**
 * POST /api/tiktok/backfill-videos — Sauvegarde les MP4 TikTok sur R2.
 *
 * ⭐ V4.04 — Le problème : l'embed TikTok refuse parfois la lecture
 * (« overload-protect triggered », saturation CDN PERSISTANTE sur les
 * vidéos populaires — la parade « Réessayer » V4.03 ne suffit pas),
 * alors que la vidéo se lit sur tiktok.com. Le site doit pouvoir lire
 * ses vidéos TOUJOURS.
 *
 * La solution (l'église est propriétaire de ses contenus TikTok) :
 * répliquer chaque MP4 sur NOTRE stockage R2 (URL permanente) et le
 * jouer depuis là. Même mécanique que les miniatures V3.85
 * (/api/tiktok/backfill) :
 *  ① sélectionne les vidéos TikTok SANS copie R2, populaires d'abord ;
 *  ② résout l'URL de lecture directe (API mobile tiktokv → page HTML) ;
 *  ③ TÉLÉCHARGE le MP4 et le réplique sur R2 (videos/tiktok-<id>.mp4) ;
 *  ④ met à jour Video.tiktokMp4Url — le lecteur public joue NOTRE copie.
 *
 * Body : { limite?: number, exclure?: string[] } — défaut 6 vidéos par
 * appel (téléchargements ~5-40 Mo, paquets de 3 en parallèle). Garde-fou
 * horloge 45 s + maxDuration 300 côté Vercel : le bouton back-office
 * boucle jusqu'à restantes = 0 (contrat identique aux miniatures).
 *
 * Réponse : { traitées, sauvegardées, restantes, idsEchecs, erreurs,
 * octetsTotaux }
 *
 * Idempotent : relancer ne re-télécharge rien. Les diaporamas /photo/
 * (pas de MP4 unique) restent sur l'embed. Titre/description intacts.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isR2Configured } from "@/lib/r2";
import { ensureTiktokMp4UrlColumn } from "@/lib/ensure-schema";
import { backfillMp4Tiktok } from "@/lib/tiktok-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Auth : session back-office obligatoire (même pattern que miniatures).
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 non configuré — impossible de stocker les vidéos" },
      { status: 503 }
    );
  }

  // Colonne tiktokMp4Url garantie avant toute sélection Prisma (P2022).
  await ensureTiktokMp4UrlColumn();

  let limite = 6;
  const exclure: string[] = [];
  try {
    const body = (await request.json()) as { limite?: number; exclure?: string[] };
    if (body?.limite && Number.isFinite(body.limite)) {
      limite = Math.min(Math.max(Math.trunc(body.limite), 1), 20);
    }
    if (Array.isArray(body?.exclure)) {
      for (const id of body.exclure) {
        if (typeof id === "string" && id) exclure.push(id);
      }
    }
  } catch {
    // body vide → défaut 6, aucune exclusion
  }

  try {
    const resultat = await backfillMp4Tiktok({ limite, exclure });
    return NextResponse.json(resultat);
  } catch (error) {
    console.error("[tiktok/backfill-videos] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur pendant la sauvegarde des vidéos TikTok" },
      { status: 500 }
    );
  }
}
