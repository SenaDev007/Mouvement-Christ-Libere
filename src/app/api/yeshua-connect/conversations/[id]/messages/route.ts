import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/yeshua-connect/conversations/:id/messages
 *
 * Récupère les messages d'un canal, triés par createdAt asc.
 * Limite à 50 messages par défaut (pagination via ?cursor=).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(_req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const messages = await db.message.findMany({
      where: { channelId: id, isDeleted: false },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    // Si des messages ont un replyToId, on fetch les messages parent séparément
    // (le modèle Prisma Message n'a pas de self-relation `replyTo` déclarée).
    const replyIds = messages.map(m => m.replyToId).filter(Boolean) as string[];
    const replyMessages = replyIds.length > 0
      ? await db.message.findMany({
          where: { id: { in: replyIds } },
          include: { user: { select: { id: true, name: true } } },
        })
      : [];
    const replyMap = new Map(replyMessages.map(r => [r.id, r]));

    const formatted = messages.map((m) => ({
      id: m.id,
      conversationId: m.channelId,
      senderId: m.userId,
      senderName: m.user.name ?? "Membre",
      senderRole: m.user.role,
      type: m.type,
      content: m.content,
      attachmentUrl: m.attachmentUrl ?? undefined,
      replyToId: m.replyToId ?? undefined,
      replyTo: m.replyToId
        ? (() => {
            const parent = replyMap.get(m.replyToId!);
            return parent
              ? { senderName: parent.user.name ?? "Membre", content: parent.content }
              : undefined;
          })()
        : undefined,
      reactions: [], // TODO: table MessageReaction (V2.1)
      createdAt: m.createdAt.toISOString(),
      editedAt: m.isEdited ? m.updatedAt.toISOString() : undefined,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/messages] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des messages" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/yeshua-connect/conversations/:id/messages
 *
 * Envoie un nouveau message dans un canal.
 * Body: { userId, content, type?, replyToId? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userId, content, type = "TEXT", replyToId } = body;

    if (!userId || !content) {
      return NextResponse.json(
        { error: "userId et content sont requis" },
        { status: 400 },
      );
    }

    const message = await db.message.create({
      data: {
        channelId: id,
        userId,
        content,
        type,
        replyToId: replyToId ?? null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    return NextResponse.json({
      id: message.id,
      conversationId: message.channelId,
      senderId: message.userId,
      senderName: message.user.name ?? "Membre",
      senderRole: message.user.role,
      type: message.type,
      content: message.content,
      reactions: [],
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/messages POST] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message" },
      { status: 500 },
    );
  }
}
