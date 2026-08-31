import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ensureV29Schema } from "@/lib/ensure-schema";

/**
 * ⭐ V2.9 — POST /api/videos/[id]/chunk/complete
 *
 * Assemble les blocs uploadés via /chunk en un seul blob (table VideoBlob)
 * et fait pointer Video.videoUrl vers la route de streaming /stream.
 *
 * Body: { mime?: string, size?: number }  (taille totale attendue, contrôle)
 *
 * Après assemblage : les blocs temporaires sont purgés.
 */
export const runtime = "nodejs";
export const maxDuration = 300; // assemblage de gros blobs ( lecture DB )

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

    const video = await db.video.findUnique({ where: { id }, select: { id: true, videoUrl: true } });
    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const mime = typeof body.mime === "string" && body.mime.startsWith("video/")
      ? body.mime
      : "video/mp4";
    const expectedSize = typeof body.size === "number" ? body.size : null;

    // ─── Lire les blocs dans l'ordre ───
    const chunks: { idx: number; data: Buffer }[] = await db.$queryRawUnsafe(
      `SELECT idx, data FROM "VideoChunk" WHERE "videoId" = $1 ORDER BY idx ASC`,
      id,
    );

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Aucun bloc reçu — relancez l'upload" },
        { status: 400 },
      );
    }

    // Continuité des index (0..N-1) — un trou = upload interrompu.
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].idx !== i) {
        return NextResponse.json(
          { error: `Upload incomplet : bloc ${i} manquant (reçu ${chunks.length} blocs)` },
          { status: 400 },
        );
      }
    }

    const totalSize = chunks.reduce((acc, c) => acc + c.data.length, 0);
    if (expectedSize !== null && totalSize !== expectedSize) {
      return NextResponse.json(
        {
          error: `Taille assemblée (${totalSize}) ≠ taille attendue (${expectedSize}) — relancez l'upload`,
        },
        { status: 400 },
      );
    }

    // ─── Assembler en un seul buffer ───
    const blob = Buffer.concat(chunks.map((c) => c.data));

    // ─── Persister le blob (upsert : un re-upload remplace l'ancien blob) ───
    await db.$executeRawUnsafe(
      `INSERT INTO "VideoBlob" ("videoId", "data", "mime", "size")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("videoId")
       DO UPDATE SET "data" = EXCLUDED."data", "mime" = EXCLUDED."mime", "size" = EXCLUDED."size"`,
      id,
      blob,
      mime,
      totalSize,
    );

    // ─── Video.videoUrl → route de streaming ───
    const streamUrl = `/api/videos/${id}/stream`;
    await db.video.update({
      where: { id },
      data: { videoUrl: streamUrl },
    });

    // ─── Purger les blocs temporaires ───
    await db.$executeRawUnsafe(`DELETE FROM "VideoChunk" WHERE "videoId" = $1`, id);

    console.log(`[videos/chunk/complete] Blob assemblé pour ${id} : ${(totalSize / 1024 / 1024).toFixed(1)} Mo`);

    return NextResponse.json({
      success: true,
      videoUrl: streamUrl,
      storage: "db-chunked",
      size: totalSize,
    });
  } catch (error) {
    console.error("[videos/chunk/complete] Error:", error);
    return NextResponse.json({ error: "Erreur d'assemblage" }, { status: 500 });
  }
}
