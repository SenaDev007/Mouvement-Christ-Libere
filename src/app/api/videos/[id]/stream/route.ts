import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureV29Schema } from "@/lib/ensure-schema";

/**
 * ⭐ V2.9 — GET /api/videos/[id]/stream[?download=1]
 *
 * Diffuse le blob vidéo assemblé (table VideoBlob) avec support des
 * requêtes HTTP Range — indispensable pour que <video> puisse chercher
 * (seek) dans la vidéo sans la télécharger entièrement.
 *
 * Public (comme les vidéos) : les pages publiques embarquent le lecteur.
 * Option ?download=1 → Content-Disposition attachment (bouton Télécharger).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ensureV29Schema();

    // Ne sélectionner QUE ce blob (les listes ne le chargent jamais).
    const rows: { data: Buffer; mime: string; size: number }[] = await db.$queryRawUnsafe(
      `SELECT data, mime, size FROM "VideoBlob" WHERE "videoId" = $1`,
      id,
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Aucun fichier pour cette vidéo" }, { status: 404 });
    }
    const { data, mime, size } = rows[0];
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const total = buffer.length || size;

    const isDownload = new URL(req.url).searchParams.get("download") === "1";
    const disposition = isDownload ? "attachment" : "inline";
    const baseHeaders: Record<string, string> = {
      "Content-Type": mime || "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `${disposition}; filename="video-${id}.mp4"`,
    };

    // ─── Requête Range (seek du lecteur vidéo) ───
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2]
          ? Math.min(parseInt(match[2], 10), total - 1)
          : total - 1;
        if (start <= end && start < total) {
          const chunk = buffer.subarray(start, end + 1);
          return new NextResponse(new Uint8Array(chunk), {
            status: 206,
            headers: {
              ...baseHeaders,
              "Content-Range": `bytes ${start}-${end}/${total}`,
              "Content-Length": String(chunk.length),
            },
          });
        }
      }
      // Range invalide
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    // ─── Réponse complète ───
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(total) },
    });
  } catch (error) {
    console.error("[videos/stream] Error:", error);
    return NextResponse.json({ error: "Erreur de streaming" }, { status: 500 });
  }
}
