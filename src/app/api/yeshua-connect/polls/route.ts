import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/**
 * POST /api/yeshua-connect/polls
 * Crée un sondage dans un canal.
 * Body: { channelId, question, options: string[], isMulti?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const { channelId, question, options, isMulti } = await req.json();
    if (!channelId || !question || !options || options.length < 2) {
      return NextResponse.json({ error: "channelId, question et au moins 2 options requis" }, { status: 400 });
    }
    // ⭐ V2.5 — Vérifier que l'utilisateur est membre du canal (cohérence
    // avec les autres routes de messagerie). Les rôles pastoraux peuvent
    // poster partout.
    const PRIVILEGED = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);
    if (!PRIVILEGED.has(session.user.role || "")) {
      const membership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId: session.user.id } },
      });
      if (!membership) {
        return NextResponse.json({ error: "Vous n'êtes pas membre de ce canal" }, { status: 403 });
      }
    }

    // Créer le message + le poll + les options en une transaction
    const message = await db.message.create({
      data: {
        channelId,
        userId: session.user.id,
        content: question,
        type: "POLL",
        poll: {
          create: {
            question,
            isMulti: !!isMulti,
            options: {
              create: options.map((label: string, i: number) => ({ label, order: i })),
            },
          },
        },
      },
      include: {
        poll: { include: { options: { include: { votes: true } } } },
        user: { select: { id: true, name: true, role: true } },
      },
    });

    // ⭐ V2.5 — Mettre à jour lastMessageAt du canal (tri de la sidebar)
    await db.channel.update({
      where: { id: channelId },
      data: { lastMessageAt: message.createdAt },
    }).catch(() => { /* non bloquant */ });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("[polls POST]", error);
    return NextResponse.json({ error: "Erreur création sondage" }, { status: 500 });
  }
}
