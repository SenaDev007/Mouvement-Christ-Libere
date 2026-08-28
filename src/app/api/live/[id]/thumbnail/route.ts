import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { uploadToB2, generateKey, isB2Configured } from "@/lib/b2";

/**
 * POST /api/live/[id]/thumbnail
 *
 * Stocke la miniature d'un live.
 *
 * Stockage : Backblaze B2 (compatible S3). URL publique retournée et stockée en DB.
 * Fallback : si B2 n'est pas configuré, stockage base64 en DB (data URL).
 *
 * Body: { thumbnail: "data:image/jpeg;base64,..." }
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
    const body = await req.json();
    const { thumbnail } = body;

    if (!thumbnail || !thumbnail.startsWith("data:image/")) {
      return NextResponse.json({ error: "Image invalide" }, { status: 400 });
    }

    // Vérifier le format du data URL
    const matches = thumbnail.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: "Format invalide" }, { status: 400 });
    }

    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    const mimeType = `image/${matches[1] === "jpg" ? "jpeg" : matches[1]}`;

    // Limiter à 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image trop lourde (max 10MB)" }, { status: 400 });
    }

    let thumbnailUrl: string;

    if (isB2Configured()) {
      // ─── Upload vers Backblaze B2 ───
      const key = generateKey("thumbnails", `live-${id}`, ext);
      thumbnailUrl = await uploadToB2(key, buffer, mimeType);
      console.log(`[thumbnail] Uploadé vers B2: ${thumbnailUrl}`);
    } else {
      // ─── Fallback : base64 en DB ───
      thumbnailUrl = thumbnail; // data URL
      console.log(`[thumbnail] Stocké en base64 (fallback, ${Math.round(buffer.length / 1024)}KB)`);
    }

    // Stocker l'URL en DB
    await db.liveStream.update({
      where: { id },
      data: { thumbnailUrl },
    });

    return NextResponse.json({ success: true, thumbnailUrl });
  } catch (error) {
    console.error("[thumbnail upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload" },
      { status: 500 }
    );
  }
}
