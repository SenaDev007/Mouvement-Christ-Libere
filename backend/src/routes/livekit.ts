/**
 * LiveKit routes.
 *   POST /api/livekit/token — issue a LiveKit access token
 */

import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";

const router = Router();

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

router.post("/token", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const { roomName, isUrgent = false } = req.body || {};
    if (!roomName) {
      return res.status(400).json({ error: "roomName requis" });
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, dndEnabled: true, dndUntil: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    if (!isUrgent && user.dndEnabled) {
      const now = new Date();
      if (!user.dndUntil || new Date(user.dndUntil) > now) {
        return res.status(403).json({
          error: "Le destinataire est en mode Ne pas déranger",
          dndActive: true,
        });
      }
    }

    const participantName = user.name || req.user.email || "Membre";
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user.id,
      name: participantName,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    const livekitUrl =
      process.env.LIVEKIT_URL || "wss://christ-libere.livekit.cloud";

    await db.call.create({
      data: {
        initiatorId: user.id,
        recipientId: user.id,
        type: "AUDIO",
        status: "MISSED",
      },
    });

    return res.json({ token, url: livekitUrl, roomName });
  } catch (error) {
    console.error("[livekit/token] Error:", error);
    return res.status(500).json({ error: "Erreur LiveKit" });
  }
});

export default router;
