import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/yeshua-connect/calls
 *
 * Récupère l'historique des appels.
 */
export async function GET() {
  try {
    const calls = await db.call.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        initiator: { select: { id: true, name: true, avatarUrl: true } },
        recipient: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const formatted = calls.map((c) => ({
      id: c.id,
      type: c.type,
      direction: "outgoing" as const, // TODO: déterminer selon l'utilisateur courant
      contact:
        c.initiator.name ?? c.recipient.name ?? "Membre",
      duration: c.duration ?? 0,
      status: c.status,
      date: c.createdAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/calls] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des appels" },
      { status: 500 },
    );
  }
}
