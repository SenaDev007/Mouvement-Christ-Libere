/** GET /api/bible-v2/[version]/[livre]/[chapitre] — Chapitre complet */
import { NextRequest, NextResponse } from "next/server";
import { chargerVersion, getChapitre } from "@/lib/bible/data-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ version: string; livre: string; chapitre: string }> }
) {
  const { version, livre, chapitre: chapStr } = await params;
  const chapitre = parseInt(chapStr);

  if (isNaN(chapitre) || chapitre < 1) {
    return NextResponse.json({ error: "Numéro de chapitre invalide" }, { status: 400 });
  }

  const versionData = chargerVersion(version);
  if (!versionData) {
    return NextResponse.json({ error: "Version non disponible" }, { status: 404 });
  }

  const livreData = versionData.livres.find((l) => l.id === livre);
  if (!livreData) {
    return NextResponse.json({ error: "Livre non trouvé" }, { status: 404 });
  }

  const versets = getChapitre(version, livre, chapitre);
  if (!versets) {
    return NextResponse.json({ error: "Chapitre non trouvé" }, { status: 404 });
  }

  return NextResponse.json({
    version: versionData.nom,
    livre: livreData.nom,
    livreId: livre,
    chapitre,
    nombreVersets: versets.length,
    versets: versets.map((texte, i) => ({ numero: i + 1, texte })),
  });
}
