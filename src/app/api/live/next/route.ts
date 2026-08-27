/** GET /api/live/next — Prochain direct programmé */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const nextLive = await db.liveStream.findFirst({
      where: {
        status: { in: ["SCHEDULED", "LIVE"] },
      },
      orderBy: { scheduledAt: "asc" },
      include: { servant: true },
    });

    if (!nextLive) {
      return NextResponse.json({ live: null });
    }

    return NextResponse.json({
      live: {
        id: nextLive.id,
        title: nextLive.title,
        description: nextLive.description,
        scheduledAt: nextLive.scheduledAt.toISOString(),
        status: nextLive.status,
        servantName: nextLive.servant.shortName,
        servantCode: nextLive.servant.code,
        servantPortraitUrl: nextLive.servant.portraitUrl,
        youtubeUrl: nextLive.youtubeUrl,
        thumbnailUrl: nextLive.thumbnailUrl,
      },
    });
  } catch (error) {
    console.error("[api/live/next]", error);
    return NextResponse.json({ live: null });
  }
}
