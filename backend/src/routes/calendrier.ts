/**
 * Calendrier routes — Shabbat + reminders.
 *   GET  /api/calendrier/rappels
 *   PUT  /api/calendrier/rappels
 *   GET  /api/calendrier/shabbat
 *   POST /api/calendrier/shabbat
 */

import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/rappels", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: {
        notifAnnouncements: true,
        notifLive: true,
        dndEnabled: true,
        dndUntil: true,
        pushEnabled: true,
        pushSubscription: true,
      },
    });

    return res.json({
      enabled: user?.notifAnnouncements ?? false,
      pushEnabled: user?.pushEnabled ?? false,
      hasSubscription: !!user?.pushSubscription,
      dndEnabled: user?.dndEnabled ?? false,
      dndUntil: user?.dndUntil?.toISOString(),
    });
  } catch (error) {
    console.error("[calendrier/rappels GET] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.put("/rappels", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const { enabled } = req.body || {};

    await db.user.update({
      where: { id: req.user.id },
      data: { notifAnnouncements: enabled },
    });

    return res.json({ success: true, enabled });
  } catch (error) {
    console.error("[calendrier/rappels PUT] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.get("/shabbat", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: { dndEnabled: true, dndUntil: true },
    });

    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const isShabbatWindow =
      (day === 5 && hour >= 18) || (day === 6 && hour < 18);

    const dndActive =
      user?.dndEnabled &&
      (!user?.dndUntil || new Date(user.dndUntil) > now);

    return res.json({
      isShabbatWindow,
      dndActive: !!dndActive,
      dndUntil: user?.dndUntil?.toISOString(),
      shabbatModeActive: isShabbatWindow || !!dndActive,
    });
  } catch (error) {
    console.error("[calendrier/shabbat GET] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.post("/shabbat", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const { enable } = req.body || {};
    const now = new Date();

    if (enable) {
      const dndUntil = new Date(now);
      const day = now.getDay();
      if (day === 5) {
        dndUntil.setDate(dndUntil.getDate() + 1);
        dndUntil.setHours(18, 0, 0, 0);
      } else if (day === 6) {
        dndUntil.setHours(18, 0, 0, 0);
      } else {
        dndUntil.setDate(dndUntil.getDate() + 1);
      }

      await db.user.update({
        where: { id: req.user.id },
        data: { dndEnabled: true, dndUntil },
      });
    } else {
      await db.user.update({
        where: { id: req.user.id },
        data: { dndEnabled: false, dndUntil: null },
      });
    }

    return res.json({ success: true, enabled: enable });
  } catch (error) {
    console.error("[calendrier/shabbat POST] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

export default router;
