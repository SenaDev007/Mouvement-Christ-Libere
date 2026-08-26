/**
 * Subtitling routes (Whisper + multilingual translation).
 *   GET  /api/soustitres              — list available languages + Whisper config status
 *   POST /api/soustitres              — generate subtitles from a file URL
 */

import { Router } from "express";
import {
  genererSousTitres,
  traduireSousTitres,
  LANGUES_SOUS_TITRAGE,
  isWhisperConfigured,
  genererSRT,
} from "../lib/whisper/sous-titrage";

const router = Router();

router.get("/", (_req, res) => {
  return res.json({
    langues: LANGUES_SOUS_TITRAGE,
    whisperConfigure: isWhisperConfigured(),
    mode: isWhisperConfigured() ? "production" : "demo",
  });
});

router.post("/", async (req, res) => {
  try {
    const { fichierUrl, langueSource = "fr", languesCibles = ["en", "es", "pt"] } =
      req.body || {};

    if (!fichierUrl) {
      return res.status(400).json({ error: "fichierUrl est requis" });
    }

    const resultat = await genererSousTitres(fichierUrl, langueSource);

    for (const langueCible of languesCibles) {
      if (langueCible !== langueSource) {
        const traduction = await traduireSousTitres(
          resultat.sousTitres,
          langueSource,
          langueCible,
        );
        resultat.traductions[langueCible] = traduction;
      }
    }

    return res.json({
      ...resultat,
      srtSource: genererSRT(resultat.sousTitres),
      srtTraductions: Object.fromEntries(
        Object.entries(resultat.traductions).map(([lang, sts]) => [
          lang,
          genererSRT(sts),
        ]),
      ),
    });
  } catch (error) {
    console.error("[api/soustitres] error:", error);
    return res.status(500).json({ error: "Erreur lors du sous-titrage" });
  }
});

export default router;
