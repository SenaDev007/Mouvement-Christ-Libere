import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/live/[id]/chat/like
 *
 * Bascule le like d'un message du chat (toggle).
 * Body: { messageId: string, liked: boolean }
 *   - liked: true = ajouter un like, false = retirer
 *
 * L'état "déjà liké" est géré côté client (localStorage par messageId)
 * pour éviter les doubles likes d'un même navigateur.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: liveId } = await params;
    const body = await req.json().catch(() => ({}));
    const { messageId, liked }: { messageId?: string; liked?: boolean } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: "messageId requis" },
        { status: 400 }
      );
    }

    // Vérifier que le message existe et appartient bien à ce live
    const message = await db.liveChatMessage.findFirst({
      where: { id: messageId, liveId },
      select: { id: true, likeCount: true },
    });
    if (!message) {
      return NextResponse.json(
        { error: "Message introuvable" },
        { status: 404 }
      );
    }

    // Incrémenter ou décrémenter le compteur (jamais en dessous de 0)
    const newCount = Math.max(
      0,
      message.likeCount + (liked ? 1 : -1)
    );
    await db.liveChatMessage.update({
      where: { id: messageId },
      data: { likeCount: newCount },
    });

    return NextResponse.json({
      success: true,
      likeCount: newCount,
      liked: !!liked,
    });
  } catch (error) {
    console.error("[chat like POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
