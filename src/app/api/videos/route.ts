/** GET /api/videos — Liste des vidéos depuis la DB */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureVideoLikesColumn } from "@/lib/ensure-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // ⭐ V3.26 — colonne Video.likes (compteur de likes RÉEL, distinct de
    // views) créée à la volée si absente (idempotent, mémoïsé).
    await ensureVideoLikesColumn();
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
        category: categorize(v.title, v.servant.code),
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

function categorize(title: string, servant: string): string {
  const t = title.toLowerCase();
  // Les replays de lives vont dans "Lives & Directs"
  if (t.includes("replay") || t.includes("(live)")) return "Lives & Directs";
  if (servant === "kongo") {
    if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
    if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
    if (t.includes("fête") || t.includes("shabbat")) return "Fêtes & Shabbat";
    if (t.includes("discernement") || t.includes("occult")) return "Discernement Spirituel";
    return "Paroles & Exhortations";
  }
  if (t.includes("direct") || t.includes("en direct")) return "Lives & Directs";
  if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
  if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
  if (t.includes("témoignage") || t.includes("vision")) return "Témoignages & Visions";
  if (t.includes("shabbat") || t.includes("fête")) return "Fêtes & Shabbat";
  return "Paroles & Exhortations";
}
