import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/live/[id]/recording
 *
 * Upload un replay vidéo (webm) enregistré côté client via MediaRecorder.
 * Le fichier est reçu en multipart/form-data (champ "file").
 *
 * Stockage : Le blob est converti en data URL base64 et stocké dans la colonne
 * videoUrl de la table Video (type TEXT — pas de limite PostgreSQL).
 *
 * Note : Vercel a un FS read-only en production, donc on ne peut pas écrire
 * de fichier. Le base64 en DB fonctionne pour les vidéos < ~4MB (limite body Vercel).
 * Pour les vidéos plus grandes, le client télécharge le fichier localement.
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

    // Vérifier la taille (limite ~4MB pour Vercel body)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 4MB pour upload auto — téléchargez localement)" },
        { status: 413 }
      );
    }

    // Convertir en data URL base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "video/webm";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Mettre à jour le live avec le recordingUrl
    await db.liveStream.update({
      where: { id },
      data: { recordingUrl: dataUrl },
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
          data: { videoUrl: dataUrl },
        });
      }
    }

    return NextResponse.json({
      success: true,
      recordingUrl: dataUrl,
      size: Math.round(file.size / 1024),
    });
  } catch (error) {
    console.error("[recording upload] Error:", error);
    return NextResponse.json({ error: "Erreur upload recording" }, { status: 500 });
  }
}
