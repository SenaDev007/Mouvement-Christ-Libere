import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

/**
 * POST /api/live/[id]/thumbnail
 *
 * Upload une miniature pour un live (base64 → fichier dans /public/live-thumbnails/)
 * Body: { thumbnail: "data:image/png;base64,..." }
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

    // Extraire le base64
    const matches = thumbnail.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: "Format invalide" }, { status: 400 });
    }

    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    // Limiter à 10MB (après compression base64 — l'image compressée fait ~200-300KB)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image trop lourde (max 10MB)" }, { status: 400 });
    }

    // Sauvegarder le fichier
    const filename = `live-${id}.${ext}`;
    const filepath = path.join(process.cwd(), "public", "live-thumbnails", filename);
    await fs.writeFile(filepath, buffer);

    // Mettre à jour le live en DB
    const thumbnailUrl = `/live-thumbnails/${filename}`;
    await db.liveStream.update({
      where: { id },
      data: { thumbnailUrl },
    });

    return NextResponse.json({ success: true, thumbnailUrl });
  } catch (error) {
    console.error("[thumbnail upload] Error:", error);
    return NextResponse.json({ error: "Erreur upload" }, { status: 500 });
  }
}
