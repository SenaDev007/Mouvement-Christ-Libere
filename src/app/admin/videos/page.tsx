import { db } from "@/lib/db";
import { VideosTabsClient } from "@/components/admin/videos-tabs-client";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const [videos, servants] = await Promise.all([
    db.video.findMany({
      orderBy: { createdAt: "desc" },
      include: { servant: true },
      // Sécurité : ne pas sélectionner projectState (champ Json qui peut
      // contenir des valeurs non sérialisables via RSC) ni les data URLs
      // base64 géantes qui peuvent faire crasher la sérialisation.
    }),
    db.servant.findMany({
      orderBy: { code: "asc" },
    }),
  ]);

  // Mapper vers un format léger et sûrement sérialisable (RSC-safe).
  // Les miniatures data URL < 150KB sont autorisées (compressées par sharp).
  // On n'exclut que les data URLs géantes (> 150KB) et les videoUrls base64.
  const safeVideos = videos.map((v) => {
    const isDataUrlThumb = v.thumbnailUrl?.startsWith("data:");
    const isDataUrlVideo = v.videoUrl?.startsWith("data:");
    return {
      id: v.id,
      servantId: v.servantId,
      title: v.title,
      description: v.description,
      duration: v.duration,
      thumbnailUrl:
        isDataUrlThumb && (v.thumbnailUrl!.length > 150000)
          ? null
          : v.thumbnailUrl,
      videoUrl: isDataUrlVideo && (v.videoUrl!.length > 100000) ? null : v.videoUrl,
      hlsUrl: v.hlsUrl,
      views: v.views,
      isLive: v.isLive,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      projectState: null, // explicitement null (RSC-safe, pas de Prisma.JsonNull)
      servant: v.servant,
    };
  });

  return <VideosTabsClient videos={safeVideos} servants={servants} />;
}
