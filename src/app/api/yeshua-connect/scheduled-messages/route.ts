import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/**
 * POST /api/yeshua-connect/scheduled-messages
 * Crée un message programmé.
 * Body: { channelId, content, scheduledAt }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const { channelId, content, scheduledAt } = await req.json();
    if (!channelId || !content || !scheduledAt) {
      return NextResponse.json({ error: "channelId, content et scheduledAt requis" }, { status: 400 });
    }
    const scheduled = await db.scheduledMessage.create({
      data: {
        channelId,
        userId: session.user.id,
        content,
        scheduledAt: new Date(scheduledAt),
        status: "PENDING",
      },
    });
    return NextResponse.json({ success: true, scheduled });
  } catch (error) {
    console.error("[scheduled-messages POST]", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * GET /api/yeshua-connect/scheduled-messages
 * Liste les messages programmés de l'utilisateur courant.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const messages = await db.scheduledMessage.findMany({
      where: { userId: session.user.id, status: "PENDING" },
      orderBy: { scheduledAt: "asc" },
    });
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[scheduled-messages GET]", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
