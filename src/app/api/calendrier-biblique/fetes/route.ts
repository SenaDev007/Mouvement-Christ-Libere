/**
 * GET /api/calendrier-biblique/fetes?annee=2026
 *
 * Liste des 11 fêtes avec dates grégoriennes équivalentes pour l'année donnée.
 */

import { NextRequest, NextResponse } from "next/server";
import { genererAnnee } from "@/lib/calendrier/generation";
import { calculerFetesPourAnnee } from "@/lib/calendrier/fetes";
import { libelleAnneeBiblique } from "@/lib/calendrier/conversion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const anneeStr = url.searchParams.get("annee");

    // Année par défaut : année biblique en cours
    const now = new Date();
    let annee = anneeStr ? parseInt(anneeStr) : now.getUTCFullYear();

    if (isNaN(annee) || annee < 1900 || annee > 2100) {
      return NextResponse.json(
        { error: "Année invalide (1900-2100)" },
        { status: 400 }
      );
    }

    const anneeBiblique = genererAnnee(annee);
    const fetes = calculerFetesPourAnnee(annee, anneeBiblique.jours, now);

    return NextResponse.json({
      annee,
      libelle: libelleAnneeBiblique(annee),
      fetes: fetes.map((f) => ({
        id: f.fete.id,
        nomFr: f.fete.nomFr,
        nomHebrew: f.fete.nomHebrew,
        referenceEcritures: f.fete.referenceEcritures,
        description: f.fete.description,
        categorie: f.fete.categorie,
        couleur: f.fete.couleur,
        travailInterdit: f.fete.travailInterdit,
        dureeJours: f.fete.dureeJours,
        dateBiblique: `${f.fete.jourDuMois} ${f.fete.nomHebrew || ""}`,
        dateGregorienne: f.dateGregorienne.toISOString(),
        jourDeSemaine: f.jourDeSemaine,
        joursRestants: f.joursRestants,
      })),
    });
  } catch (error) {
    console.error("[api/calendrier-biblique/fetes] error:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des fêtes" },
      { status: 500 }
    );
  }
}
