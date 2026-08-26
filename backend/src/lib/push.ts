import webpush from "web-push";

/**
 * Web Push (VAPID) configuration — shared by /api/push/* and /api/cron/*.
 */

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "3KzvKfBmQWnQZQZ7pXJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8Q";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:contact@christ-libere.com";

let configured = false;
let configurationError: string | null = null;

export function ensureVapidConfigured(): void {
  if (configured) return;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
    configurationError = null;
  } catch (e: any) {
    configurationError =
      e?.message ||
      "Configuration VAPID invalide — vérifiez VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY.";
    console.warn("[push] VAPID configuration warning:", configurationError);
    configured = true; // Don't retry; mark as attempted
  }
}

export function isVapidConfigured(): boolean {
  return configurationError === null;
}

export function getVapidConfigurationError(): string | null {
  return configurationError;
}

export { webpush };
export { VAPID_PUBLIC_KEY };
