import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureV29Schema } from "@/lib/ensure-schema";

/**
 * ⭐ V2.9 — POST /api/yeshua-connect/presence
 *
 * Heartbeat de présence : le client l'appelle toutes les ~25 s tant que
 * l'onglet Yeshua Connect est ouvert (en plus du focus/polling).
 * Écrit `User.lastSeenAt = now()` — les conversations et le header du chat
 * calculent « N en ligne » avec une fenêtre de fraîcheur de 90 s.
 *
 * Contexte : le serveur Socket.io (backend Railway) n'est pas déployé →
 * la présence ne pouvait PAS exister. Ce heartbeat léger (1 UPDATE / 25 s
 * par utilisateur) donne une présence fiable sur Vercel serverless.
 */
export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    await ensureV29Schema();
    await db.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    }).catch(() => {
      // lastSeenAt peut manquer sur une instance froide avant ensure —
      // non bloquant, le prochain heartbeat fonctionnera.
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[presence] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
