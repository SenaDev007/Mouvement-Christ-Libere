/**
 * ⭐ V3.23 — NOTIFICATIONS PUSH MOBILES (FCM HTTP v1 — SANS SDK firebase-admin).
 * ============================================================================
 *
 * Directive du pasteur (2026-09-02) : « les notifications push mobiles » —
 * l'app doit prévenir l'utilisateur même FERMÉE/en arrière-plan quand :
 *   1. quelqu'un l'appelle (privé) — notification HAUTE priorité ;
 *   2. il reçoit un message privé (DM) — notification standard.
 *
 * ARCHITECTURE (serverless-safe, zéro dépendance npm) :
 *   - Le token FCM de chaque appareil est enregistré via
 *     POST /api/yeshua-connect/devices (auth NextAuth obligatoire) ;
 *   - L'envoi utilise l'API HTTP v1 de Firebase Cloud Messaging avec un
 *     jeton OAuth2 signé RS256 (service account) — un simple fetch, PAS de
 *     firebase-admin (dont le SDK est lourd et parfois incompatible
 *     Vercel). Le jeton d'accès est mis en cache (globalThis) jusqu'à son
 *     expiration (1 h) ;
 *   - Les tokens invalides (404/410 — app désinstallée) sont désactivés
 *     automatiquement (plus jamais re-Contactés) ;
 *   - SANS les variables FCM_* → tout est silencieusement ignoré (jamais
 *     d'erreur, jamais de ralentissement) : la chaîne se dégrade proprement.
 *
 * Variables d'environnement (Vercel — projet Firebase du pasteur) :
 *   FCM_PROJECT_ID   — Project ID Firebase (console.firebase.google.com)
 *   FCM_CLIENT_EMAIL — Compte de service (IAM & Admin → Comptes de service
 *                      → …@…iam.gserviceaccount.com)
 *   FCM_PRIVATE_KEY  — Clé privée du compte de service (fichier .json
 *                      téléchargé, champ private_key — garder les \n)
 */
import { createSign } from "crypto";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════════════
//  Table des appareils
// ═══════════════════════════════════════════════════════════════════════

let pushTableEnsured = false;

/** Crée la table PushDevice si absente (idempotent). */
export async function ensurePushDeviceTable(): Promise<void> {
  if (pushTableEnsured) return;
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PushDevice" (
       "token"     TEXT PRIMARY KEY,
       "userId"    TEXT NOT NULL,
       "platform"  TEXT,
       "active"    BOOLEAN NOT NULL DEFAULT true,
       "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
       "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
     )`,
  );
  pushTableEnsured = true;
}

/** FCM est-il configuré ? (sinon : silencieux, aucune notification). */
export function fcmConfigured(): boolean {
  return !!(
    process.env.FCM_PROJECT_ID &&
    process.env.FCM_CLIENT_EMAIL &&
    process.env.FCM_PRIVATE_KEY
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Jeton d'accès OAuth2 (RS256 — cache 55 min)
// ═══════════════════════════════════════════════════════════════════════

interface CachedToken {
  token: string;
  expiresAt: number;
}
const g = globalThis as unknown as { __fcmAccessToken?: CachedToken };
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** Clé privée : Vercel stocke les \n en littéral « \\n » — on les répare. */
function privateKeyPem(): string {
  return (process.env.FCM_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken(): Promise<string> {
  const cached = g.__fcmAccessToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const clientEmail = process.env.FCM_CLIENT_EMAIL as string;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(privateKeyPem()).toString("base64url");
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM OAuth2: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  g.__fcmAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return data.access_token;
}

// ═══════════════════════════════════════════════════════════════════════
//  Envoi (best effort — ne JETTE jamais vers les appelants)
// ═══════════════════════════════════════════════════════════════════════

export interface PushPayload {
  title: string;
  body: string;
  /** Métadonnées (chaines uniquement — contrainte FCM). */
  data?: Record<string, string>;
  /** Appels entrants → HIGH + TTL court (une sonnerie ratée ne doit pas
   *  sonner 3 h plus tard) ; messages → priorité normale. */
  highPriority?: boolean;
  androidChannelId?: string;
}

/** Envoie une notification à TOUS les appareils actifs d'un utilisateur. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!fcmConfigured()) return;
    await ensurePushDeviceTable();

    const devices = await db.$queryRawUnsafe<Array<{ token: string }>>(
      `SELECT "token" FROM "PushDevice" WHERE "userId" = $1 AND "active" = true`,
      userId,
    );
    if (devices.length === 0) return;

    const accessToken = await getAccessToken();
    const projectId = process.env.FCM_PROJECT_ID as string;
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    await Promise.all(
      devices.map(async (d) => {
        try {
          const message: Record<string, unknown> = {
            token: d.token,
            notification: { title: payload.title, body: payload.body },
            ...(payload.data ? { data: payload.data } : {}),
            android: {
              ...(payload.highPriority ? { priority: "HIGH", ttl: "45s" } : {}),
              notification: {
                ...(payload.androidChannelId ? { channel_id: payload.androidChannelId } : {}),
              },
            },
            apns: {
              payload: {
                aps: {
                  ...(payload.highPriority
                    ? { "interruption-level": "time-sensitive" }
                    : {}),
                  sound: "default",
                },
              },
            },
          };
          const res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message }),
          });
          if (res.status === 404 || res.status === 410) {
            // Appareil désinstallé / token invalide → on le désactive.
            await db.$executeRawUnsafe(
              `UPDATE "PushDevice" SET "active" = false, "updatedAt" = now() WHERE "token" = $1`,
              d.token,
            ).catch(() => {});
          } else if (!res.ok) {
            const detail = await res.text().catch(() => "");
            console.warn(`[push] FCM ${res.status} pour un appareil: ${detail.slice(0, 200)}`);
          }
        } catch (e) {
          console.warn("[push] envoi appareil:", e instanceof Error ? e.message : e);
        }
      }),
    );
  } catch (e) {
    console.warn("[push] sendPushToUser (non bloquant):", e instanceof Error ? e.message : e);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Enregistrement des appareils (route /devices)
// ═══════════════════════════════════════════════════════════════════════

export async function registerDevice(
  token: string,
  userId: string,
  platform?: string,
): Promise<void> {
  await ensurePushDeviceTable();
  await db.$executeRawUnsafe(
    `INSERT INTO "PushDevice" ("token", "userId", "platform", "active", "updatedAt")
     VALUES ($1, $2, $3, true, now())
     ON CONFLICT ("token") DO UPDATE SET
       "userId" = $2, "platform" = $3, "active" = true, "updatedAt" = now()`,
    token,
    userId,
    platform ?? null,
  );
}

export async function unregisterDevice(token: string): Promise<void> {
  await ensurePushDeviceTable();
  await db.$executeRawUnsafe(
    `UPDATE "PushDevice" SET "active" = false, "updatedAt" = now() WHERE "token" = $1`,
    token,
  );
}
