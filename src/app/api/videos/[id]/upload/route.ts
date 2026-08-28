import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/videos/[id]/upload
 *
 * Upload une vidéo source pour la post-production (replay manuel).
 * Reçoit le fichier en multipart/form-data (champ "file").
 *
 * Stockage : data URL base64 dans la colonne videoUrl (type TEXT).
 * Limite : ~4MB (contrainte Vercel body).
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

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 4MB — compressez ou raccourcissez la vidéo)" },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const mimeType = file.type;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    await db.video.update({
      where: { id },
      data: { videoUrl: dataUrl },
    });

    return NextResponse.json({
      success: true,
      videoUrl: dataUrl,
      size: Math.round(file.size / 1024),
    });
  } catch (error) {
    console.error("[video upload] Error:", error);
    return NextResponse.json({ error: "Erreur upload vidéo" }, { status: 500 });
  }
}
