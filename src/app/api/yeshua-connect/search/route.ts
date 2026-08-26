import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/yeshua-connect/search?q=...
 * Global search across messages, channels, and users.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    if (!q.trim()) return NextResponse.json({ messages: [], channels: [], users: [] });

    const [messages, channels, users] = await Promise.all([
      db.message.findMany({
        where: { content: { contains: q, mode: "insensitive" }, isDeleted: false },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
          channel: { select: { id: true, name: true } },
        },
      }),
      db.channel.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
      }),
      db.user.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
        select: { id: true, name: true, avatarUrl: true, role: true },
      }),
    ]);

    return NextResponse.json({
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        senderName: m.user.name,
        channelId: m.channel.id,
        channelName: m.channel.name,
      })),
      channels: channels.map(c => ({ id: c.id, name: c.name, type: c.type })),
      users: users.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl, role: u.role })),
    });
  } catch (error) {
    console.error("[yeshua-connect/search] Error:", error);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500 });
  }
}
