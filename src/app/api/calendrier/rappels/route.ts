import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/calendrier/rappels
 * Fetch the user's reminder preferences for liturgical events.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Return the user's notification + DND preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        notifAnnouncements: true,
        notifLive: true,
        dndEnabled: true,
        dndUntil: true,
        pushEnabled: true,
        pushSubscription: true,
      },
    });

    return NextResponse.json({
      enabled: user?.notifAnnouncements ?? false,
      pushEnabled: user?.pushEnabled ?? false,
      hasSubscription: !!user?.pushSubscription,
      dndEnabled: user?.dndEnabled ?? false,
      dndUntil: user?.dndUntil?.toISOString(),
    });
  } catch (error) {
    console.error("[calendrier/rappels GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * PUT /api/calendrier/rappels
 * Toggle reminder preferences for liturgical events.
 * Body: { enabled: boolean }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { enabled } = await req.json();

    await db.user.update({
      where: { id: session.user.id },
      data: { notifAnnouncements: enabled },
    });

    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    console.error("[calendrier/rappels PUT] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
