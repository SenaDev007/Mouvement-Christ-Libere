import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /admin/api/servants/[id]/stream-config
 *
 * Enregistre ou met à jour les clés RTMP d'un serviteur.
 * Réservé aux admins authentifiés.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier l'authentification admin
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Vérifier que le serviteur existe
    const servant = await db.servant.findUnique({ where: { id } });
    if (!servant) {
      return NextResponse.json({ error: "Serviteur introuvable" }, { status: 404 });
    }

    // Upsert (créer ou mettre à jour) la config
    const config = await db.servantStreamConfig.upsert({
      where: { servantId: id },
      create: {
        servantId: id,
        youtubeRtmpUrl: body.youtubeRtmpUrl || null,
        youtubeRtmpKey: body.youtubeRtmpKey || null,
        facebookRtmpUrl: body.facebookRtmpUrl || null,
        facebookRtmpKey: body.facebookRtmpKey || null,
        tiktokRtmpUrl: body.tiktokRtmpUrl || null,
        tiktokRtmpKey: body.tiktokRtmpKey || null,
        instagramRtmpUrl: body.instagramRtmpUrl || null,
        instagramRtmpKey: body.instagramRtmpKey || null,
      },
      update: {
        youtubeRtmpUrl: body.youtubeRtmpUrl || null,
        youtubeRtmpKey: body.youtubeRtmpKey || null,
        facebookRtmpUrl: body.facebookRtmpUrl || null,
        facebookRtmpKey: body.facebookRtmpKey || null,
        tiktokRtmpUrl: body.tiktokRtmpUrl || null,
        tiktokRtmpKey: body.tiktokRtmpKey || null,
        instagramRtmpUrl: body.instagramRtmpUrl || null,
        instagramRtmpKey: body.instagramRtmpKey || null,
      },
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("[stream-config] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement" },
      { status: 500 }
    );
  }
}
