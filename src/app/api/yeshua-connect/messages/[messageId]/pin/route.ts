import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    return NextResponse.json({ success: true, messageId, isPinned: true });
  } catch (error) {
    console.error("[yeshua-connect/pin] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
