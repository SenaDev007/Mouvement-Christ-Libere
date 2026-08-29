import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * GET /api/videos/[id]/source
 *
 * Retourne l'URL de la vidéo source (pour la post-production).
 * Les data URLs base64 géantes ne peuvent pas être passées via les props SSR
 * (limite de sérialisation Next.js ~128KB), donc on les récupère via cette API.
 *
 * Response: { videoUrl: string | null }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const video = await db.video.findUnique({
      where: { id },
      select: { videoUrl: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }

    return NextResponse.json({ videoUrl: video.videoUrl });
  } catch (error) {
    console.error("[video source] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
