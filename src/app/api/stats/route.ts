/** GET /api/stats — Statistiques globales depuis la DB */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const revalidate = 60; // Cache 60s

export async function GET() {
  try {
    const [testimonies, teachings, videos, biographies] = await Promise.all([
      db.testimony.count(),
      db.teaching.count(),
      db.video.count(),
      db.biography.count(),
    ]);

    return NextResponse.json({
      testimonies,
      teachings,
      videos,
      biographies,
    });
  } catch (error) {
    console.error("[api/stats]", error);
    // Fallback avec données statiques
    return NextResponse.json({
      testimonies: 31,
      teachings: 8,
      videos: 544,
      biographies: 2,
    });
  }
}
