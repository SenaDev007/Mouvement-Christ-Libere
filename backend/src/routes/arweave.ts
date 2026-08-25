/**
 * Arweave anchoring routes (integrity verification).
 *   POST /api/arweave/ancrer   — anchor a piece of content (SHA-256 hash + optional Arweave tx)
 *   POST /api/arweave/verifier — verify content integrity against an anchor
 */

import { Router } from "express";
import {
  ancrerContenu,
  genererIdContenu,
  verifierIntegrite,
  calculerHash,
  type ContenuAncrable,
  type AncreArweave,
} from "../lib/arweave/coffre-fort";

const router = Router();

router.post("/ancrer", async (req, res) => {
  try {
    const { type, titre, contenu, auteur, dateCreation } = req.body || {};

    if (!type || !titre || !contenu || !auteur) {
      return res
        .status(400)
        .json({ error: "type, titre, contenu, auteur sont requis" });
    }

    const typesValides = [
      "temoignage",
      "enseignement",
      "video",
      "biographie",
    ];
    if (!typesValides.includes(type)) {
      return res
        .status(400)
        .json({
          error: `type invalide. Valeurs acceptées : ${typesValides.join(", ")}`,
        });
    }

    const contenuAncrable: ContenuAncrable = {
      id: genererIdContenu(type, titre),
      type,
      titre,
      contenu,
      auteur,
      dateCreation: dateCreation || new Date().toISOString(),
    };

    const ancre = await ancrerContenu(contenuAncrable);

    return res.json({ success: true, contenu: contenuAncrable, ancre });
  } catch (error) {
    console.error("[api/arweave/ancrer] error:", error);
    return res.status(500).json({ error: "Erreur lors de l'ancrage" });
  }
});

router.post("/verifier", async (req, res) => {
  try {
    const { contenu, ancre } = req.body || {};

    if (!contenu || !ancre) {
      return res
        .status(400)
        .json({ error: "contenu et ancre sont requis" });
    }

    const contenuAncrable = contenu as ContenuAncrable;
    const ancreData = ancre as AncreArweave;

    const verified = verifierIntegrite(contenuAncrable, ancreData);
    const hashActuel = calculerHash(contenuAncrable);

    return res.json({
      verified,
      hashActuel,
      hashAttendu: ancreData.hash,
      match: hashActuel === ancreData.hash,
    });
  } catch (error) {
    console.error("[api/arweave/verifier] error:", error);
    return res.status(500).json({ error: "Erreur lors de la vérification" });
  }
});

export default router;
