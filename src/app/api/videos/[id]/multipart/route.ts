import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { traiterRequeteMultipart } from "@/lib/multipart-shared";

/**
 * POST /api/videos/[id]/multipart
 *
 * ⭐ V3.51 — Upload SÉQUENTIEL par morceaux vers Cloudflare R2 pour les
 * vidéos (modal « Nouvelle vidéo », post-production, suppression de fond).
 * Remplace le PUT monolithique (fichier entier en une requête) : chaque
 * morceau (~8 Mo) est envoyé séparément avec reprise individuelle —
 * un hoquet réseau ne redémarre plus tout l'envoi.
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

    const video = await db.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }

    // Les clés vidéos sont générées avec `video-${id}` comme identifiant
    // (cf. /api/videos/[id]/presign) — le key renvoyé par le client est
    // validé contre ce motif exact côté multipart-shared.
    return traiterRequeteMultipart({
      req,
      prefixeKey: "videos",
      idEnregistrement: `video-${id}`,
    });
  } catch (error) {
    console.error("[videos/multipart] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload multipart" },
      { status: 500 }
    );
  }
}
