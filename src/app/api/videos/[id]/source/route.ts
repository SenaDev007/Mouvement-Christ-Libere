import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ensureTiktokMp4UrlColumn } from "@/lib/ensure-schema";

/**
 * GET /api/videos/[id]/source
 *
 * Retourne l'URL de la vidéo source (pour la post-production).
 * Les data URLs base64 géantes ne peuvent pas être passées via les props SSR
 * (limite de sérialisation Next.js ~128KB), donc on les récupère via cette API.
 *
 * ⭐ V4.04 — renvoie AUSSI tiktokMp4Url (copie R2 de lecture) : le lecteur
 * d'aperçu de la post-production joue notre fichier quand il existe,
 * immunisé contre l'erreur « overload-protect triggered » du CDN TikTok.
 *
 * Response: { videoUrl: string | null, tiktokMp4Url: string | null }
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
    // ⭐ V4.04 — colonne tiktokMp4Url sélectionnée → garantie avant requête.
    await ensureTiktokMp4UrlColumn();
    const video = await db.video.findUnique({
      where: { id },
      select: { videoUrl: true, tiktokMp4Url: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      videoUrl: video.videoUrl,
      tiktokMp4Url: video.tiktokMp4Url ?? null,
    });
  } catch (error) {
    console.error("[video source] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
