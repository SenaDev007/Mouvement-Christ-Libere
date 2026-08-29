import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles autorisés à publier des annonces (canaux ANNOUNCEMENT). */
const ANNOUNCER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "ANIMATOR",
]);

/**
 * GET /api/yeshua-connect/announcements
 * Fetch announcements from ANNOUNCEMENT-type channels.
 *
 * - 🔒 Authentification NextAuth requise.
 */
export async function GET() {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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
 * Body: { title, body, channelId, priority?, target? }  ← userId vient de la session.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 Réservé aux rôles SUPER_ADMIN / ADMIN / MODERATOR / ANIMATOR.
 * - 🔒 userId est forcé depuis la session (ignore req.body.userId).
 */
export async function POST(req: NextRequest) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;

    // 🔒 Vérifier le rôle autorisé à publier des annonces
    if (!ANNOUNCER_ROLES.has(userRole || "")) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à publier des annonces" },
        { status: 403 },
      );
    }

    const { title, body, channelId, priority = "NORMAL", target = "ALL" } =
      await req.json();
    if (!title || !body || !channelId) {
      return NextResponse.json(
        { error: "title, body, channelId requis" },
        { status: 400 },
      );
    }

    const message = await db.message.create({
      data: {
        channelId,
        userId, // 🔒 depuis la session
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
