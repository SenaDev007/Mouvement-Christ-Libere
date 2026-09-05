import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { uploadToR2, generateKey, isR2Configured } from "@/lib/r2";

/**
 * POST /api/live/[id]/recording
 *
 * Upload un replay vidéo (webm) enregistré côté client via MediaRecorder.
 * Le fichier est reçu en multipart/form-data (champ "file").
 *
 * ⭐ V3.33 — NOUVEAU mode JSON : { recordingUrl } (Content-Type:
 * application/json) — utilisé par le studio APRÈS l'arrêt du live quand le
 * replay volumineux a été uploadé DIRECTEMENT vers R2 via URL pré-signée
 * (PUT navigateur). Ce mode ne re-transfère rien : il se contente de
 * persister l'URL sur le LiveStream et sur la vidéo (Replay) déjà archivée
 * par /api/live/stop.
 *
 * Stockage : Backblaze B2 (compatible S3). URL publique retournée et stockée en DB.
 * Fallback : si B2 n'est pas configuré, stockage base64 en DB (limite ~4MB).
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

    // ─── ⭐ V3.33 — Mode JSON : persister une URL R2 déjà uploadée ───
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const recordingUrl = typeof body.recordingUrl === "string" ? body.recordingUrl.trim() : "";
      if (!recordingUrl) {
        return NextResponse.json({ error: "recordingUrl requis" }, { status: 400 });
      }
      await db.liveStream.update({
        where: { id },
        data: { recordingUrl },
      });
      const liveMeta = await db.liveStream.findUnique({
        where: { id },
        select: { title: true, servantId: true },
      });
      if (liveMeta) {
        const existingReplay = await db.video.findFirst({
          where: {
            servantId: liveMeta.servantId,
            title: { startsWith: `${liveMeta.title} (Replay)` },
          },
        });
        if (existingReplay) {
          await db.video.update({
            where: { id: existingReplay.id },
            data: { videoUrl: recordingUrl, hlsUrl: recordingUrl },
          });
        }
      }
      return NextResponse.json({ success: true, recordingUrl, storage: "r2-direct" });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "video/webm";

    let recordingUrl: string;

    if (isR2Configured()) {
      // ─── Upload vers Cloudflare R2 ───
      const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "bin";
      const key = generateKey("replays", id, ext);
      recordingUrl = await uploadToR2(key, buffer, mimeType);
      console.log(`[recording] Uploadé vers R2: ${recordingUrl} (${Math.round(buffer.length / 1024 / 1024)}MB)`);
    } else {
      // ─── Fallback : base64 en DB (limite ~4MB Vercel) ───
      if (buffer.length > 4 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Fichier trop volumineux (max 4MB sans R2 — configurez Cloudflare R2 pour les gros fichiers)" },
          { status: 413 }
        );
      }
      const base64 = buffer.toString("base64");
      recordingUrl = `data:${mimeType};base64,${base64}`;
      console.log(`[recording] Stocké en base64 (fallback, ${Math.round(buffer.length / 1024)}KB)`);
    }

    // Mettre à jour le live avec le recordingUrl
    await db.liveStream.update({
      where: { id },
      data: { recordingUrl },
    });

    // Mettre à jour aussi le replay (Video) si il existe déjà
    const live = await db.liveStream.findUnique({
      where: { id },
      select: { title: true, servantId: true },
    });

    if (live) {
      const existingReplay = await db.video.findFirst({
        where: {
          servantId: live.servantId,
          title: { startsWith: `${live.title} (Replay)` },
        },
      });

      if (existingReplay) {
        await db.video.update({
          where: { id: existingReplay.id },
          data: { videoUrl: recordingUrl },
        });
      }
    }

    return NextResponse.json({
      success: true,
      recordingUrl,
      size: Math.round(file.size / 1024),
      storage: isR2Configured() ? "r2" : "base64",
    });
  } catch (error) {
    console.error("[recording upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload recording" },
      { status: 500 }
    );
  }
}
