/**
 * GET /api/calendrier-biblique/pdf?annee=2026&mode=mois|trimestre|annee
 *
 * Génère et télécharge le calendrier biblique en PDF designé
 * (pdf-lib, polices embarquées) — remplace l'export iCal.
 *
 * - mode=mois      : couverture + 12 planches (un mois par page)
 * - mode=trimestre : couverture + 4 planches (3 mois côte à côte)
 * - mode=annee     : couverture + récapitulatif 12 mois + table des fêtes
 */

import { NextRequest, NextResponse } from "next/server";
import { genererPdfCalendrier, type ModePdfCalendrier } from "@/lib/calendrier/pdf/generer-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES_VALIDES: ModePdfCalendrier[] = ["mois", "trimestre", "annee"];

const LIBELLES_MODE: Record<ModePdfCalendrier, string> = {
  mois: "par-mois",
  trimestre: "par-trimestre",
  annee: "annee",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const annee = parseInt(searchParams.get("annee") ?? "", 10);
    const modeBrut = (searchParams.get("mode") ?? "annee") as ModePdfCalendrier;

    if (isNaN(annee) || annee < 1900 || annee > 2100) {
      return NextResponse.json(
        { error: "Année invalide (1900-2100)" },
        { status: 400 }
      );
    }
    if (!MODES_VALIDES.includes(modeBrut)) {
      return NextResponse.json(
        { error: "Mode invalide (mois, trimestre ou annee)" },
        { status: 400 }
      );
    }

    const octets = await genererPdfCalendrier(annee, modeBrut);
    const anneeFin = annee + 1;
    const nomFichier = `calendrier-biblique-${annee}-${anneeFin}-${LIBELLES_MODE[modeBrut]}.pdf`;

    return new NextResponse(octets as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomFichier}"`,
        "Content-Length": String(octets.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[api/calendrier-biblique/pdf] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}
