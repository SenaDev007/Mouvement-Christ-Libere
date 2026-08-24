/** POST /api/intercession/[id]/prier — Incrémente le compteur de prière */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
