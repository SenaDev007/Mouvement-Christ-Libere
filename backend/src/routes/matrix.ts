/**
 * Matrix Synapse routes.
 *   POST /api/matrix/token — issue a Matrix access token for the current user
 */

import { Router } from "express";
import { db } from "../lib/db";
import {
  MATRIX_CONFIG,
  toMatrixUserId,
  toMatrixDisplayName,
  isMatrixConfigured,
} from "../lib/matrix/config";
import { requireAuth } from "../lib/auth";

const router = Router();

router.post("/token", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    if (!isMatrixConfigured()) {
      return res.status(503).json({
        error:
          "Matrix non configuré. Définissez MATRIX_HOMESERVER_URL et MATRIX_ADMIN_USER.",
      });
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const matrixUserId = toMatrixUserId(user.id);
    const displayName = toMatrixDisplayName(user.name, user.email);
    const username = matrixUserId.substring(1).split(":")[0];

    // Register (or ignore if already exists)
    try {
      await fetch(`${MATRIX_CONFIG.homeserverUrl}/_synapse/admin/v1/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAdminToken()}`,
        },
        body: JSON.stringify({
          username,
          displayname: displayName,
          password: generateRandomPassword(),
          admin: false,
        }),
      });
    } catch {
      // Ignore — user may already exist
    }

    // Login to get access token
    const loginRes = await fetch(
      `${MATRIX_CONFIG.homeserverUrl}/_matrix/client/v3/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "m.login.password",
          identifier: { type: "m.id.user", user: username },
          password: "temp",
        }),
      },
    );

    if (!loginRes.ok) {
      // Dev fallback
      return res.json({
        accessToken: `dev-token-${user.id}-${Date.now()}`,
        userId: matrixUserId,
        homeserverUrl: MATRIX_CONFIG.homeserverUrl,
        deviceId: "CHRIST_LIBERE_WEB",
        devMode: true,
      });
    }

    const loginData = (await loginRes.json()) as {
      access_token: string;
      user_id: string;
      device_id: string;
    };
    return res.json({
      accessToken: loginData.access_token,
      userId: loginData.user_id,
      homeserverUrl: MATRIX_CONFIG.homeserverUrl,
      deviceId: loginData.device_id,
    });
  } catch (error) {
    console.error("[matrix/token] Error:", error);
    return res.status(500).json({ error: "Erreur Matrix" });
  }
});

async function getAdminToken(): Promise<string> {
  const res = await fetch(
    `${MATRIX_CONFIG.homeserverUrl}/_matrix/client/v3/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "m.login.password",
        identifier: { type: "m.id.user", user: MATRIX_CONFIG.adminUser },
        password: MATRIX_CONFIG.adminPassword,
      }),
    },
  );

  if (!res.ok) {
    throw new Error("Failed to login as admin");
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function generateRandomPassword(): string {
  return `CL-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export default router;
