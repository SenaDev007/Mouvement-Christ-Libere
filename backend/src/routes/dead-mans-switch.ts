/**
 * Dead Man's Switch routes.
 *   GET  /api/dead-mans-switch             — list all switches (admin)
 *   POST /api/dead-mans-switch             — create a switch
 *   POST /api/dead-mans-switch/signal      — reset timer (signal activity)
 *   GET  /api/dead-mans-switch/cron        — check & trigger (cron)
 */

import { Router } from "express";
import { createHash } from "crypto";
import { db } from "../lib/db";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const switches = await db.deadMansSwitch.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json({ switches });
  } catch {
    return res.json({ switches: [], demo: true });
  }
});

router.post("/", async (req, res) => {
  try {
    const { contenuType, contenuTitre, contenuData, delaiJours = 30 } =
      req.body || {};

    if (!contenuType || !contenuTitre || !contenuData) {
      return res
        .status(400)
        .json({ error: "contenuType, contenuTitre, contenuData requis" });
    }

    const hash = createHash("sha256").update(contenuData).digest("hex");
    const contenuId = `${contenuType}-${Date.now()}`;

    try {
      const dms = await db.deadMansSwitch.create({
        data: {
          contenuId,
          contenuType,
          contenuTitre,
          contenuData,
          hash,
          delaiJours,
          derniereActivite: new Date(),
          estDeclenche: false,
        },
      });
      return res
        .status(201)
        .json({ success: true, id: dms.id, hash });
    } catch {
      return res.json({
        success: true,
        demo: true,
        hash,
        contenuId,
        message: "Commutateur créé (mode démo — DB non accessible)",
      });
    }
  } catch {
    return res.status(500).json({ error: "Erreur" });
  }
});

router.post("/signal", async (req, res) => {
  try {
    const { id } = req.body || {};

    if (!id) {
      try {
        await db.deadMansSwitch.updateMany({
          where: { estDeclenche: false },
          data: { derniereActivite: new Date() },
        });
      } catch {
        // ignore
      }
      return res.json({
        success: true,
        message: "Tous les commutateurs réinitialisés",
      });
    }

    try {
      await db.deadMansSwitch.update({
        where: { id },
        data: { derniereActivite: new Date() },
      });
      return res.json({ success: true });
    } catch {
      return res.json({ success: true, demo: true });
    }
  } catch {
    return res.status(500).json({ error: "Erreur" });
  }
});

router.get("/cron", async (req, res) => {
  // Verify CRON_SECRET
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  try {
    const maintenant = new Date();
    const switches = await db.deadMansSwitch.findMany({
      where: { estDeclenche: false },
    });

    const declenches: string[] = [];

    for (const dms of switches) {
      const delaiMs = dms.delaiJours * 24 * 60 * 60 * 1000;
      const derniereActivite = new Date(dms.derniereActivite);

      if (maintenant.getTime() - derniereActivite.getTime() > delaiMs) {
        await db.deadMansSwitch.update({
          where: { id: dms.id },
          data: {
            estDeclenche: true,
            dateDeclenchement: maintenant,
          },
        });

        console.log(
          `[DMS] Contenu déclenché: ${dms.contenuTitre} (${dms.contenuId})`,
        );
        declenches.push(dms.contenuId);
      }
    }

    return res.json({
      checked: switches.length,
      triggered: declenches.length,
      declenches,
      timestamp: maintenant.toISOString(),
    });
  } catch (error) {
    console.error("[DMS cron] error:", error);
    return res
      .status(500)
      .json({ error: "Erreur lors de la vérification" });
  }
});

export default router;
