/** GET /api/live/next — Prochain direct programmé */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ⭐ V3.26 — PRIORITÉ AU DIRECT EN COURS : avant, un simple findFirst
    // orderBy scheduledAt ASC sur {SCHEDULED, LIVE} — si un AUTRE live
    // programmé plus tôt existait en base, la route renvoyait CE live-là
    // (SCHEDULED) alors qu'un direct ÉTAIT EN COURS. Le viewer (et le
    // bandeau des directs à venir) en déduisait « direct terminé » à tort.
    // Désormais : un live LIVE (le plus récemment démarré) PRIME sur
    // tout programmé ; à défaut, le prochain programmé.
    const activeLive = await db.liveStream.findFirst({
      where: { status: "LIVE" },
      orderBy: { startedAt: "desc" },
      include: { servant: true },
    });
    const nextLive =
      activeLive ||
      (await db.liveStream.findFirst({
        where: { status: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" },
        include: { servant: true },
      }));

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
        // (S5) Les miniatures data URL sont maintenant compressées à < 50KB
        // par sharp côté serveur, donc sûres pour la sérialisation RSC.
        // On n'exclut que les data URLs géantes (> 150KB, sécurité).
        thumbnailUrl:
          nextLive.thumbnailUrl &&
          (!nextLive.thumbnailUrl.startsWith("data:") ||
            nextLive.thumbnailUrl.length < 150000)
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
