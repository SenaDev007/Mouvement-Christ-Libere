import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    const url = new URL(_req.url);
    const forEveryone = url.searchParams.get("forEveryone") === "true";
    const updated = await db.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: forEveryone ? "🗑️ Message supprimé" : "" },
    });
    return NextResponse.json({ success: true, id: updated.id, isDeleted: true });
  } catch (error) {
    console.error("[yeshua-connect/delete] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
