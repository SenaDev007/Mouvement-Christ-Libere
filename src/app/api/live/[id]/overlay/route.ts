import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ensureLiveOverlayTable, saveLiveOverlayState } from "@/lib/live-overlay-state";

/**
 * ⭐ V3.33 — POST /api/live/[id]/overlay
 *
 * Persiste l'état de l'overlay du studio (ON/OFF, images, slides, texte,
 * slide courante) pour qu'il soit RESTAURÉ au rechargement de la page
 * (coupure de connexion pendant un direct : l'overlay ne se désactive
 * plus seul — anomalie remontée par le pasteur).
 *
 * Body : { enabled: boolean, state?: MediaOverlayPersistPayload | null }
 *
 * Garde-fous :
 *  - Réservé aux admins authentifiés (cookie admin_session) ;
 *  - Table dédiée créée au runtime (CREATE TABLE IF NOT EXISTS — aucune
 *    colonne ajoutée à LiveStream, les requêtes Prisma existantes ne
 *    changent pas) ;
 *  - Limite de taille (~4,5 Mo de JSON) : les images étant des data-URL,
 *    on refuse poliment les charges déraisonnables ;
 *  - Best-effort côté studio : un échec de persistance n'interrompt JAMAIS
 *    la diffusion.
 */
const MAX_STATE_JSON_LENGTH = 4_500_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth admin (même garde que /api/live/[id]/pause)
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: liveId } = await params;
    if (!liveId) {
      return NextResponse.json({ error: "liveId requis" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const enabled = !!body.enabled;
    const state = body.state ?? null;

    // Le live doit exister (on ne persiste pas sur un id fantôme).
    const { db } = await import("@/lib/db");
    const live = await db.liveStream.findUnique({
      where: { id: liveId },
      select: { id: true },
    });
    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    // Garde-fou taille : images en data-URL parfois lourdes.
    if (state) {
      const serialized = JSON.stringify(state);
      if (serialized.length > MAX_STATE_JSON_LENGTH) {
        return NextResponse.json(
          { error: "État overlay trop volumineux — persistance ignorée" },
          { status: 413 }
        );
      }
    }

    await ensureLiveOverlayTable();
    await saveLiveOverlayState(liveId, enabled, state ?? null);

    return NextResponse.json({ success: true, liveId, enabled });
  } catch (error) {
    console.error("[api/live/[id]/overlay] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la persistance de l'overlay" },
      { status: 500 }
    );
  }
}
