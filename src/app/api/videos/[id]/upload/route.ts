import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { uploadToR2, generateKey, isR2Configured } from "@/lib/r2";

/**
 * POST /api/videos/[id]/upload
 *
 * Upload une vidéo source pour la post-production (replay manuel).
 * Reçoit le fichier en multipart/form-data (champ "file").
 *
 * Stockage : Cloudflare R2 (compatible S3). URL publique retournée et stockée en DB.
 * Fallback : si R2 n'est pas configuré, stockage base64 en DB (limite ~4MB).
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Type de fichier non supporté (utilisez MP4, WebM, etc.)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type;

    let videoUrl: string;

    if (isR2Configured()) {
      const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "bin";
      const key = generateKey("videos", id, ext);
      videoUrl = await uploadToR2(key, buffer, mimeType);
      console.log(`[video upload] Uploadé vers R2: ${videoUrl} (${Math.round(buffer.length / 1024 / 1024)}MB)`);
    } else {
      if (buffer.length > 4 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Fichier trop volumineux (max 4MB sans R2 — configurez Cloudflare R2 pour les gros fichiers)" },
          { status: 413 }
        );
      }
      const base64 = buffer.toString("base64");
      videoUrl = `data:${mimeType};base64,${base64}`;
      console.log(`[video upload] Stocké en base64 (fallback, ${Math.round(buffer.length / 1024)}KB)`);
    }

    await db.video.update({
      where: { id },
      data: { videoUrl },
    });

    return NextResponse.json({
      success: true,
      videoUrl,
      size: Math.round(file.size / 1024),
      storage: isR2Configured() ? "r2" : "base64",
    });
  } catch (error) {
    console.error("[video upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload vidéo" },
      { status: 500 }
    );
  }
}
