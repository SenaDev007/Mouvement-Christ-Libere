/**
 * GET /api/calendrier-biblique/[annee]
 *
 * Retourne l'année biblique complète (364 jours, 12 mois, fêtes intégrées).
 * Génération dynamique — aucune donnée codée en dur au-delà de l'ancre.
 */

import { NextRequest, NextResponse } from "next/server";
import { genererAnnee } from "@/lib/calendrier/generation";
import { calculerFetesPourAnnee } from "@/lib/calendrier/fetes";
import { libelleAnneeBiblique } from "@/lib/calendrier/conversion";

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

    const anneeBiblique = genererAnnee(annee);
    const fetes = calculerFetesPourAnnee(annee, anneeBiblique.jours);

    // Sérialiser (Date → ISO string)
    const serialized = {
      annee,
      libelle: libelleAnneeBiblique(annee),
      debut: anneeBiblique.debut.toISOString(),
      fin: anneeBiblique.fin.toISOString(),
      nombreJours: anneeBiblique.jours.length,
      jours: anneeBiblique.jours.map((j) => ({
        ...j,
        dateGregorienne: j.dateGregorienne.toISOString(),
      })),
      fetes: fetes.map((f) => ({
        ...f,
        dateGregorienne: f.dateGregorienne.toISOString(),
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[api/calendrier-biblique/[annee]] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de l'année" },
      { status: 500 }
    );
  }
}
