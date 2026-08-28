import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/live/[id]/viewers
 * Retourne le nombre réel de viewers actifs.
 *
 * POST /api/live/[id]/viewers
 * Un viewer rejoint le live (création ou reprise de session).
 * Body: { sessionId, firstName, lastName?, country?, city?, contact? }
 *
 * DELETE /api/live/[id]/viewers?sessionId=xxx
 * Un viewer quitte le live (déconnexion).
 *
 * PATCH /api/live/[id]/viewers
 * Ajouter des XP à un viewer.
 * Body: { sessionId, xp }
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const count = await db.liveViewer.count({
      where: { liveId: id, isActive: true },
    });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("[viewers GET] Error:", error);
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { sessionId, firstName, lastName, country, city, contact } = body;

    if (!sessionId || !firstName) {
      return NextResponse.json({ error: "sessionId et firstName requis" }, { status: 400 });
    }

    // Upsert : si le viewer existe déjà (même sessionId), le réactiver
    const viewer = await db.liveViewer.upsert({
      where: { sessionId },
      create: {
        liveId: id,
        sessionId,
        firstName,
        lastName: lastName || null,
        country: country || null,
        city: city || null,
        contact: contact || null,
        isActive: true,
        leftAt: null,
      },
      update: {
        isActive: true,
        leftAt: null,
        firstName,
        lastName: lastName || null,
        country: country || null,
        city: city || null,
        contact: contact || null,
      },
    });

    // Compter le nouveau total
    const count = await db.liveViewer.count({
      where: { liveId: id, isActive: true },
    });

    return NextResponse.json({ success: true, viewerId: viewer.id, viewerCount: count });
  } catch (error) {
    console.error("[viewers POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requis" }, { status: 400 });
    }

    await db.liveViewer.updateMany({
      where: { liveId: id, sessionId },
      data: { isActive: false, leftAt: new Date() },
    });

    const count = await db.liveViewer.count({
      where: { liveId: id, isActive: true },
    });

    return NextResponse.json({ success: true, viewerCount: count });
  } catch (error) {
    console.error("[viewers DELETE] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { sessionId, xp } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requis" }, { status: 400 });
    }

    const viewer = await db.liveViewer.update({
      where: { sessionId },
      data: { xpPoints: { increment: xp || 1 } },
    });

    return NextResponse.json({ success: true, xpPoints: viewer.xpPoints });
  } catch (error) {
    console.error("[viewers PATCH] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
