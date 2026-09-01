/**
 * GET /api/calendrier-biblique/[annee]
 *
 * Retourne l'année biblique complète (364 jours, 12 mois, fêtes intégrées)
 * au MÊME format aplati que la page publique — sert la navigation continue
 * entre années (hook useAnneesBibliques charge à la volée les années non
 * encore consultées).
 *
 * Génération dynamique — aucune donnée codée en dur au-delà de l'ancre.
 */

import { NextRequest, NextResponse } from "next/server";
import { serialiserAnneePourClient } from "@/lib/calendrier/evenements-shofar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ annee: string }> }
) {
  try {
    const { annee: anneeStr } = await params;
    const annee = parseInt(anneeStr);

    if (isNaN(annee) || annee < 1900 || annee > 2100) {
      return NextResponse.json(
        { error: "Année invalide (1900-2100)" },
        { status: 400 }
      );
    }

    const serialized = serialiserAnneePourClient(annee);
    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[api/calendrier-biblique/[annee]] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de l'année" },
      { status: 500 }
    );
  }
}
