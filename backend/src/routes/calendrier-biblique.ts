/**
 * Calendrier biblique (V2) routes.
 *   GET /api/calendrier-biblique/:annee           — full biblical year (364 days)
 *   GET /api/calendrier-biblique/fetes             — list of 11 feasts for the year
 *   GET /api/calendrier-biblique/convertir         — gregorian ↔ biblical conversion
 *   GET /api/calendrier-biblique/ical              — iCal export
 */

import { Router } from "express";
import { genererAnnee } from "../lib/calendrier/generation";
import { calculerFetesPourAnnee } from "../lib/calendrier/fetes";
import {
  convertirGregorienVersBiblique,
  convertirBibliqueVersGregorien,
  formaterDateGregorienne,
  formaterJourBiblique,
  libelleAnneeBiblique,
} from "../lib/calendrier/conversion";
import {
  calculerCoucherSoleilJerusalem,
  formatHeureJerusalem,
} from "../lib/calendrier/coucherSoleil";
import {
  FETES_DEFINITIONS,
  calculerJourAnneePourFete,
} from "../lib/calendrier/fetes";
import { genererICal, headersICal } from "../lib/calendrier/ical";

const router = Router();

// --- GET /api/calendrier-biblique/ical ---
router.get("/ical", (req, res) => {
  try {
    const anneeStr = req.query.annee as string | undefined;
    const now = new Date();
    const annee = anneeStr ? parseInt(anneeStr) : now.getUTCFullYear();

    if (isNaN(annee) || annee < 1900 || annee > 2100) {
      return res.status(400).json({ error: "Année invalide (1900-2100)" });
    }

    const anneeBiblique = genererAnnee(annee);
    const fetes = calculerFetesPourAnnee(annee, anneeBiblique.jours, now);

    const icalContent = genererICal(annee, fetes);
    const filename = `calendrier-biblique-${annee}-${annee + 1}.ics`;

    const headers = headersICal(filename);
    res.setHeader("Content-Type", headers["Content-Type"]);
    res.setHeader(
      "Content-Disposition",
      headers["Content-Disposition"],
    );
    res.setHeader(
      "Content-Length",
      Buffer.byteLength(icalContent).toString(),
    );
    return res.status(200).send(icalContent);
  } catch (error) {
    console.error("[api/calendrier-biblique/ical] error:", error);
    return res
      .status(500)
      .json({ error: "Erreur lors de la génération du fichier iCal" });
  }
});

// --- GET /api/calendrier-biblique/convertir ---
router.get("/convertir", (req, res) => {
  try {
    const gregorien = req.query.gregorien as string | undefined;
    const biblique = req.query.biblique as string | undefined;
    const mois = req.query.mois as string | undefined;
    const jour = req.query.jour as string | undefined;

    if (gregorien) {
      const date = new Date(gregorien);
      if (isNaN(date.getTime())) {
        return res
          .status(400)
          .json({
            error: "Date grégorienne invalide (format attendu : YYYY-MM-DD)",
          });
      }

      const jourBiblique = convertirGregorienVersBiblique(date);
      if (!jourBiblique) {
        return res
          .status(404)
          .json({ error: "Date hors plage calendaire calculable" });
      }

      const coucher = calculerCoucherSoleilJerusalem(
        jourBiblique.dateGregorienne,
      );

      const feteCorrespondante = FETES_DEFINITIONS.find((f) => {
        const jourAnneeFete = calculerJourAnneePourFete(f);
        return jourAnneeFete === jourBiblique.jourDeAnnee;
      });

      return res.json({
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
        anneeBiblique: libelleAnneeBiblique(
          jourBiblique.dateGregorienne.getUTCFullYear(),
        ),
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
      const anneeBiblique = parseInt(biblique);
      const moisNum = parseInt(mois);
      const jourNum = parseInt(jour);

      if (isNaN(anneeBiblique) || isNaN(moisNum) || isNaN(jourNum)) {
        return res
          .status(400)
          .json({
            error:
              "Paramètres invalides (annee, mois, jour doivent être des nombres)",
          });
      }

      const dateGreg = convertirBibliqueVersGregorien(
        anneeBiblique,
        moisNum,
        jourNum,
      );
      if (!dateGreg) {
        return res.status(404).json({ error: "Date biblique invalide" });
      }

      const coucher = calculerCoucherSoleilJerusalem(dateGreg);
      const feteCorrespondante = FETES_DEFINITIONS.find(
        (f) => f.mois === moisNum && f.jourDuMois === jourNum,
      );

      return res.json({
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

    return res.status(400).json({
      error:
        "Paramètres manquants. Utilisez ?gregorien=YYYY-MM-DD ou ?biblique=2026&mois=1&jour=14",
    });
  } catch (error) {
    console.error("[api/calendrier-biblique/convertir] error:", error);
    return res.status(500).json({ error: "Erreur lors de la conversion" });
  }
});

// --- GET /api/calendrier-biblique/fetes ---
router.get("/fetes", (req, res) => {
  try {
    const anneeStr = req.query.annee as string | undefined;
    const now = new Date();
    const annee = anneeStr ? parseInt(anneeStr) : now.getUTCFullYear();

    if (isNaN(annee) || annee < 1900 || annee > 2100) {
      return res.status(400).json({ error: "Année invalide (1900-2100)" });
    }

    const anneeBiblique = genererAnnee(annee);
    const fetes = calculerFetesPourAnnee(annee, anneeBiblique.jours, now);

    return res.json({
      annee,
      libelle: libelleAnneeBiblique(annee),
      fetes: fetes.map((f) => ({
        id: f.fete.id,
        nomFr: f.fete.nomFr,
        nomHebrew: f.fete.nomHebrew,
        referenceEcritures: f.fete.referenceEcritures,
        description: f.fete.description,
        categorie: f.fete.categorie,
        couleur: f.fete.couleur,
        travailInterdit: f.fete.travailInterdit,
        dureeJours: f.fete.dureeJours,
        dateBiblique: `${f.fete.jourDuMois} ${f.fete.nomHebrew || ""}`,
        dateGregorienne: f.dateGregorienne.toISOString(),
        jourDeSemaine: f.jourDeSemaine,
        joursRestants: f.joursRestants,
      })),
    });
  } catch (error) {
    console.error("[api/calendrier-biblique/fetes] error:", error);
    return res.status(500).json({ error: "Erreur lors du calcul des fêtes" });
  }
});

// --- GET /api/calendrier-biblique/:annee ---
router.get("/:annee", (req, res) => {
  try {
    const annee = parseInt(req.params.annee);
    if (isNaN(annee) || annee < 1900 || annee > 2100) {
      return res.status(400).json({ error: "Année invalide (1900-2100)" });
    }

    const anneeBiblique = genererAnnee(annee);
    const fetes = calculerFetesPourAnnee(annee, anneeBiblique.jours);

    const serialized = {
      annee,
      libelle: libelleAnneeBiblique(annee),
      debut: anneeBiblique.debut.toISOString(),
      fin: anneeBiblique.fin.toISOString(),
      nombreJours: anneeBiblique.jours.length,
      jours: anneeBiblique.jours.map((j) => ({
        ...j,
        dateGregorienne: j.dateGregorienne.toISOString(),
      })),
      fetes: fetes.map((f) => ({
        ...f,
        dateGregorienne: f.dateGregorienne.toISOString(),
      })),
    };

    return res.json(serialized);
  } catch (error) {
    console.error("[api/calendrier-biblique/[annee]] error:", error);
    return res
      .status(500)
      .json({ error: "Erreur lors de la génération de l'année" });
  }
});

export default router;
