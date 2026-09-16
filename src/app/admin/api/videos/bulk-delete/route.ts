import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isR2Configured, purgerArtefactsR2 } from "@/lib/r2";
import { ensureVideoCategoryColumn } from "@/lib/ensure-schema";

/**
 * ⭐ V3.81 — SUPPRESSION MULTIPLE de vidéos (back-office, module Vidéos).
 *
 *   POST /admin/api/videos/bulk-delete  { ids: string[] }
 *
 * Directive du pasteur : pouvoir supprimer PLUSIEURS vidéos d'un coup dans
 * le module vidéo du back-office (au lieu d'une par une).
 *
 *   · 1 requête = 1 lot (≤ 100 vidéos) — le client envoie des lots
 *     séquentiels et affiche la progression ;
 *   · suppression PHYSIQUE en base (deleteMany — les vues liées
 *     cascadent) : les vidéos disparaissent du back-office ET du site
 *     public (les pages publiques lisent la même table, sans cache
 *     long) ;
 *   · ⭐ purge R2 SYNCHRONISÉE (même gouvernance que la suppression
 *     unitaire V3.58) : fichiers uploadés, rendus de post-production et
 *     miniatures sont supprimés du stockage Cloudflare — un seul appel
 *     groupé (urls + préfixes de tous les lots), best-effort : une erreur
 *     R2 ne fait JAMAIS échouer la suppression en base.
 *
 * Garde d'authentification : proxy (cookie admin_session), comme toutes
 * les routes /admin/api/* génériques.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_PAR_LOT = 100;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const ids = (body as { ids?: unknown } | null)?.ids;

    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_PAR_LOT ||
      !ids.every((i) => typeof i === "string" && i.length > 0)
    ) {
      return NextResponse.json(
        {
          error: `Liste de vidéos invalide (1 à ${MAX_PAR_LOT} identifiants par lot).`,
        },
        { status: 400 }
      );
    }

    // Garde froide : colonne rubrique Video.category (même pattern que la
    // route générique /admin/api/[entity]/[id]).
    await ensureVideoCategoryColumn();

    // ── ① Capture des artefacts R2 AVANT suppression (la ligne doit
    // exister pour être lue) — une seule lecture groupée.
    const videos = await db.video.findMany({
      where: { id: { in: ids } },
      select: { id: true, videoUrl: true, hlsUrl: true, thumbnailUrl: true },
    });
    const idsExistants = new Set(videos.map((v) => v.id));
    const introuvables = ids.filter((i) => !idsExistants.has(i));

    // ── ② Suppression PHYSIQUE en base (source de vérité). Les vues et
    // likes liés cascadent (onDelete: Cascade au niveau des relations).
    let supprimees = 0;
    if (idsExistants.size > 0) {
      const resultat = await db.video.deleteMany({
        where: { id: { in: [...idsExistants] } },
      });
      supprimees = resultat.count;
    }

    // ── ③ Purge R2 groupée (best-effort — ne bloque jamais la réponse).
    let purgeR2: Awaited<ReturnType<typeof purgerArtefactsR2>> | null = null;
    if (isR2Configured() && videos.length > 0) {
      const urls = videos.flatMap((v) => [v.videoUrl, v.hlsUrl, v.thumbnailUrl]);
      // Fichier principal + rendus post-production par vidéo.
      const prefixes = videos.flatMap((v) => [
        `videos/video-${v.id}`,
        `rendered-videos/video-${v.id}`,
      ]);
      try {
        purgeR2 = await purgerArtefactsR2({ urls, prefixes });
        console.log(
          `[admin/api/videos/bulk-delete] Purge R2 : ${purgeR2.supprimes}/${purgeR2.trouves} fichier(s) supprimé(s) pour ${supprimees} vidéo(s)` +
            (purgeR2.erreurs.length > 0
              ? ` — erreurs : ${purgeR2.erreurs.join(" ; ")}`
              : "")
        );
      } catch (e) {
        // La purge ne doit JAMAIS faire échouer une suppression déjà réussie.
        console.error("[admin/api/videos/bulk-delete] Purge R2 impossible :", e);
      }
    }

    return NextResponse.json({
      success: true,
      supprimees,
      introuvables,
      purgeR2,
    });
  } catch (error) {
    console.error("[admin/api/videos/bulk-delete] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression multiple" },
      { status: 500 }
    );
  }
}
