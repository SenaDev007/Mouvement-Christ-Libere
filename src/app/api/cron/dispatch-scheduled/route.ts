import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/cron/dispatch-scheduled
 * Cron automatique (toutes les minutes) qui envoie les messages programmés
 * dont l'heure est arrivée.
 *
 * Sécurité : header X-Cron-Secret requis.
 */
export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const now = new Date();
    const pending = await db.scheduledMessage.findMany({
      where: { status: "PENDING", scheduledAt: { lte: now } },
      take: 50,
    });
    let sent = 0;
    for (const sm of pending) {
      try {
        const message = await db.message.create({
          data: {
            channelId: sm.channelId,
            userId: sm.userId,
            content: sm.content,
            type: "TEXT",
          },
        });
        await db.scheduledMessage.update({
          where: { id: sm.id },
          data: { status: "SENT", sentMessageId: message.id },
        });
        sent++;
      } catch (e) {
        await db.scheduledMessage.update({
          where: { id: sm.id },
          data: { status: "FAILED" },
        });
      }
    }
    return NextResponse.json({ success: true, dispatched: sent, total: pending.length });
  } catch (error) {
    console.error("[cron/dispatch-scheduled]", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
