import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    const { targetChannelId, userId } = await req.json();
    if (!targetChannelId || !userId) return NextResponse.json({ error: "targetChannelId et userId requis" }, { status: 400 });
    const original = await db.message.findUnique({ where: { id: messageId } });
    if (!original) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    const forwarded = await db.message.create({
      data: {
        channelId: targetChannelId, userId,
        content: original.content, type: original.type,
        attachmentUrl: original.attachmentUrl,
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json({
      id: forwarded.id, conversationId: forwarded.channelId,
      senderId: forwarded.userId, senderName: forwarded.user.name ?? "Membre",
      senderRole: forwarded.user.role, type: forwarded.type, content: forwarded.content,
      reactions: [], createdAt: forwarded.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/forward] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
