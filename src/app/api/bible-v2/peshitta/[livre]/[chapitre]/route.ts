/** GET /api/bible-v2/peshitta/[livre]/[chapitre] — Chapitre Peshitta araméenne */
import { NextRequest, NextResponse } from "next/server";
import { getChapitrePeshitta } from "@/lib/bible/data-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ livre: string; chapitre: string }> }
) {
  const { livre, chapitre: chapStr } = await params;
  const chapitre = parseInt(chapStr);

  if (isNaN(chapitre)) {
    return NextResponse.json({ error: "Numéro de chapitre invalide" }, { status: 400 });
  }

  const versets = getChapitrePeshitta(livre, chapitre);
  if (!versets) {
    return NextResponse.json({ error: "Chapitre Peshitta non trouvé" }, { status: 404 });
  }

  return NextResponse.json({
    livre,
    chapitre,
    nombreVersets: versets.length,
    versets,
  });
}
