import { NextResponse } from "next/server";
import { calculerEvenementsShofar, serialiserAnneePourClient } from "@/lib/calendrier/evenements-shofar";
import { determinerAnneeBibliqueEnCours } from "@/lib/calendrier/ancrage";

/**
 * GET /api/calendrier-biblique/evenements
 *
 * Moteur shofar + notifications de la communauté :
 * - sans paramètre  → réponse LÉGÈRE : les prochains événements (sonneries
 *   de shofar + jalons J-7/J-3/J-24h des solennités). Consommée par le
 *   ShofarNotifier de Yeshua Connect à l'ouverture du chat.
 * - ?full=1         → ajoute `annees` (3 années bibliques sérialisées,
 *   même format que la page /calendrier-biblique) pour le workspace
 *   calendrier intégré au chat.
 *
 * Route publique (données non sensibles, comme /ical et /convertir).
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const avecAnnees = url.searchParams.get("full") === "1";

    const maintenant = new Date();
    const evenements = calculerEvenementsShofar(maintenant);

    const reponse: Record<string, unknown> = {
      maintenant: maintenant.toISOString(),
      anneeBiblique: determinerAnneeBibliqueEnCours(maintenant),
      evenements,
    };

    if (avecAnnees) {
      const anneeCourante = determinerAnneeBibliqueEnCours(maintenant);
      reponse.annees = [anneeCourante - 1, anneeCourante, anneeCourante + 1].map((ab) =>
        serialiserAnneePourClient(ab, maintenant)
      );
    }

    return NextResponse.json(reponse, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/calendrier-biblique/evenements] Erreur:", error);
    return NextResponse.json({ error: "Erreur de calcul du calendrier" }, { status: 500 });
  }
}
