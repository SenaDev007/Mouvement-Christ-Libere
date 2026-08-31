import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getPresignedUploadUrl, getPublicUrl, generateKey, isR2Configured, ensureR2CorsConfig } from "@/lib/r2";

/**
 * POST /api/videos/[id]/presign
 *
 * Génère une URL pré-signée pour upload DIRECT du navigateur vers
 * Cloudflare R2, sans passer par le body de la fonction Next.js.
 *
 * POURQUOI CETTE ROUTE EXISTE :
 * ------------------------------
 * Avant, l'upload post-production envoyait le fichier vidéo via FormData
 * à /api/videos/[id]/upload. Le fichier transitait donc entièrement par
 * le body de la serverless function Vercel, avec deux limitations fatales
 * pour les gros replays (> 100 MB) :
 *   1. Vercel limite la taille du body à 4.5 MB (Hobby) / 50 MB (Pro)
 *   2. La fonction a un maxDuration de 300 s (5 min) — un replay de 1 GB
 *      sur une connexion 5 Mbps prend ~30 min → timeout → upload échoue
 *
 * Avec cette route, le navigateur :
 *   1. Demande une URL pré-signée (cette route — ne transmet QUE le
 *      content-type, pas le fichier lui-même)
 *   2. Uploade le fichier DIRECTEMENT vers R2 via PUT XMLHttpRequest
 *      (bypass total du body Vercel — pas de limite de taille, pas de
 *      timeout de fonction)
 *   3. Confirme l'upload en appelant /api/videos/[id]/upload avec
 *      { r2Url: publicUrl } pour persister l'URL en base
 *
 * Body: { contentType: "video/mp4", filename?: "replay.mp4" }
 * Response: { uploadUrl, publicUrl, key }
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

    if (!isR2Configured()) {
      return NextResponse.json(
        {
          error: "Cloudflare R2 non configuré. L'upload direct nécessite R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).",
          r2NotConfigured: true,
        },
        { status: 503 }
      );
    }

    // (S5) S'assurer que le CORS est configuré sur R2 pour autoriser
    // les uploads presigned PUT depuis le navigateur. Idempotent.
    await ensureR2CorsConfig();

    const { id } = await params;

    const video = await db.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }

    const body = await req.json();
    const contentType = body.contentType || "video/mp4";
    const filename = body.filename || "";

    // Déterminer l'extension depuis le content-type ou le nom du fichier
    const extFromName = filename.includes(".")
      ? filename.split(".").pop()!.toLowerCase()
      : "";
    const extFromMime = contentType.split("/")[1] || "mp4";
    const ext = (extFromName || extFromMime).replace(/[^a-z0-9]/g, "") || "mp4";

    const key = generateKey("videos", `video-${id}`, ext);
    // 2h de validité — assez pour uploader même un gros replay sur connexion lente
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 7200);
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (error) {
    console.error("[videos/presign] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur génération URL pré-signée" },
      { status: 500 }
    );
  }
}
