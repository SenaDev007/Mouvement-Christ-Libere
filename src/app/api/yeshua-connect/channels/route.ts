import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/yeshua-connect/channels
 * List all channels (for create conversation / forward target).
 */
export async function GET() {
  try {
    const channels = await db.channel.findMany({
      orderBy: [{ communityId: "asc" }, { order: "asc" }],
      include: {
        community: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    return NextResponse.json(channels);
  } catch (error) {
    console.error("[yeshua-connect/channels] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * POST /api/yeshua-connect/channels
 * Create a new channel (group/broadcast).
 * Body: { name, description?, type, communityId, isEncrypted?, createdBy }
 */
export async function POST(req: Request) {
  try {
    const { name, description, type = "TEXT", communityId, isEncrypted = false, createdBy } = await req.json();
    if (!name || !communityId) {
      return NextResponse.json({ error: "name et communityId requis" }, { status: 400 });
    }

    const channel = await db.channel.create({
      data: {
        name,
        description,
        type,
        communityId,
        isEncrypted,
        order: 0,
      },
    });

    // Add creator as first member
    if (createdBy) {
      await db.channelMember.create({
        data: { channelId: channel.id, userId: createdBy, role: "ADMIN" },
      });
    }

    return NextResponse.json(channel);
  } catch (error) {
    console.error("[yeshua-connect/channels POST] Error:", error);
    return NextResponse.json({ error: "Erreur de création" }, { status: 500 });
  }
}
