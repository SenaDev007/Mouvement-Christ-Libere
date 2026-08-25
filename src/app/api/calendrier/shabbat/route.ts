import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/calendrier/shabbat
 * Check if the user has Shabbat mode active (notifications suspended).
 *
 * Shabbat = Friday 18:00 → Saturday 18:00 (Jerusalem time concept).
 * During Shabbat, all push notifications are suspended.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { dndEnabled: true, dndUntil: true },
    });

    const now = new Date();

    // Check if we're in Shabbat window (Friday 18:00 → Saturday 18:00)
    const day = now.getDay(); // 0=Sunday, 5=Friday, 6=Saturday
    const hour = now.getHours();
    const isShabbatWindow =
      (day === 5 && hour >= 18) || // Friday after 18:00
      (day === 6 && hour < 18);    // Saturday before 18:00

    // Check if DND is active and not expired
    const dndActive =
      user?.dndEnabled &&
      (!user?.dndUntil || new Date(user.dndUntil) > now);

    return NextResponse.json({
      isShabbatWindow,
      dndActive: !!dndActive,
      dndUntil: user?.dndUntil?.toISOString(),
      shabbatModeActive: isShabbatWindow || !!dndActive,
    });
  } catch (error) {
    console.error("[calendrier/shabbat GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * POST /api/calendrier/shabbat
 * Manually toggle Shabbat mode (suspend notifications until Saturday 18:00 or next 24h).
 * Body: { enable: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { enable } = await req.json();
    const now = new Date();

    if (enable) {
      // Enable DND until Saturday 18:00 (or next 24h if already Saturday)
      const dndUntil = new Date(now);
      const day = now.getDay();
      if (day === 5) {
        // Friday — set to Saturday 18:00
        dndUntil.setDate(dndUntil.getDate() + 1);
        dndUntil.setHours(18, 0, 0, 0);
      } else if (day === 6) {
        // Saturday — set to today 18:00
        dndUntil.setHours(18, 0, 0, 0);
      } else {
        // Other day — set to next 24h
        dndUntil.setDate(dndUntil.getDate() + 1);
      }

      await db.user.update({
        where: { id: session.user.id },
        data: { dndEnabled: true, dndUntil },
      });
    } else {
      await db.user.update({
        where: { id: session.user.id },
        data: { dndEnabled: false, dndUntil: null },
      });
    }

    return NextResponse.json({ success: true, enabled: enable });
  } catch (error) {
    console.error("[calendrier/shabbat POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
