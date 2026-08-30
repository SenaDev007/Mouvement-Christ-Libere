import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { uploadToR2, generateKey, isR2Configured } from "@/lib/r2";

/**
 * POST /api/videos/[id]/upload
 *
 * Deux modes d'upload :
 *
 * 1. COMMIT (JSON) — après un upload direct vers R2 via URL pré-signée :
 *    Body: { r2Url: "https://..." }
 *    → Persiste simplement l'URL R2 en base. Ne reçoit PAS le fichier
 *      (il est déjà sur R2). C'est le chemin recommandé pour les gros
 *      fichiers car il bypass le body de la fonction Vercel.
 *
 * 2. FORMDATA (legacy / fallback) — le fichier transite par le body :
 *    Body: FormData avec champ "file"
 *    → Upload le fichier vers R2 côté serveur (ou base64 si R2 absent).
 *      Limité par le maxDuration (300 s) et la taille du body Vercel.
 *      Rétro-compatibilité pour le cas où R2 n'est pas configuré.
 *
 * Réponse : { success: true, videoUrl: string, storage: "r2" | "base64" | "commit" }
 */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max pour les gros fichiers (mode FormData uniquement)

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

    // ─── Mode 1 : COMMIT après upload direct R2 ───
    // Le content-type est JSON → le fichier a déjà été uploadé via presigned PUT
    // et on reçoit juste l'URL publique à persister.
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const r2Url = body.r2Url;
      if (!r2Url || typeof r2Url !== "string") {
        return NextResponse.json(
          { error: "Champ 'r2Url' manquant dans le body JSON" },
          { status: 400 }
        );
      }

      await db.video.update({ where: { id }, data: { videoUrl: r2Url } });
      console.log(`[videos/upload] Commit — Vidéo ${id} → ${r2Url}`);
      return NextResponse.json({ success: true, videoUrl: r2Url, storage: "commit" });
    }

    // ─── Mode 2 : FormData (legacy / fallback sans R2) ───
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
