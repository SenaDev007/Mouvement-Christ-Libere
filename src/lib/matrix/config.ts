/**
 * Matrix Synapse client configuration — Christ Libère V2.2
 *
 * Architecture:
 *   [Next.js frontend] ←→ [API routes] ←→ [Matrix Synapse server] ←→ [PostgreSQL]
 *
 * The Matrix server handles:
 *   - Real-time messaging (WebSocket /sync long-poll)
 *   - E2E encryption (Olm/Megolm — same as Signal)
 *   - User identity + presence
 *   - Room (channel) management
 *
 * NextAuth users are synced to Matrix via the /api/matrix/token route,
 * which issues a Matrix access token using the user's NextAuth session.
 *
 * Env vars required:
 *   MATRIX_HOMESERVER_URL  — e.g. https://matrix.christ-libere.com
 *   MATRIX_ADMIN_USER      — admin bot for user provisioning
 *   MATRIX_ADMIN_PASSWORD  — admin bot password
 *   MATRIX_SHARED_SECRET   — for SSO token generation (optional)
 */

export const MATRIX_CONFIG = {
  // Matrix homeserver URL (Synapse server)
  homeserverUrl: process.env.MATRIX_HOMESERVER_URL || "http://localhost:8008",

  // Matrix homeserver domain (e.g. christ-libere.com)
  domain: process.env.MATRIX_DOMAIN || "localhost",

  // Admin bot credentials (for user provisioning + moderation)
  adminUser: process.env.MATRIX_ADMIN_USER || "@admin:localhost",
  adminPassword: process.env.MATRIX_ADMIN_PASSWORD || "",

  // Shared secret for registration tokens (synapse-style)
  registrationSharedSecret: process.env.MATRIX_REGISTRATION_SHARED_SECRET || "",
};

/**
 * Generate a Matrix user ID from a NextAuth user ID.
 * Matrix user IDs: @user_id:domain
 * We use the Prisma cuid truncated to 20 chars (Matrix limit).
 */
export function toMatrixUserId(userId: string): string {
  const truncated = userId.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 20);
  return `@${truncated}:${MATRIX_CONFIG.domain}`;
}

/**
 * Generate a Matrix display name from a user's name.
 */
export function toMatrixDisplayName(name: string | null | undefined, email: string): string {
  if (name) return name;
  return email.split("@")[0];
}

/**
 * Check if Matrix is configured (env vars present).
 */
export function isMatrixConfigured(): boolean {
  return !!process.env.MATRIX_HOMESERVER_URL && !!process.env.MATRIX_ADMIN_USER;
}
