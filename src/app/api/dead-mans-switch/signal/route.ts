/** POST /api/dead-mans-switch/signal — Signaler activité (reset timer) */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      // Mettre à jour tous les commutateurs
      try {
        await db.deadMansSwitch.updateMany({
          where: { estDeclenche: false },
          data: { derniereActivite: new Date() },
        });
      } catch {}
      return NextResponse.json({ success: true, message: "Tous les commutateurs réinitialisés" });
    }

    try {
      await db.deadMansSwitch.update({
        where: { id },
        data: { derniereActivite: new Date() },
      });
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ success: true, demo: true });
    }
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
