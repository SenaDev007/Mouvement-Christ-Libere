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
 * Body : { limite?: number, exclure?: string[] } — nombre de vidéos
 * traitées par appel (défaut 15, max 40 ; chaque vidéo ≈ 1-2 s : oEmbed +
 * téléchargement + upload R2). `exclure` = ids à IGNORER (échecs déjà
 * constatés par l'appelant — vidéos TikTok supprimées/privées sans
 * miniature oEmbed : les re-essayer consommerait chaque lot en pure
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
import { db } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { estUrlTiktok, oembedTiktok } from "@/lib/tiktok";
import { uploadToR2, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Extension depuis le content-type de la miniature téléchargée. */
function extensionDepuisType(type: string): string {
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("png")) return "png";
  return "jpg";
}

const LIMITE_MORCEAU_MS = 23_000; // rend la main avant le plafond Vercel

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
  const exclure = new Set<string>();
  try {
    const body = (await request.json()) as { limite?: number; exclure?: string[] };
    if (body?.limite && Number.isFinite(body.limite)) {
      limite = Math.min(Math.max(Math.trunc(body.limite), 1), 40);
    }
    if (Array.isArray(body?.exclure)) {
      for (const id of body.exclure) {
        if (typeof id === "string" && id) exclure.add(id);
      }
    }
  } catch {
    // body vide → défaut 15, aucune exclusion
  }

  const debut = Date.now();
  const erreurs: string[] = [];

  try {
    // ① Vidéos TikTok sans miniature. Prisma ne filtre pas par regex →
    // on charge id+videoUrl+thumbnailUrl (léger) et on filtre en JS.
    const candidates = await db.video.findMany({
      where: { videoUrl: { not: null } },
      select: { id: true, videoUrl: true, thumbnailUrl: true },
    });
    const tiktokSansMiniature = candidates.filter(
      (v) => estUrlTiktok(v.videoUrl) && !v.thumbnailUrl && !exclure.has(v.id)
    );

    let traites = 0;
    let misesAJour = 0;
    const idsEchec: string[] = [];

    // ②-④ Pour chaque vidéo (jusqu'à la limite / le garde-fou horloge).
    for (const video of tiktokSansMiniature) {
      if (traites >= limite || Date.now() - debut > LIMITE_MORCEAU_MS) break;
      traites++;

      try {
        const oembed = await oembedTiktok(video.videoUrl as string);
        if (!oembed?.miniatureUrl) {
          erreurs.push(`${video.id}: oEmbed sans miniature`);
          idsEchec.push(video.id);
          continue;
        }

        // ③ Téléchargement de l'image (miniature TikTok signée).
        const resImg = await fetch(oembed.miniatureUrl, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            accept: "image/webp,image/jpeg,image/png,*/*",
          },
          signal: AbortSignal.timeout(9000),
        });
        if (!resImg.ok) {
          erreurs.push(`${video.id}: téléchargement HTTP ${resImg.status}`);
          idsEchec.push(video.id);
          continue;
        }
        const typeImg = (resImg.headers.get("content-type") || "").toLowerCase();
        if (!typeImg.startsWith("image/")) {
          erreurs.push(`${video.id}: content-type inattendu ${typeImg}`);
          idsEchec.push(video.id);
          continue;
        }
        const octets = Buffer.from(await resImg.arrayBuffer());
        if (octets.length < 1024 || octets.length > 8 * 1024 * 1024) {
          erreurs.push(`${video.id}: taille image suspecte ${octets.length}`);
          idsEchec.push(video.id);
          continue;
        }

        // Réplication R2 — URL publique PERMANENTE (prefixe thumbnails/).
        const ext = extensionDepuisType(typeImg);
        const cle = `thumbnails/tiktok-${video.id}.${ext}`;
        const urlPublique = await uploadToR2(cle, octets, typeImg);

        // ④ Mise à jour de la miniature (et rien d'autre).
        await db.video.update({
          where: { id: video.id },
          data: { thumbnailUrl: urlPublique },
        });
        misesAJour++;
      } catch (e) {
        erreurs.push(
          `${video.id}: ${e instanceof Error ? e.message : String(e)}`
        );
        idsEchec.push(video.id);
      }
    }

    // Restantes = vidéos TikTok toujours sans miniature, HORS ids exclus
    // (les échecs renvoyés dans idsEchecs sont exclus par l'appelant au
    // prochain lot : ils ne consomment plus aucun slot — ce sont en général
    // des vidéos supprimées/privées côté TikTok, sans miniature oEmbed).
    return NextResponse.json({
      traitées: traites,
      misesAJour: misesAJour,
      restantes: Math.max(0, tiktokSansMiniature.length - misesAJour),
      idsEchecs: idsEchec,
      erreurs: erreurs.slice(0, 10),
    });
  } catch (error) {
    console.error("[tiktok/backfill] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur pendant le backfill des miniatures TikTok" },
      { status: 500 }
    );
  }
}
