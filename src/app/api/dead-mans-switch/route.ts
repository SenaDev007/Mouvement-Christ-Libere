/**
 * API Dead Man's Switch
 *
 * POST /api/dead-mans-switch — Créer un commutateur
 * GET  /api/dead-mans-switch — Lister les commutateurs (admin)
 * POST /api/dead-mans-switch/signal — Signaler activité (reset timer)
 * GET  /api/dead-mans-switch/cron — Vérifier et déclencher (Vercel Cron)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const switches = await db.deadMansSwitch.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ switches });
  } catch {
    return NextResponse.json({ switches: [], demo: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contenuType, contenuTitre, contenuData, delaiJours = 30 } = body;

    if (!contenuType || !contenuTitre || !contenuData) {
      return NextResponse.json(
        { error: "contenuType, contenuTitre, contenuData requis" },
        { status: 400 }
      );
    }

    // Calculer le hash SHA-256
    const hash = createHash("sha256").update(contenuData).digest("hex");
    const contenuId = `${contenuType}-${Date.now()}`;

    try {
      const dms = await db.deadMansSwitch.create({
        data: {
          contenuId,
          contenuType,
          contenuTitre,
          contenuData,
          hash,
          delaiJours,
          derniereActivite: new Date(),
          estDeclenche: false,
        },
      });
      return NextResponse.json({ success: true, id: dms.id, hash }, { status: 201 });
    } catch {
      // Mode démo
      return NextResponse.json({
        success: true,
        demo: true,
        hash,
        contenuId,
        message: "Commutateur créé (mode démo — DB non accessible)",
      });
    }
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
