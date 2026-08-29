import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/live/upcoming
 *
 * Retourne TOUS les lives programmés + en cours (pour le carrousel).
 */
export async function GET() {
  try {
    const lives = await db.liveStream.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE"] } },
      orderBy: { scheduledAt: "asc" },
      include: { servant: true },
    });
    return NextResponse.json({
      lives: lives.map((l) => ({
        id: l.id,
        title: l.title,
        scheduledAt: l.scheduledAt.toISOString(),
        status: l.status,
        servantName: l.servant.shortName,
        servantCode: l.servant.code,
        thumbnailUrl: l.thumbnailUrl,
        youtubeUrl: l.youtubeUrl,
      })),
    });
  } catch {
    return NextResponse.json({ lives: [] });
  }
}
