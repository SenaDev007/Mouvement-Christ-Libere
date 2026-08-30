import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/videos/[id]/project
 *
 * Sauvegarde l'état du projet de post-production (cloud sync).
 * Stocke l'état complet (timeline, overlays, filtres, etc.) dans le champ
 * `projectState` de la vidéo (JSON).
 *
 * GET /api/videos/[id]/project
 * Récupère l'état sauvegardé.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await db.video.findUnique({
      where: { id },
      select: { id: true, title: true, projectState: true },
    });
    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }
    return NextResponse.json({
      videoId: video.id,
      title: video.title,
      projectState: video.projectState,
    });
  } catch (error) {
    console.error("[videos/project GET]", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

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

    const { id } = await params;
    const body = await req.json();

    // projectState est stocké en JSON dans le champ dédié
    await db.video.update({
      where: { id },
      data: {
        projectState: body,
      },
    });

    return NextResponse.json({ success: true, videoId: id });
  } catch (error) {
    console.error("[videos/project POST]", error);
    return NextResponse.json({ error: "Erreur sauvegarde" }, { status: 500 });
  }
}
