import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/live/[id]/chat?since=<iso_timestamp>
 *
 * Récupère les messages du chat depuis un timestamp donné (pour le polling).
 * Retourne les 100 derniers messages si pas de paramètre `since`.
 *
 * POST /api/live/[id]/chat
 *
 * Envoie un message ou une réaction dans le chat.
 * Body: { userName, content, type?: "message" | "reaction", emoji? }
 *
 * Pas d'authentification requise — les visiteurs anonymes peuvent chatter.
 * Rate limiting simple: max 1 message par seconde par IP (à améliorer).
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const since = url.searchParams.get("since");

    // Vérifier que le live existe
    const live = await db.liveStream.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    const where: Record<string, unknown> = { liveId: id };
    if (since) {
      where.createdAt = { gt: new Date(since) };
    }

    const messages = await db.liveChatMessage.findMany({
      where,
      orderBy: { createdAt: since ? "asc" : "desc" },
      take: since ? 200 : 50,
    });

    // Si pas de `since`, on renvoie dans l'ordre chronologique (les plus récents en dernier)
    const result = since ? messages : messages.reverse();

    return NextResponse.json({
      messages: result.map((m) => ({
        id: m.id,
        userName: m.userName,
        content: m.content,
        type: m.type,
        emoji: m.emoji,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[chat GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userName, content, type = "message", emoji } = body;

    if (!userName || !content) {
      return NextResponse.json(
        { error: "userName et content requis" },
        { status: 400 }
      );
    }

    // Vérifier que le live existe et est en direct
    const live = await db.liveStream.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    // Limiter la taille du message
    const trimmedContent = content.trim().substring(0, 500);
    if (!trimmedContent) {
      return NextResponse.json({ error: "Message vide" }, { status: 400 });
    }

    // Créer le message
    const message = await db.liveChatMessage.create({
      data: {
        liveId: id,
        userName: userName.substring(0, 50),
        content: trimmedContent,
        type: type === "reaction" ? "reaction" : "message",
        emoji: emoji || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        userName: message.userName,
        content: message.content,
        type: message.type,
        emoji: message.emoji,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[chat POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
