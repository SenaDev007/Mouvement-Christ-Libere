/**
 * lib/youtube-oauth.ts — Flux OAuth 2.0 "in-app" pour YouTube.
 *
 * Permet de générer le YOUTUBE_REFRESH_TOKEN directement depuis le site
 * (production Vercel OU développement local), sans script Node local.
 *
 * Routes qui utilisent ce module :
 *   GET  /api/youtube/oauth/start    → 302 vers Google (credentials = env vars)
 *   POST /api/youtube/oauth/start    → JSON { authUrl } (credentials collés)
 *   GET  /api/youtube/oauth/callback → échange code → refresh token
 *
 * Sécurité :
 *   - Les credentials (client id / secret) transitent chiffrés AES-256-GCM
 *     dans un cookie httpOnly `yt_oauth_state` — jamais exposés au navigateur
 *     ni dans les URLs (contrairement au paramètre `state` classique).
 *   - Le `state` envoyé à Google est un nonce aléatoire, revérifié au
 *     callback contre le cookie → protection anti-CSRF.
 *   - Cookie à durée courte (10 min), usage unique, portée limitée au chemin
 *     /api/youtube/oauth.
 *
 * Le cookie est compatible serverless Vercel : il vit côté navigateur et
 * accompagne la redirection Google → callback (SameSite=Lax, comme NextAuth).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { google } from "googleapis";

// ─── Constantes ──────────────────────────────────────────────────────────

/** Nom du cookie d'état (httpOnly, chiffré). */
export const YOUTUBE_OAUTH_COOKIE = "yt_oauth_state";

/** Portée du cookie : uniquement les routes OAuth. */
export const YOUTUBE_OAUTH_COOKIE_PATH = "/api/youtube/oauth";

/** Durée de validité du flux OAuth (10 minutes), en secondes. */
export const YOUTUBE_OAUTH_TTL_S = 600;

/** Mêmes scopes que scripts/youtube-oauth-setup.js (cohérence Tier B + C). */
export const YOUTUBE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
];

// ─── Payload du cookie d'état ────────────────────────────────────────────

export interface YouTubeOAuthState {
  clientId: string;
  clientSecret: string;
  /** redirect_uri exact utilisé au consentement (rejoué au token exchange). */
  redirectUri: string;
  /** nonce anti-CSRF — identique au paramètre `state` envoyé à Google. */
  nonce: string;
  /** expiration epoch ms. */
  exp: number;
}

// ─── Chiffrement AES-256-GCM ─────────────────────────────────────────────

/**
 * Clé dérivée du SESSION_SECRET (suffixe distinct → clé différente de celle
 * utilisée pour signer les sessions admin).
 */
function deriveKey(): Buffer {
  const secret =
    process.env.SESSION_SECRET || "christ-libere-session-secret-change-in-prod-2026";
  return createHash("sha256").update(`${secret}:yt-oauth`).digest();
}

/** Chiffre l'état OAuth → valeur opaque prête pour un cookie httpOnly. */
export function encryptState(state: YouTubeOAuthState): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(state), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag]
    .map((b) => b.toString("base64url"))
    .join(".");
}

/**
 * Déchiffre + valide le cookie d'état.
 * Retourne null si : cookie corrompu/falsifié (GCM), expiré, ou champs absents.
 */
export function decryptState(value: string): YouTubeOAuthState | null {
  try {
    const parts = value.split(".");
    if (parts.length !== 3) return null;
    const [ivB64, ctB64, tagB64] = parts;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(),
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final(),
    ]);
    const state = JSON.parse(plaintext.toString("utf8")) as YouTubeOAuthState;
    if (!state.exp || state.exp < Date.now()) return null;
    if (!state.clientId || !state.clientSecret || !state.redirectUri || !state.nonce) {
      return null;
    }
    return state;
  } catch {
    // Tag GCM invalide (cookie falsifié) ou JSON corrompu
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Nonce anti-CSRF (256 bits). */
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Validation souple du Client ID (détecte les erreurs de copier-coller
 * classiques : secret collé dans le champ ID, ID tronqué…).
 */
export function isValidClientId(id: string): boolean {
  const cleaned = id.trim();
  return cleaned.includes("apps.googleusercontent.com") && !cleaned.includes(" ");
}

/** Validation souple du Client Secret (les GOCSPX-… font ~35 caractères). */
export function isValidClientSecret(secret: string): boolean {
  const cleaned = secret.trim();
  return cleaned.length >= 20 && !cleaned.includes(" ");
}

/**
 * Construit l'URL de consentement Google — exactement les mêmes paramètres
 * que scripts/youtube-oauth-setup.js (access_type=offline + prompt=consent
 * → un refresh token est systématiquement délivré).
 *
 * NB : le client secret N'APPARAÎT PAS dans l'URL (il n'est utilisé que
 * côté serveur lors de l'échange du code).
 */
export function buildConsentUrl(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  nonce: string
): string {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: YOUTUBE_OAUTH_SCOPES,
    prompt: "consent",
    state: nonce,
  });
}
