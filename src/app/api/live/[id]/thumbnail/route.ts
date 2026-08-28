import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/live/[id]/thumbnail
 *
 * Stocke la miniature d'un live directement en DB (base64 data URL).
 *
 * On n'écrit PAS sur le système de fichiers car Vercel a un FS en lecture seule
 * en production. Le base64 est stocké dans la colonne thumbnailUrl (type TEXT)
 * et s'affiche directement via <img src="data:image/jpeg;base64,...">.
 *
 * Body: { thumbnail: "data:image/jpeg;base64,..." }
 */
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
    const { thumbnail } = body;

    if (!thumbnail || !thumbnail.startsWith("data:image/")) {
      return NextResponse.json({ error: "Image invalide" }, { status: 400 });
    }

    // Vérifier le format du data URL
    const matches = thumbnail.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: "Format invalide" }, { status: 400 });
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    // Limiter à 10MB (l'image compressée côté client fait ~200-300KB)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image trop lourde (max 10MB)" }, { status: 400 });
    }

    // Stocker le data URL directement en DB (pas d'écriture fichier — Vercel FS read-only)
    await db.liveStream.update({
      where: { id },
      data: { thumbnailUrl: thumbnail },
    });

    return NextResponse.json({ success: true, thumbnailUrl: thumbnail });
  } catch (error) {
    console.error("[thumbnail upload] Error:", error);
    return NextResponse.json({ error: "Erreur upload" }, { status: 500 });
  }
}
