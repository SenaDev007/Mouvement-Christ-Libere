/** GET /api/bible-v2/search?version=fr-apee&q=paix — Recherche plein texte */
import { NextRequest, NextResponse } from "next/server";
import { rechercherVersets } from "@/lib/bible/data-loader";

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

  const resultats = rechercherVersets(version, q, limite);

  return NextResponse.json({
    version,
    recherche: q,
    nombre: resultats.length,
    resultats,
  });
}
