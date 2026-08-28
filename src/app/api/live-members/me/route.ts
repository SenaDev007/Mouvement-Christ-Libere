import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/live-members/me?sessionId=xxx
 *
 * Vérifie si un membre est déjà inscrit (via sessionId en localStorage).
 * Retourne les infos du membre ou null.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ member: null });
    }

    const member = await db.liveMember.findUnique({
      where: { sessionId },
      select: {
        id: true,
        sessionId: true,
        firstName: true,
        lastName: true,
        country: true,
        city: true,
        contact: true,
        totalXp: true,
        livesWatched: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ member });
  } catch (error) {
    console.error("[live-members/me] Error:", error);
    return NextResponse.json({ member: null });
  }
}
