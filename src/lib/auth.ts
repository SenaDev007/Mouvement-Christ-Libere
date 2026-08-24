/**
 * Authentification backoffice — Mouvement Christ Libère
 *
 * Approche simple et sécurisée pour la V1 :
 * - Cookie httpOnly "admin_session" contenant un token signé
 * - Token = base64({ user, exp }) + HMAC-SHA256
 * - Mot de passe comparé via hash SHA-256 (à remplacer par bcrypt en V2)
 * - Pas de DB user pour l'instant (admin unique défini par ADMIN_DEFAULT_PASSWORD)
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "christ-libere-session-secret-change-in-prod-2026";
const ADMIN_PASSWORD =
  process.env.ADMIN_DEFAULT_PASSWORD || "ChristLibere2026!";
const SESSION_DURATION = 1000 * 60 * 60 * 8; // 8 heures

interface SessionPayload {
  user: string;
  exp: number;
}

function base64Encode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function base64Decode<T>(str: string): T | null {
  try {
    return JSON.parse(Buffer.from(str, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

function sign(data: string): string {
  return createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

/**
 * Crée un token de session signé.
 */
export function createSessionToken(user = "admin"): string {
  const payload: SessionPayload = {
    user,
    exp: Date.now() + SESSION_DURATION,
  };
  const data = base64Encode(payload);
  const signature = sign(data);
  return `${data}.${signature}`;
}

/**
 * Vérifie un token de session. Retourne true si valide et non expiré.
 */
export function verifySessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [data, signature] = parts;
  const expectedSignature = sign(data);

  // Comparaison en temps constant pour éviter les timing attacks
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  const payload = base64Decode<SessionPayload>(data);
  if (!payload) return false;
  if (!payload.exp || payload.exp < Date.now()) return false;

  return true;
}

/**
 * Vérifie le mot de passe admin.
 */
export function verifyPassword(password: string): boolean {
  const providedHash = createHash("sha256").update(password).digest("hex");
  const expectedHash = createHash("sha256").update(ADMIN_PASSWORD).digest("hex");

  try {
    const a = Buffer.from(providedHash);
    const b = Buffer.from(expectedHash);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE = SESSION_DURATION / 1000; // en secondes
