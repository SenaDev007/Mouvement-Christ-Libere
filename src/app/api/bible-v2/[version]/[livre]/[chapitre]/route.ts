/** GET /api/bible-v2/[version]/[livre]/[chapitre] — Chapitre complet */
import { NextRequest, NextResponse } from "next/server";
import { chargerVersion, getChapitre } from "@/lib/bible/data-loader";
import { FALLBACK_VERSETS } from "@/lib/bible/fallback-versets";

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

  // Essayer le chargement depuis les fichiers locaux
  const versionData = chargerVersion(version);
  if (versionData) {
    const livreData = versionData.livres.find((l) => l.id === livre);
    if (livreData) {
      const versets = getChapitre(version, livre, chapitre);
      if (versets) {
        return NextResponse.json({
          version: versionData.nom,
          livre: livreData.nom,
          livreId: livre,
          chapitre,
          nombreVersets: versets.length,
          versets: versets.map((texte, i) => ({ numero: i + 1, texte })),
        });
      }
    }
  }

  // Fallback : chercher dans les versets de secours
  const versetsFallback = FALLBACK_VERSETS.filter(
    (v) => v.livreId === livre && v.chapitre === chapitre
  );

  if (versetsFallback.length > 0) {
    return NextResponse.json({
      version: "Fallback (versets clés)",
      livre: versetsFallback[0].livre,
      livreId: livre,
      chapitre,
      nombreVersets: versetsFallback.length,
      versets: versetsFallback.map((v) => ({ numero: v.verset, texte: v.texte })),
      fallback: true,
    });
  }

  return NextResponse.json({
    version: "Fallback",
    livre: livre,
    livreId: livre,
    chapitre,
    nombreVersets: 0,
    versets: [],
    fallback: true,
    message: "Ce chapitre n'est pas disponible dans les versets de secours. Les données complètes nécessitent un hébergement avec les fichiers bibliques (46MB).",
  });
}
