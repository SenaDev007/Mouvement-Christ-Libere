import { db } from "@/lib/db";
import { VideosTabsClient } from "@/components/admin/videos-tabs-client";
import { recupererReplaysManquants, compterReplaysEnAttente } from "@/lib/live-replay-recovery";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  // ┌───────────────────────────────────────────────────────────────────────────┐
  // │ ⭐ V3.34 — RÉCUPÉRATION DES REPLAYS YOUTUBE AVANT LE CHARGEMENT (≤ 8 s)  │
  // ├───────────────────────────────────────────────────────────────────────────┤
  // │ Anomalie remontée par le pasteur : l'upload R2 du replay échoue (access │
  // │ denied) et la récupération auto de l'ID YouTube « ne marche pas » — la │
  // │ vidéo n'apparaît pas dans Vidéos alors qu'elle existe sur YouTube.      │
  // │ En arrivant ici (le studio redirige vers cette page ~2 s après          │
  // │ l'arrêt du live), on tente immédiatement de récupérer les replays       │
  // │ manquants : YouTube publie le replay 30 s à 5 min après la fin du       │
  // │ flux, donc le bandeau d'attente (côté client) rafraîchit               │
  // │ automatiquement la page jusqu'à ce que la vidéo apparaisse.            │
  // └───────────────────────────────────────────────────────────────────────────┘
  try {
    await Promise.race([
      recupererReplaysManquants(),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
  } catch {
    // La récupération ne doit JAMAIS bloquer ni casser la page.
  }

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

  // ⭐ V3.34 — lives ENDED encore récupérables (bandeau + auto-refresh côté
  // client). 0 si l'OAuth YouTube n'est pas configuré ou si rien ne manque.
  const replaysEnAttente = await compterReplaysEnAttente().catch(() => 0);

  return (
    <VideosTabsClient
      videos={safeVideos}
      servants={servants}
      pendingReplayCount={replaysEnAttente}
    />
  );
}
