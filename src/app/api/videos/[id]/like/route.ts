/** POST /api/videos/[id]/like — Incrémenter/décrémenter les likes RÉELS
 *
 * ⭐ V3.26 — RÉPARATION « 5 likes sans aucun like » :
 * AVANT, cette route incrémentait la colonne `views` (réutilisée
 * « temporairement » comme compteur de likes), et le lecteur vidéo
 * affichait `views` à côté du cœur. Le replay d'un live étant créé avec
 * views = nombre de viewers du direct, un replay fraîchement publié
 * affichait « 5 likes » sans AUCUN like réel. Désormais :
 *   - colonne dédiée `Video.likes` (créée à la volée par
 *     ensureVideoLikesColumn si absente) ;
 *   - body { action?: "like" | "unlike" } (défaut "like") : le
 *     unlike DÉCRÉMENTE (avant, unlike puis re-like comptait +2) ;
 *   - réponse { success, likes } avec le compteur réel.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureVideoLikesColumn } from "@/lib/ensure-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ⭐ V3.26 — colonne likes créée si absente (idempotent, mémoïsé)
    await ensureVideoLikesColumn();

    let action: "like" | "unlike" = "like";
    try {
      const body = await request.json().catch(() => ({}));
      if (body?.action === "unlike") action = "unlike";
    } catch {
      // pas de body → like (comportement historique)
    }

    const video = await db.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: "Vidéo non trouvée" }, { status: 404 });
    }

    const current = (video as unknown as { likes?: number }).likes ?? 0;
    const next = Math.max(0, current + (action === "like" ? 1 : -1));

    const updated = await db.video.update({
      where: { id },
      data: { likes: next },
    });

    return NextResponse.json({
      success: true,
      likes: (updated as unknown as { likes?: number }).likes ?? next,
    });
  } catch (error) {
    console.error("[api/videos/[id]/like]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
