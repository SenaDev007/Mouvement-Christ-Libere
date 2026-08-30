import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { uploadToR2, generateKey, isR2Configured } from "@/lib/r2";

/**
 * POST /api/videos/[id]/upload
 *
 * Téléverse un fichier vidéo (FormData, champ "file") et met à jour
 * Video.videoUrl en base.
 *
 * Stockage : Cloudflare R2 (pas de limite de taille côté serveur).
 * L'upload se fait via XMLHttpRequest côté client pour suivre la progression.
 *
 * Réponse : { success: true, videoUrl: string, storage: "r2" }
 */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max pour les gros fichiers

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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant (champ 'file')" }, { status: 400 });
    }

    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Type de fichier invalide (vidéo attendue)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "video/mp4";

    const extFromName = file.name.includes(".")
      ? file.name.split(".").pop()!.toLowerCase()
      : "";
    const extFromMime = mimeType.split("/")[1] || "mp4";
    const ext = (extFromName || extFromMime).replace(/[^a-z0-9]/g, "") || "mp4";

    let videoUrl: string;
    let storage: "r2" | "base64";

    if (isR2Configured()) {
      // Upload vers R2 — pas de limite (R2 gère les gros fichiers)
      const key = generateKey("videos", `video-${id}`, ext);
      videoUrl = await uploadToR2(key, buffer, mimeType);
      storage = "r2";
      console.log(`[videos/upload] Vidéo ${id} uploadée vers R2 (${Math.round(buffer.length / 1024 / 1024)}MB): ${videoUrl}`);
    } else {
      // Fallback base64 — limite 4MB uniquement si R2 n'est pas configuré
      if (buffer.length > 4 * 1024 * 1024) {
        return NextResponse.json(
          { error: `Fichier trop volumineux (${Math.round(buffer.length / 1024 / 1024)}MB — configurez Cloudflare R2 pour les gros fichiers)` },
          { status: 413 }
        );
      }
      const base64 = buffer.toString("base64");
      videoUrl = `data:${mimeType};base64,${base64}`;
      storage = "base64";
      console.log(`[videos/upload] Vidéo ${id} stockée en base64 (fallback, ${Math.round(buffer.length / 1024)}KB)`);
    }

    await db.video.update({ where: { id }, data: { videoUrl } });

    return NextResponse.json({ success: true, videoUrl, storage });
  } catch (error) {
    console.error("[videos/upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload" },
      { status: 500 }
    );
  }
}
