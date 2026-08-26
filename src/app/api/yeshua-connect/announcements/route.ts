import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/yeshua-connect/announcements
 * Fetch announcements from ANNOUNCEMENT-type channels.
 */
export async function GET() {
  try {
    const announcements = await db.message.findMany({
      where: {
        channel: { type: "ANNOUNCEMENT" },
        isDeleted: false,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true, role: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    const formatted = announcements.map((m) => ({
      id: m.id,
      authorName: m.user.name ?? "Membre",
      authorRole: m.user.role,
      title: m.content.split("\n")[0].substring(0, 100),
      body: m.content,
      priority: "NORMAL" as const,
      target: "ALL" as const,
      requiresConfirmation: false,
      publishedAt: m.createdAt.toISOString(),
      confirmedByCurrentUser: false,
      confirmCount: 0,
      totalRecipients: 0,
      channelId: m.channel.id,
      channelName: m.channel.name,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/announcements] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * POST /api/yeshua-connect/announcements
 * Publish a new announcement.
 * Body: { title, body, channelId, userId, priority?, target? }
 */
export async function POST(req: NextRequest) {
  try {
    const { title, body, channelId, userId, priority = "NORMAL", target = "ALL" } = await req.json();
    if (!title || !body || !channelId || !userId) {
      return NextResponse.json({ error: "title, body, channelId, userId requis" }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        channelId,
        userId,
        content: `${title}\n\n${body}`,
        type: "TEXT",
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({
      id: message.id,
      authorName: message.user.name ?? "Membre",
      authorRole: message.user.role,
      title,
      body,
      priority,
      target,
      requiresConfirmation: false,
      publishedAt: message.createdAt.toISOString(),
      confirmedByCurrentUser: false,
      confirmCount: 0,
      totalRecipients: 0,
    });
  } catch (error) {
    console.error("[yeshua-connect/announcements POST] Error:", error);
    return NextResponse.json({ error: "Erreur de publication" }, { status: 500 });
  }
}
