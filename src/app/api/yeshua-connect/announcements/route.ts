import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/yeshua-connect/announcements
 *
 * Récupère les annonces (messages dans les canaux de type ANNOUNCEMENT).
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
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/announcements] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des annonces" },
      { status: 500 },
    );
  }
}
