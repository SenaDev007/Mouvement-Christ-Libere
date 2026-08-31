import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/live/[id]/pause
 *
 * Bascule l'état de pause d'un live côté serveur.
 *
 * Body: { paused: boolean }
 *
 * Pourquoi cette route existe :
 * --------------------------------
 * Les viewers YouTube ne se connectent pas à LiveKit (le studio publie sur
 * LiveKit, puis l'egress RTMP transcode vers YouTube). Le signal de pause
 * envoyé via DataChannel LiveKit n'arrive donc jamais aux viewers YouTube.
 * On persiste l'état de pause en base pour que ces viewers puissent le
 * récupérer via le polling /api/live/next (toutes les 3 s).
 *
 * Effets de bord :
 *  - isPaused passe à true/false
 *  - pausedAt est setté à now() quand on entre en pause, et remis à null
 *    quand on reprend. Cela permet aux viewers YouTube de geler la minuterie
 *    côté client (durée affichée = pausedAt - startedAt pendant la pause).
 *  - Le statut du live reste "LIVE" — la pause est purement runtime.
 *
 * Réservé aux admins authentifiés (cookie admin_session).
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
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id: liveId } = await params;
    if (!liveId) {
      return NextResponse.json({ error: "liveId requis" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const paused = !!body.paused;

    const live = await db.liveStream.findUnique({
      where: { id: liveId },
      select: { id: true, status: true, startedAt: true },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    if (live.status !== "LIVE") {
      return NextResponse.json(
        { error: "Le live n'est pas en cours" },
        { status: 400 }
      );
    }

    await db.liveStream.update({
      where: { id: liveId },
      data: {
        isPaused: paused,
        pausedAt: paused ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      liveId,
      isPaused: paused,
      pausedAt: paused ? new Date().toISOString() : null,
    });
  } catch (error) {
    console.error("[api/live/[id]/pause]", error);
    return NextResponse.json(
      { error: "Erreur lors du basculement de la pause" },
      { status: 500 }
    );
  }
}
