import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getPresignedUploadUrl, getPublicUrl, generateKey, isB2Configured } from "@/lib/b2";

/**
 * POST /api/live/[id]/presign
 *
 * Génère une URL pré-signée pour upload direct d'un gros fichier vidéo
 * depuis le navigateur vers Backblaze B2 (sans passer par le body Vercel).
 *
 * Body: { contentType: "video/webm" }
 * Response: { uploadUrl, publicUrl, key }
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

    if (!isB2Configured()) {
      return NextResponse.json(
        { error: "Backblaze B2 non configuré. Ajoutez B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT dans .env" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { contentType = "video/webm" } = body;

    const ext = contentType.includes("mp4") ? "mp4" : "webm";
    const key = generateKey("replays", id, ext);
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 7200); // 2h validité
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (error) {
    console.error("[presign] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur génération URL" },
      { status: 500 }
    );
  }
}
