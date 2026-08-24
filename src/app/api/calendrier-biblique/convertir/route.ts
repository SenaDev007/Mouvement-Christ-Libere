/**
 * GET /api/calendrier-biblique/convertir?gregorien=2026-08-24
 * GET /api/calendrier-biblique/convertir?biblique=2026&mois=1&jour=14
 *
 * Conversion bidirectionnelle grégorien ↔ biblique.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  convertirGregorienVersBiblique,
  convertirBibliqueVersGregorien,
  formaterDateGregorienne,
  formaterJourBiblique,
  libelleAnneeBiblique,
} from "@/lib/calendrier/conversion";
import { calculerCoucherSoleilJerusalem, formatHeureJerusalem } from "@/lib/calendrier/coucherSoleil";
import { FETES_DEFINITIONS, calculerJourAnneePourFete } from "@/lib/calendrier/fetes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const gregorien = url.searchParams.get("gregorien");
    const biblique = url.searchParams.get("biblique");
    const mois = url.searchParams.get("mois");
    const jour = url.searchParams.get("jour");

    if (gregorien) {
      // Conversion grégorien → biblique
      const date = new Date(gregorien);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Date grégorienne invalide (format attendu : YYYY-MM-DD)" },
          { status: 400 }
        );
      }

      const jourBiblique = convertirGregorienVersBiblique(date);
      if (!jourBiblique) {
        return NextResponse.json(
          { error: "Date hors plage calendaire calculable" },
          { status: 404 }
        );
      }

      // Coucher de soleil à Jérusalem
      const coucher = calculerCoucherSoleilJerusalem(jourBiblique.dateGregorienne);

      // Vérifier si ce jour correspond à une fête
      const feteCorrespondante = FETES_DEFINITIONS.find((f) => {
        const jourAnneeFete = calculerJourAnneePourFete(f);
        return jourAnneeFete === jourBiblique.jourDeAnnee;
      });

      return NextResponse.json({
        type: "gregorien_vers_biblique",
        dateGregorienne: date.toISOString(),
        dateGregorienneFormatee: formaterDateGregorienne(date),
        jourBiblique: {
          jourDeAnnee: jourBiblique.jourDeAnnee,
          mois: jourBiblique.mois,
          nomMois: jourBiblique.nomMois,
          jourDuMois: jourBiblique.jourDuMois,
          jourDeSemaine: jourBiblique.jourDeSemaine,
          nomJourSemaine: jourBiblique.nomJourSemaine,
          estShabbat: jourBiblique.estShabbat,
          trimestre: jourBiblique.trimestre,
          formate: formaterJourBiblique(jourBiblique),
        },
        anneeBiblique: libelleAnneeBiblique(jourBiblique.dateGregorienne.getUTCFullYear()),
        coucherSoleilJerusalem: coucher.toISOString(),
        coucherSoleilJerusalemHeure: formatHeureJerusalem(coucher),
        fete: feteCorrespondante
          ? {
              nomFr: feteCorrespondante.nomFr,
              nomHebrew: feteCorrespondante.nomHebrew,
              referenceEcritures: feteCorrespondante.referenceEcritures,
              description: feteCorrespondante.description,
            }
          : null,
      });
    }

    if (biblique && mois && jour) {
      // Conversion biblique → grégorien
      const anneeBiblique = parseInt(biblique);
      const moisNum = parseInt(mois);
      const jourNum = parseInt(jour);

      if (isNaN(anneeBiblique) || isNaN(moisNum) || isNaN(jourNum)) {
        return NextResponse.json(
          { error: "Paramètres invalides (annee, mois, jour doivent être des nombres)" },
          { status: 400 }
        );
      }

      const dateGreg = convertirBibliqueVersGregorien(anneeBiblique, moisNum, jourNum);
      if (!dateGreg) {
        return NextResponse.json(
          { error: "Date biblique invalide" },
          { status: 404 }
        );
      }

      const coucher = calculerCoucherSoleilJerusalem(dateGreg);
      const feteCorrespondante = FETES_DEFINITIONS.find(
        (f) => f.mois === moisNum && f.jourDuMois === jourNum
      );

      return NextResponse.json({
        type: "biblique_vers_gregorien",
        dateBiblique: {
          annee: anneeBiblique,
          mois: moisNum,
          jour: jourNum,
        },
        dateGregorienne: dateGreg.toISOString(),
        dateGregorienneFormatee: formaterDateGregorienne(dateGreg),
        coucherSoleilJerusalem: coucher.toISOString(),
        coucherSoleilJerusalemHeure: formatHeureJerusalem(coucher),
        fete: feteCorrespondante
          ? {
              nomFr: feteCorrespondante.nomFr,
              nomHebrew: feteCorrespondante.nomHebrew,
              referenceEcritures: feteCorrespondante.referenceEcritures,
            }
          : null,
      });
    }

    return NextResponse.json(
      {
        error:
          "Paramètres manquants. Utilisez ?gregorien=YYYY-MM-DD ou ?biblique=2026&mois=1&jour=14",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[api/calendrier-biblique/convertir] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la conversion" },
      { status: 500 }
    );
  }
}
