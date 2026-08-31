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
        // (C6) Exposer startedAt pour que le viewer puisse recalculer la durée
        // côté client sans dépendre de la prop SSR (qui devient stale une fois
        // que le live démarre après le rendu initial de la page).
        startedAt: nextLive.startedAt ? nextLive.startedAt.toISOString() : null,
        status: nextLive.status,
        servantName: nextLive.servant.shortName,
        servantCode: nextLive.servant.code,
        servantPortraitUrl: nextLive.servant.portraitUrl,
        youtubeUrl: nextLive.youtubeUrl,
        // (S5) Exclure les data URLs base64 géantes (332KB) qui ralentissent
        // la sérialisation JSON. Les miniatures data URL sont récupérées
        // individuellement par le viewer via un appel dédié si nécessaire.
        thumbnailUrl:
          nextLive.thumbnailUrl && !nextLive.thumbnailUrl.startsWith("data:")
            ? nextLive.thumbnailUrl
            : null,
        // (YT-pause) État de pause persisté en base pour les viewers YouTube
        // (qui ne reçoivent pas le DataChannel LiveKit). Permet au viewer de
        // geler la minuterie et d'afficher la miniature pendant la pause.
        isPaused: nextLive.isPaused,
        pausedAt: nextLive.pausedAt ? nextLive.pausedAt.toISOString() : null,
      },
    });
  } catch (error) {
    console.error("[api/live/next]", error);
    return NextResponse.json({ live: null });
  }
}
