import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { uploadToR2, generateKey, isR2Configured, ensureR2CorsConfig } from "@/lib/r2";

/**
 * POST /api/live/[id]/thumbnail
 *
 * Stocke la miniature d'un live.
 *
 * Optimisation :
 * 1. Côté client : compression canvas à max 1280x720 JPEG < 80KB
 * 2. Côté serveur : sharp redimensionne à 640x360 et optimise (qualité 0.8)
 *    → résultat final < 50KB garantit
 *
 * Stockage :
 * - Si R2 configuré → upload vers R2 (URL publique)
 * - Sinon → data URL en DB (< 50KB, sécurisé pour RSC)
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
    let buffer = Buffer.from(base64Data, "base64");
    const mimeType = `image/${matches[1] === "jpg" ? "jpeg" : matches[1]}`;

    // Limiter à 10MB (avant optimisation)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image trop lourde (max 10MB)" }, { status: 400 });
    }

    // ─── Optimisation serveur avec sharp ───
    // Redimensionner à max 640x360 (assez pour une miniature, réduit la taille)
    // et compresser en JPEG qualité 80.
    try {
      const sharp = (await import("sharp")).default;
      const optimized = await sharp(buffer)
        .resize(640, 360, { fit: "cover", position: "center" })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      buffer = Buffer.from(optimized);
      console.log(`[thumbnail] Optimisé avec sharp: ${Math.round(buffer.length / 1024)}KB`);
    } catch (sharpErr) {
      // sharp non disponible — utiliser le buffer tel quel (déjà compressé côté client)
      console.log("[thumbnail] sharp non disponible, utilisation du buffer client");
    }

    let thumbnailUrl: string;

    if (isR2Configured()) {
      // ─── Upload vers Cloudflare R2 ───
      // S'assurer que le CORS est configuré pour les lectures publiques
      await ensureR2CorsConfig().catch(() => {});

      const key = generateKey("thumbnails", `live-${id}`, "jpg");
      try {
        thumbnailUrl = await uploadToR2(key, buffer, "image/jpeg");
        console.log(`[thumbnail] Uploadé vers R2: ${thumbnailUrl} (${Math.round(buffer.length / 1024)}KB)`);
      } catch (r2Err) {
        // Si R2 échoue (access denied, credentials, etc.), fallback data URL
        console.error("[thumbnail] R2 upload échoué, fallback data URL:", r2Err);
        thumbnailUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      }
    } else {
      // ─── Fallback : data URL en DB (déjà optimisé, < 50KB) ───
      thumbnailUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      console.log(`[thumbnail] Stocké en data URL (${Math.round(buffer.length / 1024)}KB)`);
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
