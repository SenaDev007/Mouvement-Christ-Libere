/** POST /api/intercession/[id]/prier — Incrémente le compteur de prière
 * ⭐ V3.2 — Réservé à l'administration (les demandes ne sont plus publiques :
 * le compteur « je prie » est actionné depuis le back-office). */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR", "PASTOR", "ANIMATOR"]);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ⭐ V3.2 — Accès réservé à l'administration.
  const session = await auth();
  if (!session?.user?.id || !PRIVILEGED_ROLES.has((session.user as { role?: string }).role || "")) {
    return NextResponse.json({ error: "Accès réservé à l'administration" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const demande = await db.intercessionRequest.update({
      where: { id },
      data: {
        prayCount: { increment: 1 },
        statut: "en_priere",
      },
    });
    return NextResponse.json({ success: true, prayCount: demande.prayCount });
  } catch {
    return NextResponse.json({ success: true, demo: true, prayCount: 0 });
  }
}
