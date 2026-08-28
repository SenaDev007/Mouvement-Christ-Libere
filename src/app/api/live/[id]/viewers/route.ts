import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/live/[id]/viewers
 * Retourne le nombre réel de viewers actifs sur ce live.
 *
 * POST /api/live/[id]/viewers
 * Un membre rejoint un live (crée une session LiveViewer).
 * Body: { memberId }
 *
 * DELETE /api/live/[id]/viewers?memberId=xxx
 * Un viewer quitte le live.
 *
 * PATCH /api/live/[id]/viewers
 * Ajouter des XP à un viewer pour ce live.
 * Body: { memberId, xp }
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
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId requis" }, { status: 400 });
    }

    // Vérifier que le membre existe
    const member = await db.liveMember.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    // Upsert : si le viewer existe déjà pour ce live, le réactiver
    const viewer = await db.liveViewer.findFirst({
      where: { liveId: id, memberId },
    });

    if (viewer) {
      await db.liveViewer.update({
        where: { id: viewer.id },
        data: { isActive: true, leftAt: null, joinedAt: new Date() },
      });
    } else {
      await db.liveViewer.create({
        data: {
          liveId: id,
          memberId,
          isActive: true,
        },
      });

      // Incrémenter livesWatched du membre
      await db.liveMember.update({
        where: { id: memberId },
        data: { livesWatched: { increment: 1 } },
      });
    }

    const count = await db.liveViewer.count({
      where: { liveId: id, isActive: true },
    });

    return NextResponse.json({ success: true, viewerCount: count });
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
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId requis" }, { status: 400 });
    }

    await db.liveViewer.updateMany({
      where: { liveId: id, memberId, isActive: true },
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
    const { memberId, xp } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId requis" }, { status: 400 });
    }

    // Incrémenter XP sur la session LiveViewer
    await db.liveViewer.updateMany({
      where: { liveId: id, memberId, isActive: true },
      data: { xpPoints: { increment: xp || 1 } },
    });

    // Incrémenter aussi le totalXP du membre
    const member = await db.liveMember.update({
      where: { id: memberId },
      data: { totalXp: { increment: xp || 1 } },
    });

    return NextResponse.json({ success: true, totalXp: member.totalXp });
  } catch (error) {
    console.error("[viewers PATCH] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
