/** GET /api/bible-v2/search?version=fr-apee&q=paix — Recherche plein texte */
import { NextRequest, NextResponse } from "next/server";
import { rechercherVersets } from "@/lib/bible/data-loader";
import { chercherFallbackParTexte } from "@/lib/bible/fallback-versets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const version = url.searchParams.get("version") || "fr-apee";
  const q = url.searchParams.get("q") || "";
  const limite = parseInt(url.searchParams.get("limite") || "50");

  if (!q.trim()) {
    return NextResponse.json({ error: "Paramètre 'q' requis" }, { status: 400 });
  }

  // Essayer le chargement depuis les fichiers locaux
  const resultats = rechercherVersets(version, q, limite);

  if (resultats.length > 0) {
    return NextResponse.json({ version, recherche: q, nombre: resultats.length, resultats });
  }

  // Fallback : chercher dans les versets de secours
  const fallbackResultats = chercherFallbackParTexte(q);

  return NextResponse.json({
    version: "Fallback",
    recherche: q,
    nombre: fallbackResultats.length,
    resultats: fallbackResultats.map((v) => ({
      livre: v.livre,
      livreId: v.livreId,
      chapitre: v.chapitre,
      verset: v.verset,
      texte: v.texte,
    })),
    fallback: true,
  });
}
