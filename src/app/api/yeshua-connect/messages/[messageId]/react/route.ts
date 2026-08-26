import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    const { emoji, userId, userName } = await req.json();
    if (!emoji || !userId) return NextResponse.json({ error: "emoji et userId requis" }, { status: 400 });
    const message = await db.message.findUnique({ where: { id: messageId } });
    if (!message) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, messageId, emoji, userId, userName: userName || "Membre" });
  } catch (error) {
    console.error("[yeshua-connect/react] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
