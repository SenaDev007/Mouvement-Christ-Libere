/** GET  /api/live/[id]/like — Compteur de likes RÉEL du live
 * POST /api/live/[id]/like — Liker / unliker un live (avant, pendant, après)
 *
 * ⭐ V3.39 — RÉPARATION « le J'aime disparaît au rechargement » :
 * AVANT, le bouton cœur de la page live ne basculait qu'un état React
 * local — aucune écriture serveur, aucun compteur persistant. Désormais :
 *   - colonne dédiée `LiveStream.likes` (créée à la volée par
 *     ensureLiveLikesColumn si absente — hors modèle Prisma, pattern
 *     youtubeIngestUrl V3.36) ;
 *   - GET : renvoie { likes } pour l'état initial de la page (le like du
 *     VIEWER, lui, est mémorisé côté appareil via localStorage, comme les
 *     vidéos — les viewers sont souvent anonymes) ;
 *   - POST body { action?: "like" | "unlike" } (défaut "like") :
 *     incrémente/décrémente ATOMIQUEMENT en SQL brut (GREATEST(0, …)) —
 *     deux viewers simultanés ne s'écrasent pas — et renvoie { likes }.
 *
 * Aucune authentification requise (page publique, viewers anonymes) —
 * même politique que /api/videos/[id]/like.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureLiveLikesColumn } from "@/lib/ensure-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lit la colonne runtime likes (SQL brut — hors modèle Prisma). */
async function lireLikes(liveId: string): Promise<number | null> {
  const rows = await db.$queryRawUnsafe<Array<{ likes: number }>>(
    'SELECT "likes" FROM "LiveStream" WHERE "id" = $1',
    liveId,
  );
  return rows.length > 0 ? Number(rows[0].likes) : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await ensureLiveLikesColumn();

    const live = await db.liveStream.findUnique({ where: { id }, select: { id: true } });
    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    return NextResponse.json({ likes: (await lireLikes(id)) ?? 0 });
  } catch (error) {
    console.error("[api/live/[id]/like GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await ensureLiveLikesColumn();

    const live = await db.liveStream.findUnique({ where: { id }, select: { id: true } });
    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    let action: "like" | "unlike" = "like";
    try {
      const body = await request.json().catch(() => ({}));
      if (body?.action === "unlike") action = "unlike";
    } catch {
      // pas de body → like (comportement historique des vidéos)
    }

    // Incrément/décrément ATOMIQUE en base (pas de lecture-then-écriture) :
    // GREATEST empêche les compteurs négatifs si deux unlike concurrents.
    const delta = action === "like" ? 1 : -1;
    const rows = await db.$queryRawUnsafe<Array<{ likes: number }>>(
      'UPDATE "LiveStream" SET "likes" = GREATEST(0, COALESCE("likes", 0) + $1) WHERE "id" = $2 RETURNING "likes"',
      delta,
      id,
    );

    return NextResponse.json({
      success: true,
      likes: rows.length > 0 ? Number(rows[0].likes) : 0,
    });
  } catch (error) {
    console.error("[api/live/[id]/like POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
