import { NextResponse } from "next/server";
import webpush from "web-push";

/**
 * GET /api/push/vapid
 * Returns the public VAPID key for the client to subscribe to push notifications.
 */

// VAPID keys — generated once, stored in env.
// To generate: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "3KzvKfBmQWnQZQZ7pXJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8Q";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@christ-libere.com";

// Configure web-push once
if (!web-push.getVAPIDKeys()) {
  web-push.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY });
}

// Export configured web-push for reuse in other routes
export { webpush };
