/**
 * Bible V2 routes (multilingual + Strong + Hebrew morphology + Peshitta).
 *   GET /api/bible-v2/versions                       — list all versions
 *   GET /api/bible-v2/search?version=&q=&limite=     — full-text search
 *   GET /api/bible-v2/:version/:livre/:chapitre      — full chapter
 *   GET /api/bible-v2/strong/:numero                 — Strong definition
 *   GET /api/bible-v2/concordance/:numero            — Strong concordance
 *   GET /api/bible-v2/hebrew/:livre/:chapitre/:verset — Hebrew morphology
 *   GET /api/bible-v2/peshitta/:livre/:chapitre      — Aramaic Peshitta
 */

import { Router } from "express";
import {
  chargerVersion,
  getChapitre,
  rechercherVersets,
  listerVersions,
  chercherStrong,
  concordanceStrong,
  getVersetHebreu,
  oshbVersId,
  getChapitrePeshitta,
} from "../lib/bible/data-loader";
import { FALLBACK_VERSETS, chercherFallbackParTexte } from "../lib/bible/fallback-versets";

const router = Router();

// GET /api/bible-v2/versions
router.get("/versions", (_req, res) => {
  return res.json({ versions: listerVersions() });
});

// GET /api/bible-v2/search
router.get("/search", (req, res) => {
  const version = (req.query.version as string) || "fr-apee";
  const q = (req.query.q as string) || "";
  const limite = parseInt((req.query.limite as string) || "50");

  if (!q.trim()) {
    return res.status(400).json({ error: "Paramètre 'q' requis" });
  }

  const resultats = rechercherVersets(version, q, limite);

  if (resultats.length > 0) {
    return res.json({
      version,
      recherche: q,
      nombre: resultats.length,
      resultats,
    });
  }

  const fallbackResultats = chercherFallbackParTexte(q);

  return res.json({
    version: "Fallback",
    recherche: q,
    nombre: fallbackResultats.length,
    resultats: fallbackResultats.map((v) => ({
      livre: v.livre,
      livreId: v.livreId,
      chapitre: v.chapitre,
      verset: v.verset,
      texte: v.texte,
    })),
    fallback: true,
  });
});

// GET /api/bible-v2/strong/:numero
router.get("/strong/:numero", (req, res) => {
  const entree = chercherStrong(req.params.numero);
  if (!entree) {
    return res.status(404).json({ error: "Entrée Strong non trouvée" });
  }
  return res.json(entree);
});

// GET /api/bible-v2/concordance/:numero
router.get("/concordance/:numero", (req, res) => {
  const { numero } = req.params;
  const limite = parseInt((req.query.limite as string) || "50");

  const entree = chercherStrong(numero);
  const versets = concordanceStrong(numero, limite);

  return res.json({
    strong: entree,
    nombreVersets: versets.length,
    versets,
  });
});

// GET /api/bible-v2/hebrew/:livre/:chapitre/:verset
router.get("/hebrew/:livre/:chapitre/:verset", (req, res) => {
  const { livre, chapitre: chapStr, verset: versStr } = req.params;
  const chapitre = parseInt(chapStr);
  const verset = parseInt(versStr);

  if (isNaN(chapitre) || isNaN(verset)) {
    return res.status(400).json({ error: "Numéros invalides" });
  }

  const versetData = getVersetHebreu(livre, chapitre, verset);
  if (!versetData) {
    return res.status(404).json({ error: "Verset non trouvé" });
  }

  return res.json({
    livre,
    livreId: oshbVersId(livre),
    chapitre,
    verset,
    mots: versetData.mots,
  });
});

// GET /api/bible-v2/peshitta/:livre/:chapitre
router.get("/peshitta/:livre/:chapitre", (req, res) => {
  const { livre, chapitre: chapStr } = req.params;
  const chapitre = parseInt(chapStr);

  if (isNaN(chapitre)) {
    return res.status(400).json({ error: "Numéro de chapitre invalide" });
  }

  const versets = getChapitrePeshitta(livre, chapitre);
  if (!versets) {
    return res.status(404).json({ error: "Chapitre Peshitta non trouvé" });
  }

  return res.json({ livre, chapitre, nombreVersets: versets.length, versets });
});

// GET /api/bible-v2/:version/:livre/:chapitre  (must be after specific routes)
router.get("/:version/:livre/:chapitre", (req, res) => {
  const { version, livre, chapitre: chapStr } = req.params;
  const chapitre = parseInt(chapStr);

  if (isNaN(chapitre) || chapitre < 1) {
    return res.status(400).json({ error: "Numéro de chapitre invalide" });
  }

  const versionData = chargerVersion(version);
  if (versionData) {
    const livreData = versionData.livres.find((l) => l.id === livre);
    if (livreData) {
      const versets = getChapitre(version, livre, chapitre);
      if (versets) {
        return res.json({
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

  const versetsFallback = FALLBACK_VERSETS.filter(
    (v) => v.livreId === livre && v.chapitre === chapitre,
  );

  if (versetsFallback.length > 0) {
    return res.json({
      version: "Fallback (versets clés)",
      livre: versetsFallback[0].livre,
      livreId: livre,
      chapitre,
      nombreVersets: versetsFallback.length,
      versets: versetsFallback.map((v) => ({
        numero: v.verset,
        texte: v.texte,
      })),
      fallback: true,
    });
  }

  return res.json({
    version: "Fallback",
    livre,
    livreId: livre,
    chapitre,
    nombreVersets: 0,
    versets: [],
    fallback: true,
    message:
      "Ce chapitre n'est pas disponible dans les versets de secours. Les données complètes nécessitent un hébergement avec les fichiers bibliques (46MB).",
  });
});

export default router;
