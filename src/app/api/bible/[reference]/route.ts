/**
 * GET /api/bible/[reference]
 *
 * Retourne le texte d'un verset biblique.
 * Ex: /api/bible/Genèse%205:24
 *
 * Réponse : { reference, texte, contexte, livre, traductions }
 */

import { NextRequest, NextResponse } from "next/server";
import { parserReference } from "@/lib/bible/references";
import { trouverVerset } from "@/lib/bible/versets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference: refEncoded } = await params;
    const reference = decodeURIComponent(refEncoded);

    const parsed = parserReference(reference);
    if (!parsed) {
      return NextResponse.json(
        { error: "Référence biblique invalide" },
        { status: 400 }
      );
    }

    // Chercher dans la base locale
    const verset = trouverVerset(parsed.referenceNormalisee);

    if (!verset) {
      // Verset non trouvé dans la base locale
      return NextResponse.json({
        reference: parsed.referenceNormalisee,
        livre: {
          nomFr: parsed.livre.nomFr,
          nomHe: parsed.livre.nomHe,
          testament: parsed.livre.testament,
        },
        chapitre: parsed.chapitre,
        verset: parsed.versetDebut,
        versetFin: parsed.versetFin,
        texte: null,
        message: "Verset non disponible dans la base locale. Base étendue en cours d'enrichissement.",
        disponible: false,
      });
    }

    return NextResponse.json({
      reference: verset.reference,
      livre: {
        id: verset.livreId,
        nomFr: parsed.livre.nomFr,
        nomHe: parsed.livre.nomHe,
        testament: parsed.livre.testament,
      },
      chapitre: verset.chapitre,
      verset: verset.verset,
      texte: verset.texte,
      contexte: verset.contexte || null,
      traductions: {
        louisSegond: verset.texte,
        ostervald: verset.texteOstervald || null,
        darby: verset.texteDarby || null,
      },
      disponible: true,
    });
  } catch (error) {
    console.error("[api/bible/[reference]] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recherche du verset" },
      { status: 500 }
    );
  }
}
