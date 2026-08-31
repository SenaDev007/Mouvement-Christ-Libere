import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ensureV29Schema } from "@/lib/ensure-schema";

/**
 * ⭐ V2.9 — POST /api/videos/[id]/chunk?index=N
 *
 * Upload d'UN bloc vidéo (corps HTTP = octets bruts du bloc).
 *
 * POURQUOI : Vercel limite le body des fonctions serverless à ~4,5 Mo
 * (plan Hobby) → l'upload complet d'une vidéo en FormData échoue avec
 * HTTP 413 (l'utilisateur voyait « 100 % puis 413 » après de longues
 * minutes d'attente). En découpant le fichier en blocs ≤ 3,5 Mo côté
 * navigateur, chaque requête passe sous la limite.
 *
 * Flux complet (client) :
 *   1. POST /chunk?index=0..N  (binaire)   → stocke chaque bloc
 *   2. POST /chunk/complete    (JSON mime) → assemble dans VideoBlob
 *   3. GET  /stream            (Range)     → lecture vidéo
 *
 * Body : octets bruts du bloc (Content-Type: application/octet-stream).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHUNK_BYTES = 4 * 1024 * 1024; // 4 Mo (marge sous la limite Vercel)

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
    await ensureV29Schema();

    const video = await db.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }

    const url = new URL(req.url);
    const index = parseInt(url.searchParams.get("index") || "", 10);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "index invalide" }, { status: 400 });
    }

    const chunkBuffer = Buffer.from(await req.arrayBuffer());
    if (chunkBuffer.length === 0) {
      return NextResponse.json({ error: "bloc vide" }, { status: 400 });
    }
    if (chunkBuffer.length > MAX_CHUNK_BYTES) {
      return NextResponse.json(
        { error: `bloc trop gros (${chunkBuffer.length} > ${MAX_CHUNK_BYTES})` },
        { status: 413 },
      );
    }

    // Upsert idempotent du bloc (reprise après erreur réseau : le même
    // index est simplement remplacé).
    await db.$executeRawUnsafe(
      `INSERT INTO "VideoChunk" ("id", "videoId", "idx", "data")
       VALUES (gen_random_uuid()::text, $1, $2, $3)
       ON CONFLICT ("videoId", "idx")
       DO UPDATE SET "data" = EXCLUDED."data"`,
      id,
      index,
      chunkBuffer,
    );

    return NextResponse.json({ success: true, index, size: chunkBuffer.length });
  } catch (error) {
    console.error("[videos/chunk] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
