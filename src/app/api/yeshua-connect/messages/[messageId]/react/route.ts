import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/yeshua-connect/messages/[messageId]/react
 * Toggle a reaction on a message.
 * Body: { emoji, userId, userName }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    const { emoji, userId, userName } = await req.json();

    if (!emoji || !userId) {
      return NextResponse.json({ error: "emoji et userId requis" }, { status: 400 });
    }

    // Vérifier que le message existe
    const message = await db.message.findUnique({ where: { id: messageId } });
    if (!message) {
      return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    }

    // TODO: V2.1 — créer une table MessageReaction pour persister les réactions.
    // Pour l'instant, on retourne juste un succès — les réactions sont gérées
    // côté client (state local) et seront persistées quand la table existera.
    return NextResponse.json({
      success: true,
      messageId,
      emoji,
      userId,
      userName: userName || "Membre",
    });
  } catch (error) {
    console.error("[yeshua-connect/react] Error:", error);
    return NextResponse.json({ error: "Erreur lors de la réaction" }, { status: 500 });
  }
}
