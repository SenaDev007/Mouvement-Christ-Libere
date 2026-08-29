/**
 * POST /api/soustitres — Génère des sous-titres multilingues
 * GET  /api/soustitres?langue=fr — Liste les langues disponibles
 */

import { NextRequest, NextResponse } from "next/server";
import {
  genererSousTitres,
  traduireSousTitres,
  LANGUES_SOUS_TITRAGE,
  isWhisperConfigured,
  genererSRT,
} from "@/lib/whisper/sous-titrage";

export const runtime = "nodejs";
export const revalidate = 60; // Cache 60s

export async function GET() {
  return NextResponse.json({
    langues: LANGUES_SOUS_TITRAGE,
    whisperConfigure: isWhisperConfigured(),
    mode: isWhisperConfigured() ? "production" : "demo",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fichierUrl, langueSource = "fr", languesCibles = ["en", "es", "pt"] } = body;

    if (!fichierUrl) {
      return NextResponse.json(
        { error: "fichierUrl est requis" },
        { status: 400 }
      );
    }

    // Générer les sous-titres source
    const resultat = await genererSousTitres(fichierUrl, langueSource);

    // Générer les traductions
    for (const langueCible of languesCibles) {
      if (langueCible !== langueSource) {
        const traduction = await traduireSousTitres(
          resultat.sousTitres,
          langueSource,
          langueCible
        );
        resultat.traductions[langueCible] = traduction;
      }
    }

    return NextResponse.json({
      ...resultat,
      srtSource: genererSRT(resultat.sousTitres),
      srtTraductions: Object.fromEntries(
        Object.entries(resultat.traductions).map(([lang, sts]) => [
          lang,
          genererSRT(sts),
        ])
      ),
    });
  } catch (error) {
    console.error("[api/soustitres] error:", error);
    return NextResponse.json(
      { error: "Erreur lors du sous-titrage" },
      { status: 500 }
    );
  }
}
