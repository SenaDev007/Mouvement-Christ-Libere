import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { resolveYoutubeReplayUrl, isYouTubeOAuthConfigured } from "@/lib/youtube";
import { appliquerUrlReplaySurLiveEtVideo } from "@/lib/live-replay-recovery";

/**
 * POST /api/live/[id]/youtube-replay
 *
 * Récupère automatiquement l'URL YouTube du replay d'un live terminé.
 *
 * Deux modes :
 * 1. Auto (sans body) : utilise l'API YouTube Data (OAuth) pour trouver
 *    le video ID du dernier broadcast terminé après startedAt.
 * 2. Manual (body: { youtubeUrl }) : valide et persiste une URL collée
 *    manuellement par l'admin.
 *
 * ⭐ V3.34 — Dans les DEUX cas, l'URL est désormais persistée sur le
 * LiveStream ET sur l'entrée Vidéo (Replay) — AVANT, seule
 * LiveStream.youtubeUrl était mise à jour : la vidéo récupérée restait
 * INVISIBLE dans le module Vidéos (anomalie remontée par le pasteur :
 * « si ça avait récupéré l'ID YouTube, on aurait eu accès direct à la
 * vidéo »).
 *
 * Réservé aux admins authentifiés.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: liveId } = await params;

    const live = await db.liveStream.findUnique({
      where: { id: liveId },
      select: {
        id: true,
        title: true,
        startedAt: true,
        endedAt: true,
        youtubeUrl: true,
        streamToYoutube: true,
        status: true,
      },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    // ─── Mode manuel : URL collée par l'admin ───
    if (body.youtubeUrl) {
      const url = String(body.youtubeUrl).trim();
      // Valider que c'est bien une URL YouTube
      if (!url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/)) {
        return NextResponse.json(
          { error: "URL YouTube invalide. Format attendu : https://www.youtube.com/watch?v=..." },
          { status: 400 }
        );
      }

      // ⭐ V3.34 — LiveStream + entrée Vidéo (Replay) via le helper partagé
      // (crée l'entrée si elle manque, pose la miniature YouTube si absente).
      await appliquerUrlReplaySurLiveEtVideo(liveId, url);

      return NextResponse.json({
        success: true,
        youtubeUrl: url,
        source: "manual",
      });
    }

    // ─── Mode auto : récupération via API YouTube ───
    if (!isYouTubeOAuthConfigured()) {
      return NextResponse.json({
        success: false,
        error: "OAuth YouTube non configuré. Ajoutez YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN dans les variables d'environnement.",
        oauthRequired: true,
      }, { status: 503 });
    }

    if (!live.startedAt) {
      return NextResponse.json(
        { error: "Le live n'a pas de date de début (startedAt null)" },
        { status: 400 }
      );
    }

    // YouTube peut mettre 30s à 5min pour publier le replay après la fin du RTMP.
    // On tente la récupération — l'appelant peut réessayer si ça échoue.
    const result = await resolveYoutubeReplayUrl(
      live.startedAt,
      live.youtubeUrl,
      live.title
    );

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "Aucune vidéo YouTube trouvée. YouTube peut encore être en train de traiter le replay. Réessayez dans 1-2 minutes.",
        retryable: true,
      }, { status: 404 });
    }

    // ⭐ V3.34 — persister sur le LiveStream ET sur l'entrée Vidéo (Replay)
    // via le helper partagé (crée l'entrée si elle manque — cas « fonction
    // /stop morte avant l'archivage » — et pose la miniature si absente).
    await appliquerUrlReplaySurLiveEtVideo(liveId, result.url);

    return NextResponse.json({
      success: true,
      youtubeUrl: result.url,
      videoId: result.videoId,
      source: result.source,
    });
  } catch (error) {
    console.error("[api/live/[id]/youtube-replay]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
