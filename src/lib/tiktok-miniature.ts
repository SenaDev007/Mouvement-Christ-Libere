/**
 * ⭐ V3.85 — Miniatures TikTok : récupération et réplication R2 (serveur).
 *
 * Pourquoi ce fichier : les miniatures oEmbed TikTok sont signées et
 * périment — la V3.64 a créé /api/tiktok/backfill pour les répliquer sur
 * R2 (URL permanentes), mais le backfill ne s'exécutait qu'à la main.
 * Depuis, 42 vidéos « Saint-Esprit réponds-moi » n'ont toujours pas de
 * vraie miniature (fond noir + logo TikTok dans le back-office).
 *
 * La V3.85 industrialise la mécanique en trois déclencheurs :
 *   ① À LA CRÉATION / MODIFICATION d'une vidéo TikTok dans le back-office
 *      (routes /admin/api/[entity]…) — plus jamais de vidéo sans miniature ;
 *   ② À L'OUVERTURE du module Vidéos du back-office (auto-réparation des
 *      anciennes, boucle cliente appelle /api/tiktok/backfill) ;
 *   ③ PAR CRON quotidien (/api/cron/backfill-miniatures-tiktok — Vercel).
 *
 * Serveur uniquement : fetch sortant vers TikTok + upload R2.
 */

import { db } from "@/lib/db";
import { estUrlTiktok, oembedTiktok } from "@/lib/tiktok";
import { uploadToR2, isR2Configured } from "@/lib/r2";

/** Extension depuis le content-type de la miniature téléchargée. */
function extensionDepuisType(type: string): string {
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("png")) return "png";
  return "jpg";
}

/**
 * Récupère la VRAIE miniature d'une vidéo TikTok et la réplique sur R2
 * (URL publique permanente). Ne lève JAMAIS : null = échec silencieux
 * (vidéo privée/supprimée, TikTok injoignable, R2 absent…).
 *
 * @param id        identifiant de la vidéo (clé R2 : thumbnails/tiktok-<id>.<ext>)
 * @param videoUrl  URL TikTok complète (https://www.tiktok.com/@…/video/…)
 */
export async function replicquerMiniatureTiktok(
  id: string,
  videoUrl: string
): Promise<string | null> {
  if (!isR2Configured()) return null;
  try {
    const oembed = await oembedTiktok(videoUrl);
    if (!oembed?.miniatureUrl) return null;

    const resImg = await fetch(oembed.miniatureUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "image/webp,image/jpeg,image/png,*/*",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!resImg.ok) return null;

    const typeImg = (resImg.headers.get("content-type") || "").toLowerCase();
    if (!typeImg.startsWith("image/")) return null;

    const octets = Buffer.from(await resImg.arrayBuffer());
    if (octets.length < 1024 || octets.length > 8 * 1024 * 1024) return null;

    const ext = extensionDepuisType(typeImg);
    const cle = `thumbnails/tiktok-${id}.${ext}`;
    return await uploadToR2(cle, octets, typeImg);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Backfill par lots (même contrat que la route V3.64)
// ─────────────────────────────────────────────────────────────────────

export interface ResultatBackfillTiktok {
  traitées: number;
  misesAJour: number;
  restantes: number;
  idsEchecs: string[];
  erreurs: string[];
}

/** Traitement d'UNE vidéo du lot (retourne l'id en cas d'échec). */
async function traiterUne(video: { id: string; videoUrl: string }): Promise<boolean> {
  const oembed = await oembedTiktok(video.videoUrl);
  if (!oembed?.miniatureUrl) return false;

  const resImg = await fetch(oembed.miniatureUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "image/webp,image/jpeg,image/png,*/*",
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!resImg.ok) return false;

  const typeImg = (resImg.headers.get("content-type") || "").toLowerCase();
  if (!typeImg.startsWith("image/")) return false;

  const octets = Buffer.from(await resImg.arrayBuffer());
  if (octets.length < 1024 || octets.length > 8 * 1024 * 1024) return false;

  const ext = extensionDepuisType(typeImg);
  const cle = `thumbnails/tiktok-${video.id}.${ext}`;
  const urlPublique = await uploadToR2(cle, octets, typeImg);

  // Mise à jour de la miniature (et rien d'autre).
  await db.video.update({
    where: { id: video.id },
    data: { thumbnailUrl: urlPublique },
  });
  return true;
}

/**
 * Backfill des vidéos TikTok SANS miniature :
 *   ① sélectionne les candidates (filtrage JS — Prisma ignore les regex) ;
 *   ② oEmbed officiel → thumbnail_url (signée, périssable) ;
 *   ③ télécharge l'image et la RÉPLIQUE sur R2 (URL permanente) ;
 *   ④ met à jour Video.thumbnailUrl.
 *
 * Traitement PAR PAQUETS de 4 en parallèle (≈ 3 fois plus rapide qu'en
 * séquentiel) sous garde-fou horloge (défaut 23 s — rendre la main avant
 * le plafond serverless 30 s).
 *
 * Idempotent : les vidéos déjà pourvues sont exclues — relancer ne fait rien.
 */
export async function backfillMiniaturesTiktok(params?: {
  limite?: number;
  exclure?: string[];
  budgetMs?: number;
}): Promise<ResultatBackfillTiktok> {
  const limite = Math.min(Math.max(params?.limite ?? 15, 1), 40);
  const budgetMs = Math.min(Math.max(params?.budgetMs ?? 23_000, 5_000), 28_000);
  const exclure = new Set(params?.exclure ?? []);

  const debut = Date.now();
  const erreurs: string[] = [];

  // ① Vidéos TikTok sans miniature (léger : id + videoUrl + thumbnailUrl).
  const candidates = await db.video.findMany({
    where: { videoUrl: { not: null } },
    select: { id: true, videoUrl: true, thumbnailUrl: true },
  });
  const tiktokSansMiniature = candidates.filter(
    (v) =>
      estUrlTiktok(v.videoUrl) &&
      !v.thumbnailUrl &&
      !exclure.has(v.id)
  );

  let traites = 0;
  let misesAJour = 0;
  const idsEchec: string[] = [];

  // ②-④ Par paquets de 4 (le budget horloge s'applique entre paquets).
  const TAILLE_PAQUET = 4;
  for (let i = 0; i < tiktokSansMiniature.length; i += TAILLE_PAQUET) {
    if (traites >= limite || Date.now() - debut > budgetMs) break;
    const paquet = tiktokSansMiniature.slice(i, i + TAILLE_PAQUET);
    traites += paquet.length;

    const resultats = await Promise.allSettled(
      paquet.map((v) =>
        traiterUne({ id: v.id, videoUrl: v.videoUrl as string })
      )
    );
    resultats.forEach((res, j) => {
      if (res.status === "fulfilled" && res.value) {
        misesAJour++;
      } else {
        idsEchec.push(paquet[j].id);
        if (res.status === "rejected") {
          erreurs.push(
            `${paquet[j].id}: ${
              res.reason instanceof Error ? res.reason.message : String(res.reason)
            }`
          );
        }
      }
    });
  }

  return {
    traitées: traites,
    misesAJour: misesAJour,
    restantes: Math.max(0, tiktokSansMiniature.length - misesAJour),
    idsEchecs: idsEchec,
    erreurs: erreurs.slice(0, 10),
  };
}
