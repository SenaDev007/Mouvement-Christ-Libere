/**
 * POST /api/arweave/verifier
 *
 * Vérifie l'intégrité d'un contenu par rapport à son ancre.
 *
 * Corps : { contenu, ancre }
 * Réponse : { verified, hashActuel, hashAttendu }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifierIntegrite, calculerHash, type ContenuAncrable, type AncreArweave } from "@/lib/arweave/coffre-fort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contenu, ancre } = body;

    if (!contenu || !ancre) {
      return NextResponse.json(
        { error: "contenu et ancre sont requis" },
        { status: 400 }
      );
    }

    const contenuAncrable = contenu as ContenuAncrable;
    const ancreData = ancre as AncreArweave;

    const verified = verifierIntegrite(contenuAncrable, ancreData);
    const hashActuel = calculerHash(contenuAncrable);

    return NextResponse.json({
      verified,
      hashActuel,
      hashAttendu: ancreData.hash,
      match: hashActuel === ancreData.hash,
    });
  } catch (error) {
    console.error("[api/arweave/verifier] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    );
  }
}
