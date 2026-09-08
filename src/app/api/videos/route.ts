/** GET /api/videos — Liste des vidéos depuis la DB */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureVideoLikesColumn, ensureVideoCategoryColumn } from "@/lib/ensure-schema";
import { recupererReplaysManquants } from "@/lib/live-replay-recovery";
import { categorizeVideo, estRubrique } from "@/lib/video-rubrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // ⭐ V3.26 — colonne Video.likes (compteur de likes RÉEL, distinct de
    // views) créée à la volée si absente (idempotent, mémoïsé).
    await ensureVideoLikesColumn();
    // ⭐ V3.46 — colonne Video.category (rubrique signature) : le client
    // Prisma généré la sélectionne → P2022 sur base froide sans cette garde.
    await ensureVideoCategoryColumn();

    // ⭐ V3.34 — récupération opportuniste des replays YouTube manquants
    // (≤ 3 s pour ne pas ralentir la page publique) : chaque visite aide à
    // retenter la récupération des lives terminés dont l'URL YouTube n'a
    // pas encore été trouvée (throttle 30 s par live côté serveur).
    try {
      await Promise.race([
        recupererReplaysManquants(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // Non bloquant — la liste doit toujours être renvoyée.
    }

    const { searchParams } = new URL(request.url);
    const servant = searchParams.get("servant");

    const where: Record<string, unknown> = {};
    if (servant && servant !== "all") {
      where.servant = { code: servant };
    }

    const videos = await db.video.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { servant: true },
    });

    // Extraire le youtubeId de videoUrl (si c'est une URL YouTube)
    const formatted = videos.map((v) => {
      const youtubeId = v.videoUrl?.match(/v=([a-zA-Z0-9_-]{11})/)?.[1]
        || v.videoUrl?.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1]
        || "";

      // IMPORTANT : Ne pas renvoyer les data URLs base64 dans la liste
      // (ils font plusieurs MB et bloquent la sérialisation JSON)
      // Les data URLs sont récupérées individuellement via /api/videos/[id]/source
      const isDataUrl = v.videoUrl?.startsWith("data:");
      const safeVideoUrl = isDataUrl ? null : v.videoUrl;

      // Détecter si la vidéo a une source lisible (mp4 local, HLS, ou YouTube)
      const hasNativeVideo = !!safeVideoUrl && (
        safeVideoUrl.endsWith(".mp4")
        || safeVideoUrl.startsWith("/rendered-videos/")
        || safeVideoUrl.startsWith("http")
      ) && !youtubeId;

      return {
        id: v.id,
        youtubeId,
        videoUrl: safeVideoUrl,
        hlsUrl: v.hlsUrl,
        title: v.title,
        description: v.description,
        duration: v.duration || "",
        views: v.views,
        // ⭐ V3.26 — likes RÉELS (colonne dédiée) : le cœur du lecteur
        // n'affiche plus views (ancienne donnée fictive — un replay
        // fraîchement publié affichait « 5 likes » = ses viewers live).
        likes: (v as unknown as { likes?: number }).likes ?? 0,
        publishedAt: v.publishedAt?.toISOString() || "",
        // ⭐ V3.46 — rubrique EXPLICITE (back-office) prioritaire sur le
        // devin par mots-clés (comportement historique préservé si null).
        category: categorizeVideo(v.title, v.servant.code, v.category),
        // Rubrique signature ? — la page publique met ces rubriques en
        // avant (bandeau + catégories épinglées, visibles même vides).
        isRubric: estRubrique(v.category),
        servant: v.servant.code,
        servantName: v.servant.shortName,
        thumbnailUrl: v.thumbnailUrl || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : ""),
        isLive: v.isLive,
        hasNativeVideo,
      };
    });

    return NextResponse.json({ videos: formatted });
  } catch (error) {
    console.error("[api/videos]", error);
    return NextResponse.json({ videos: [] });
  }
}
