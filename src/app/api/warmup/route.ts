import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/warmup
 *
 * Endpoint léger pour garder Neon DB éveillée 24/7.
 * Appelé par Vercel Cron toutes les 4 minutes.
 *
 * Neon (plan gratuit) met la DB en hibernation après ~5 min d'inactivité.
 * Ce ping empêche l'hibernation → pas de cold start → réponses instantanées.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Requête ultra-légère (count) pour réveiller la DB sans charge
    await db.user.count();
    return NextResponse.json({
      status: "warm",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[warmup] Error:", error);
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
