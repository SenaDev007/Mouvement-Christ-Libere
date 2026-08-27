/** GET /api/live/active — Direct en cours (status LIVE) */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeLive = await db.liveStream.findFirst({
      where: { status: "LIVE" },
      include: { servant: true },
    });

    if (!activeLive) {
      return NextResponse.json({ live: null });
    }

    return NextResponse.json({
      live: {
        id: activeLive.id,
        title: activeLive.title,
        description: activeLive.description,
        startedAt: activeLive.startedAt?.toISOString(),
        status: activeLive.status,
        servantName: activeLive.servant.shortName,
        servantCode: activeLive.servant.code,
        youtubeUrl: activeLive.youtubeUrl,
      },
    });
  } catch (error) {
    console.error("[api/live/active]", error);
    return NextResponse.json({ live: null });
  }
}
