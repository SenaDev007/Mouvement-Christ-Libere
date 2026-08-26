import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    const { content } = await req.json();
    if (!content?.trim()) return NextResponse.json({ error: "content requis" }, { status: 400 });
    const updated = await db.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json({
      id: updated.id, content: updated.content, isEdited: updated.isEdited,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/edit] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
