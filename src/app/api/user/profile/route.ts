import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/user/profile
 * Fetch the current user's profile + notification preferences.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        country: true,
        city: true,
        avatarUrl: true,
        role: true,
        notifMessages: true,
        notifAnnouncements: true,
        notifLive: true,
        notifCommunity: true,
        dndEnabled: true,
        dndUntil: true,
        pushEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[user/profile GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * PUT /api/user/profile
 * Update the current user's profile + notification preferences.
 * Body: { name?, bio?, country?, city?, notifMessages?, notifAnnouncements?, notifLive?, notifCommunity?, dndEnabled? }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { name, bio, country, city, notifMessages, notifAnnouncements, notifLive, notifCommunity, dndEnabled } = body;

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(country !== undefined && { country }),
        ...(city !== undefined && { city }),
        ...(notifMessages !== undefined && { notifMessages }),
        ...(notifAnnouncements !== undefined && { notifAnnouncements }),
        ...(notifLive !== undefined && { notifLive }),
        ...(notifCommunity !== undefined && { notifCommunity }),
        ...(dndEnabled !== undefined && {
          dndEnabled,
          dndUntil: dndEnabled ? new Date(Date.now() + 8 * 60 * 60 * 1000) : null, // 8h DND
        }),
      },
    });

    return NextResponse.json({ success: true, user: { id: updated.id } });
  } catch (error) {
    console.error("[user/profile PUT] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
