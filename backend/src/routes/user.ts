/**
 * User routes.
 *   GET /api/user/profile
 *   PUT /api/user/profile
 */

import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/profile", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        country: true,
        city: true,
        avatarUrl: true,
        role: true,
        notifMessages: true,
        notifAnnouncements: true,
        notifLive: true,
        notifCommunity: true,
        dndEnabled: true,
        dndUntil: true,
        pushEnabled: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    return res.json(user);
  } catch (error) {
    console.error("[user/profile GET] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.put("/profile", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const {
      name,
      bio,
      country,
      city,
      notifMessages,
      notifAnnouncements,
      notifLive,
      notifCommunity,
      dndEnabled,
    } = req.body || {};

    const updated = await db.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(country !== undefined && { country }),
        ...(city !== undefined && { city }),
        ...(notifMessages !== undefined && { notifMessages }),
        ...(notifAnnouncements !== undefined && { notifAnnouncements }),
        ...(notifLive !== undefined && { notifLive }),
        ...(notifCommunity !== undefined && { notifCommunity }),
        ...(dndEnabled !== undefined && {
          dndEnabled,
          dndUntil: dndEnabled
            ? new Date(Date.now() + 8 * 60 * 60 * 1000)
            : null,
        }),
      },
    });

    return res.json({ success: true, user: { id: updated.id } });
  } catch (error) {
    console.error("[user/profile PUT] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

export default router;
