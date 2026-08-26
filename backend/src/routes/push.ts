/**
 * Web Push routes.
 *   GET    /api/push/vapid        — returns public VAPID key
 *   POST   /api/push/subscribe    — save user push subscription
 *   DELETE /api/push/subscribe     — remove user push subscription
 *   POST   /api/push/send         — send notification to user(s)
 */

import { Router } from "express";
import { db } from "../lib/db";
import {
  webpush,
  ensureVapidConfigured,
  VAPID_PUBLIC_KEY,
  isVapidConfigured,
} from "../lib/push";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/vapid", (_req, res) => {
  ensureVapidConfigured();
  // Always return the configured public key (even if invalid) so the client
  // can display a useful error if push notifications are misconfigured.
  return res.json({
    publicKey: VAPID_PUBLIC_KEY,
    configured: isVapidConfigured(),
  });
});

router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    const { subscription } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Subscription invalide" });
    }

    await db.user.update({
      where: { id: req.user.id },
      data: {
        pushSubscription: JSON.stringify(subscription),
        pushEnabled: true,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("[push/subscribe] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.delete("/subscribe", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    await db.user.update({
      where: { id: req.user.id },
      data: { pushSubscription: null, pushEnabled: false },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("[push/subscribe DELETE] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

type NotificationType = "messages" | "announcements" | "live" | "community";

interface SendPayload {
  userId?: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

router.post("/send", async (req, res) => {
  try {
    const { userId, type, title, body, url, icon } =
      (req.body || {}) as SendPayload;

    if (!title || !body) {
      return res.status(400).json({ error: "title et body requis" });
    }

    const where: any = {
      pushEnabled: true,
      pushSubscription: { not: null },
      OR: [
        { dndEnabled: false },
        { dndEnabled: true, dndUntil: { lt: new Date() } },
      ],
    };

    switch (type) {
      case "messages":
        where.notifMessages = true;
        break;
      case "announcements":
        where.notifAnnouncements = true;
        break;
      case "live":
        where.notifLive = true;
        break;
      case "community":
        where.notifCommunity = true;
        break;
    }

    if (userId) where.id = userId;

    const users = await db.user.findMany({
      where,
      select: { id: true, pushSubscription: true },
    });

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/yeshua-connect",
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: type,
    });

    ensureVapidConfigured();

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      if (!user.pushSubscription) continue;
      try {
        const subscription = JSON.parse(user.pushSubscription);
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (error: any) {
        if (error?.statusCode === 410 || error?.statusCode === 404) {
          await db.user.update({
            where: { id: user.id },
            data: { pushSubscription: null },
          });
        }
        failed++;
      }
    }

    return res.json({ success: true, sent, failed, total: users.length });
  } catch (error) {
    console.error("[push/send] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

export default router;
