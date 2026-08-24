/**
 * API publique — soumission du formulaire de contact.
 * POST /api/contact
 *
 * Pas d'auth requise (public). Crée une entrée ContactRequest dans la DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, contact, message } = body;

    // Validation
    if (!name || !contact || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Le nom doit contenir entre 2 et 100 caractères" },
        { status: 400 }
      );
    }

    if (message.length < 10 || message.length > 5000) {
      return NextResponse.json(
        { error: "Le message doit contenir entre 10 et 5000 caractères" },
        { status: 400 }
      );
    }

    // Rate limiting basique (par IP)
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const recentRequests = await db.contactRequest.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1h
      },
    });

    // Anti-spam : max 10 demandes/heure globalement (à affiner en prod)
    if (recentRequests >= 10) {
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429 }
      );
    }

    const created = await db.contactRequest.create({
      data: {
        name: name.trim(),
        contact: contact.trim(),
        message: message.trim(),
        status: "PENDING",
      },
    });

    return NextResponse.json(
      { success: true, id: created.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/contact] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message" },
      { status: 500 }
    );
  }
}
