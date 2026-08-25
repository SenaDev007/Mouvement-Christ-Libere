/**
 * Public contact form route.
 *   POST /api/contact — submit a contact request (no auth required)
 */

import { Router } from "express";
import { db } from "../lib/db";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { name, contact, message } = req.body || {};

    if (!name || !contact || !message) {
      return res
        .status(400)
        .json({ error: "Tous les champs sont requis" });
    }

    if (name.length < 2 || name.length > 100) {
      return res
        .status(400)
        .json({ error: "Le nom doit contenir entre 2 et 100 caractères" });
    }

    if (message.length < 10 || message.length > 5000) {
      return res
        .status(400)
        .json({ error: "Le message doit contenir entre 10 et 5000 caractères" });
    }

    // Basic rate limiting (global — 10 requests/hour)
    const recentRequests = await db.contactRequest.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentRequests >= 10) {
      return res
        .status(429)
        .json({ error: "Trop de demandes. Réessayez plus tard." });
    }

    const created = await db.contactRequest.create({
      data: {
        name: name.trim(),
        contact: contact.trim(),
        message: message.trim(),
        status: "PENDING",
      },
    });

    return res.status(201).json({ success: true, id: created.id });
  } catch (error) {
    console.error("[api/contact] POST error:", error);
    return res
      .status(500)
      .json({ error: "Erreur lors de l'envoi du message" });
  }
});

export default router;
