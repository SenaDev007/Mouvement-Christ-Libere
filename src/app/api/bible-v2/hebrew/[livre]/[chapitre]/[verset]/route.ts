/** GET /api/bible-v2/hebrew/[livre]/[chapitre]/[verset] — Verset hébraïque morphologique */
import { NextRequest, NextResponse } from "next/server";
import { getVersetHebreu, oshbVersId } from "@/lib/bible/data-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ livre: string; chapitre: string; verset: string }> }
) {
  const { livre, chapitre: chapStr, verset: versStr } = await params;
  const chapitre = parseInt(chapStr);
  const verset = parseInt(versStr);

  if (isNaN(chapitre) || isNaN(verset)) {
    return NextResponse.json({ error: "Numéros invalides" }, { status: 400 });
  }

  const versetData = getVersetHebreu(livre, chapitre, verset);
  if (!versetData) {
    return NextResponse.json({ error: "Verset non trouvé" }, { status: 404 });
  }

  return NextResponse.json({
    livre,
    livreId: oshbVersId(livre),
    chapitre,
    verset,
    mots: versetData.mots,
  });
}
