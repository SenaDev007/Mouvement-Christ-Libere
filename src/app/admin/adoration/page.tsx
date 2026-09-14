import { db } from "@/lib/db";
import { AdorationTabsClient } from "@/components/admin/adoration-tabs-client";
// ⭐ V3.46/V3.79 — colonne rubrique (Video.category) : le findMany
// ci-dessous sélectionne toutes les colonnes → garde avant lecture.
import { ensureVideoCategoryColumn } from "@/lib/ensure-schema";
// ⭐ V3.79 — Catégories de la page Adoration & Louanges (seul point de
// vérité, partagé avec la page publique /adoration-louanges).
import { CATEGORIES_ADORATION } from "@/lib/video-rubrics";

/**
 * ⭐ V3.79 — MODULE BACK-OFFICE « ADORATION & LOUANGES » (/admin/adoration).
 *
 * Module DÉDIÉ à Afrika (artiste, chantre de l'Éternel) : elle y gère
 * ses clips, adorations et louanges — upload de fichiers (R2 séquentiel),
 * liens YouTube/TikTok (titre et miniature pré-remplis via oEmbed),
 * miniature personnalisée, bascule Adoration ↔ Louanges en ligne,
 * édition post-production et suppression.
 *
 * Chaque média publié ici apparaît immédiatement sur la page publique
 * /adoration-louanges (catégories « Adoration » et « Louanges » —
 * scission : ces médias sont exclus de la médiathèque /videos).
 */
export const dynamic = "force-dynamic";

export default async function AdminAdorationPage() {
  await ensureVideoCategoryColumn().catch(() => {});

  // Médias des catégories Adoration / Louanges (tous serviteurs — en
  // pratique Afrika : le module est le sien, la création pré-sélectionne
  // son compte). include servant → badge + bascule de catégorie.
  const [medias, servants] = await Promise.all([
    db.video.findMany({
      where: { category: { in: CATEGORIES_ADORATION } },
      orderBy: { createdAt: "desc" },
      include: { servant: true },
      // Sécurité (même règle que le module Vidéos) : ne pas sélectionner
      // projectState (Json non sérialisable en RSC) ni les data URLs
      // géantes — mapper vers un format léger ci-dessous.
    }),
    db.servant.findMany({
      orderBy: { code: "asc" },
    }),
  ]);

  // Mapper vers un format léger et sûrement sérialisable (RSC-safe),
  // identique au module Vidéos : miniatures data URL < 150 Ko gardées,
  // videoUrls base64 géantes exclues.
  const safeMedias = medias.map((v) => {
    const isDataUrlThumb = v.thumbnailUrl?.startsWith("data:");
    const isDataUrlVideo = v.videoUrl?.startsWith("data:");
    return {
      id: v.id,
      servantId: v.servantId,
      title: v.title,
      description: v.description,
      duration: v.duration,
      thumbnailUrl:
        isDataUrlThumb && v.thumbnailUrl!.length > 150000
          ? null
          : v.thumbnailUrl,
      videoUrl: isDataUrlVideo && v.videoUrl!.length > 100000 ? null : v.videoUrl,
      hlsUrl: v.hlsUrl,
      views: v.views,
      isLive: v.isLive,
      category: v.category ?? null,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      projectState: null, // explicitement null (RSC-safe, pas de Prisma.JsonNull)
      servant: v.servant,
    };
  });

  return <AdorationTabsClient medias={safeMedias} servants={servants} />;
}
