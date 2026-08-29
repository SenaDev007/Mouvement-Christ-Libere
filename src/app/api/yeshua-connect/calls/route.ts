import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/**
 * GET /api/yeshua-connect/calls
 * Fetch call history.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 Ne retourne que les appels où l'utilisateur est initiateur ou destinataire.
 */
export async function GET() {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;

    const calls = await db.call.findMany({
      where: {
        OR: [{ initiatorId: userId }, { recipientId: userId }],
      },
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
      direction: (c.initiatorId === userId ? "outgoing" : "incoming") as
        | "outgoing"
        | "incoming",
      contact: c.initiator.name ?? c.recipient.name ?? "Membre",
      duration: c.duration ?? 0,
      status: c.status,
      date: c.createdAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/calls] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
