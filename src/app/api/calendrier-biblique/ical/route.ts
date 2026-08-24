/**
 * GET /api/calendrier-biblique/ical?annee=2026
 *
 * Export .ics des fêtes pour une année biblique.
 * Importable dans Google Calendar, Outlook, Apple Calendar.
 */

import { NextRequest, NextResponse } from "next/server";
import { genererAnnee } from "@/lib/calendrier/generation";
import { calculerFetesPourAnnee } from "@/lib/calendrier/fetes";
import { genererICal, headersICal } from "@/lib/calendrier/ical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const anneeStr = url.searchParams.get("annee");
    const now = new Date();
    const annee = anneeStr ? parseInt(anneeStr) : now.getUTCFullYear();

    if (isNaN(annee) || annee < 1900 || annee > 2100) {
      return NextResponse.json(
        { error: "Année invalide (1900-2100)" },
        { status: 400 }
      );
    }

    const anneeBiblique = genererAnnee(annee);
    const fetes = calculerFetesPourAnnee(annee, anneeBiblique.jours, now);

    const icalContent = genererICal(annee, fetes);
    const filename = `calendrier-biblique-${annee}-${annee + 1}.ics`;

    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        ...headersICal(filename),
        "Content-Length": Buffer.byteLength(icalContent).toString(),
      },
    });
  } catch (error) {
    console.error("[api/calendrier-biblique/ical] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du fichier iCal" },
      { status: 500 }
    );
  }
}
