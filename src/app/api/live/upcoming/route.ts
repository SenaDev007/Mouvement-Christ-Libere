import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/live/upcoming
 *
 * Retourne TOUS les lives programmés + en cours (pour le carrousel).
 *
 * CACHE : cette route est pollée 2× par la landing page (toutes les 30 s
 * par UpcomingLiveFloat + 60 s par LiveAnnouncementBar) pour CHAQUE
 * visiteur. Sur Vercel avec une seule region cdg1, cela sature rapidement
 * le pool de serverless functions. On cache donc la réponse 10 s au niveau
 * edge (s-maxage=10) avec stale-while-revalidate=30 — toutes les requêtes
 * dans la même seconde tombent sur la même réponse cachée.
 *
 * 10 s est assez court pour qu'un live qui démarre soit visible
 * rapidement par les viewers, et assez long pour absorber les pics.
 */
export async function GET() {
  try {
    const lives = await db.liveStream.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE"] } },
      orderBy: { scheduledAt: "asc" },
      include: { servant: true },
    });
    const res = NextResponse.json({
      lives: lives.map((l) => ({
        id: l.id,
        title: l.title,
        scheduledAt: l.scheduledAt.toISOString(),
        status: l.status,
        servantName: l.servant.shortName,
        servantCode: l.servant.code,
        // (S5) Les miniatures data URL < 150KB sont autorisées (compressées par sharp)
        thumbnailUrl:
          l.thumbnailUrl &&
          (!l.thumbnailUrl.startsWith("data:") ||
            l.thumbnailUrl.length < 150000)
            ? l.thumbnailUrl
            : null,
        youtubeUrl: l.youtubeUrl,
      })),
    });
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=10, stale-while-revalidate=30",
    );
    return res;
  } catch {
    return NextResponse.json({ lives: [] });
  }
}
