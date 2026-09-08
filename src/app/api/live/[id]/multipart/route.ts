import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { traiterRequeteMultipart } from "@/lib/multipart-shared";

/**
 * POST /api/live/[id]/multipart
 *
 * ⭐ V3.51 — Upload SÉQUENTIEL par morceaux vers Cloudflare R2 pour les
 * REPLAYS de live (studio). Remplace le PUT monolithique du replay : chaque
 * morceau (~8 Mo) est envoyé séparément avec reprise individuelle — un
 * hoquet réseau en fin d'envoi d'un replay de 500 Mo ne redémarre plus
 * tout l'upload.
 *
 * Voir src/lib/multipart-shared.ts pour le protocole détaillé
 * (actions create | part | complete | abort).
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

    const { id } = await params;

    const live = await db.liveStream.findUnique({ where: { id } });
    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    // Les clés replays sont générées avec l'id du LIVE comme identifiant
    // (cf. /api/live/[id]/presign — generateKey("replays", id, ext)).
    return traiterRequeteMultipart({
      req,
      prefixeKey: "replays",
      idEnregistrement: id,
    });
  } catch (error) {
    console.error("[live/multipart] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload multipart" },
      { status: 500 }
    );
  }
}
