/**
 * Bible routes (V1).
 *   GET /api/bible/:reference   — get a verse by reference (e.g. "Genèse 5:24")
 *   GET /api/bible/search?q=... — search verses by keyword
 */

import { Router } from "express";
import { parserReference } from "../lib/bible/references";
import {
  trouverVerset,
  chercherVersetsParTexte,
} from "../lib/bible/versets";

const router = Router();

router.get("/search", (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const limite = parseInt((req.query.limite as string) || "20");

    if (!q.trim()) {
      return res.status(400).json({ error: "Paramètre 'q' requis" });
    }

    const resultats = chercherVersetsParTexte(q, limite);
    return res.json({
      recherche: q,
      nombre: resultats.length,
      versets: resultats,
    });
  } catch (error) {
    console.error("[api/bible/search] error:", error);
    return res.status(500).json({ error: "Erreur lors de la recherche" });
  }
});

router.get("/:reference", (req, res) => {
  try {
    const reference = decodeURIComponent(req.params.reference);
    const parsed = parserReference(reference);
    if (!parsed) {
      return res.status(400).json({ error: "Référence biblique invalide" });
    }

    const verset = trouverVerset(parsed.referenceNormalisee);

    if (!verset) {
      return res.json({
        reference: parsed.referenceNormalisee,
        livre: {
          nomFr: parsed.livre.nomFr,
          nomHe: parsed.livre.nomHe,
          testament: parsed.livre.testament,
        },
        chapitre: parsed.chapitre,
        verset: parsed.versetDebut,
        versetFin: parsed.versetFin,
        texte: null,
        message:
          "Verset non disponible dans la base locale. Base étendue en cours d'enrichissement.",
        disponible: false,
      });
    }

    return res.json({
      reference: verset.reference,
      livre: {
        id: verset.livreId,
        nomFr: parsed.livre.nomFr,
        nomHe: parsed.livre.nomHe,
        testament: parsed.livre.testament,
      },
      chapitre: verset.chapitre,
      verset: verset.verset,
      texte: verset.texte,
      contexte: verset.contexte || null,
      traductions: {
        louisSegond: verset.texte,
        ostervald: verset.texteOstervald || null,
        darby: verset.texteDarby || null,
      },
      disponible: true,
    });
  } catch (error) {
    console.error("[api/bible/[reference]] error:", error);
    return res
      .status(500)
      .json({ error: "Erreur lors de la recherche du verset" });
  }
});

export default router;
