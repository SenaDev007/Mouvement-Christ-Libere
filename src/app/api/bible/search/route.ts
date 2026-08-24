/**
 * GET /api/bible/search?q=paix
 *
 * Recherche de versets par mot-clé dans le texte.
 */

import { NextRequest, NextResponse } from "next/server";
import { chercherVersetsParTexte } from "@/lib/bible/versets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const limite = parseInt(url.searchParams.get("limite") || "20");

    if (!q.trim()) {
      return NextResponse.json(
        { error: "Paramètre 'q' requis" },
        { status: 400 }
      );
    }

    const resultats = chercherVersetsParTexte(q, limite);

    return NextResponse.json({
      recherche: q,
      nombre: resultats.length,
      versets: resultats,
    });
  } catch (error) {
    console.error("[api/bible/search] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recherche" },
      { status: 500 }
    );
  }
}
