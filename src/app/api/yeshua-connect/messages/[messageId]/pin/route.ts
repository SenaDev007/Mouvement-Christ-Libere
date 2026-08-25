import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/yeshua-connect/messages/[messageId]/pin
 * Pin/unpin a message.
 * TODO: V2.1 — créer une table PinnedMessage pour persister.
 * Pour l'instant, retourne juste un succès (géré côté client).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    return NextResponse.json({ success: true, messageId, isPinned: true });
  } catch (error) {
    console.error("[yeshua-connect/pin] Error:", error);
    return NextResponse.json({ error: "Erreur lors du pin" }, { status: 500 });
  }
}
