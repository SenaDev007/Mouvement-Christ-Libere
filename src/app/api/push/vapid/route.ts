import { NextResponse } from "next/server";
import webpush from "web-push";

/**
 * GET /api/push/vapid
 * Returns the public VAPID key for the client to subscribe to push notifications.
 *
 * ⭐ The web-push library is configured LAZILY (only when needed) to avoid
 *    crashing the build if VAPID keys are not set or invalid.
 *    setVapidDetails() throws if the key is not 65 bytes long.
 */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@christ-libere.com";

let vapidConfigured = false;

/**
 * Configure web-push with VAPID keys. Called lazily before first use.
 * Returns true if configuration succeeded, false if keys are missing/invalid.
 */
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return false;
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
    return true;
  } catch (e) {
    console.error("[VAPID] Configuration failed:", e);
    return false;
  }
}

export async function GET() {
  return NextResponse.json({
    publicKey: VAPID_PUBLIC_KEY,
    configured: !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY,
  });
}

/**
 * Send a push notification. Returns true on success, false on failure.
 * Lazily configures VAPID on first call.
 */
export async function sendPushNotification(
  subscription: any,
  payload: string
): Promise<boolean> {
  if (!ensureVapidConfigured()) {
    console.warn("[VAPID] Not configured — skipping push notification");
    return false;
  }
  try {
    await webpush.sendNotification(subscription, payload);
    return true;
  } catch (e: any) {
    console.error("[VAPID] sendNotification failed:", e?.statusCode, e?.message);
    throw e; // re-throw so caller can handle 410/404 (expired subscription)
  }
}

// Export the raw webpush for callers that need it directly
export { webpush };
