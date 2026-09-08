/** GET /api/live/active — Direct en cours (status LIVE) */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
// ⭐ V3.46 — colonne LiveStream.category (rubriques) : le findFirst la
// sélectionne → garde avant lecture (auto-création idempotente).
import { ensureLiveCategoryColumn } from "@/lib/ensure-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureLiveCategoryColumn().catch(() => {});
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
        servantPortraitUrl: activeLive.servant.portraitUrl,
        youtubeUrl: activeLive.youtubeUrl,
        facebookUrl: activeLive.facebookUrl,
        tiktokUrl: activeLive.tiktokUrl,
        livekitRoomName: activeLive.livekitRoomName,
        viewerCount: activeLive.viewerCount,
        // (S5) Les miniatures data URL < 150KB sont autorisées (compressées par sharp)
        thumbnailUrl:
          activeLive.thumbnailUrl &&
          (!activeLive.thumbnailUrl.startsWith("data:") ||
            activeLive.thumbnailUrl.length < 150000)
            ? activeLive.thumbnailUrl
            : null,
      },
    });
  } catch (error) {
    console.error("[api/live/active]", error);
    return NextResponse.json({ live: null });
  }
}
