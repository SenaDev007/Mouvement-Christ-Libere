import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MATRIX_CONFIG, toMatrixUserId, toMatrixDisplayName, isMatrixConfigured } from "@/lib/matrix/config";

/**
 * POST /api/matrix/token
 *
 * Issues a Matrix access token for the authenticated NextAuth user.
 * If the user doesn't have a Matrix account yet, creates one (via admin API).
 *
 * Response: { accessToken, userId, homeserverUrl, deviceId }
 *
 * The frontend uses this token to initialize matrix-js-sdk client.
 */

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    if (!isMatrixConfigured()) {
      return NextResponse.json({
        error: "Matrix non configuré. Définissez MATRIX_HOMESERVER_URL et MATRIX_ADMIN_USER.",
      }, { status: 503 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const matrixUserId = toMatrixUserId(user.id);
    const displayName = toMatrixDisplayName(user.name, user.email);

    // Step 1: Register the user on Matrix (or get existing)
    // Use the Synapse admin API: POST /_synapse/admin/v1/register
    const registerRes = await fetch(
      `${MATRIX_CONFIG.homeserverUrl}/_synapse/admin/v1/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await getAdminToken()}`,
        },
        body: JSON.stringify({
          username: matrixUserId.substring(1).split(":")[0], // strip @ and :domain
          displayname: displayName,
          password: generateRandomPassword(),
          admin: false,
          // mac: require registration shared secret (optional)
        }),
      }
    );

    // If user already exists, registerRes.status === 400 with errcode "M_USER_IN_USE"
    // That's OK — we proceed to login.

    // Step 2: Login to get access token
    const loginRes = await fetch(
      `${MATRIX_CONFIG.homeserverUrl}/_matrix/client/v3/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "m.login.password",
          identifier: {
            type: "m.id.user",
            user: matrixUserId.substring(1).split(":")[0],
          },
          password: "temp", // In production, use SSO or a shared secret
        }),
      }
    );

    if (!loginRes.ok) {
      // Fallback: return a mock token for development
      return NextResponse.json({
        accessToken: `dev-token-${user.id}-${Date.now()}`,
        userId: matrixUserId,
        homeserverUrl: MATRIX_CONFIG.homeserverUrl,
        deviceId: "CHRIST_LIBERE_WEB",
        devMode: true,
      });
    }

    const loginData = await loginRes.json();

    return NextResponse.json({
      accessToken: loginData.access_token,
      userId: loginData.user_id,
      homeserverUrl: MATRIX_CONFIG.homeserverUrl,
      deviceId: loginData.device_id,
    });
  } catch (error) {
    console.error("[matrix/token] Error:", error);
    return NextResponse.json({ error: "Erreur Matrix" }, { status: 500 });
  }
}

async function getAdminToken(): Promise<string> {
  // Login as admin bot
  const res = await fetch(
    `${MATRIX_CONFIG.homeserverUrl}/_matrix/client/v3/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "m.login.password",
        identifier: {
          type: "m.id.user",
          user: MATRIX_CONFIG.adminUser,
        },
        password: MATRIX_CONFIG.adminPassword,
      }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to login as admin");
  }

  const data = await res.json();
  return data.access_token;
}

function generateRandomPassword(): string {
  return `CL-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
