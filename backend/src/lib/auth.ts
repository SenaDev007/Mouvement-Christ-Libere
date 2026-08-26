/**
 * JWT-based authentication for the backend (replaces NextAuth v5).
 *
 * Flow:
 *   - POST /api/auth/login   → verifies email+password, returns JWT, sets httpOnly cookie
 *   - POST /api/auth/register → creates user, returns JWT, sets httpOnly cookie
 *   - POST /api/auth/logout  → clears the cookie
 *   - GET  /api/auth/session → returns the current user from the JWT
 *
 * The `authMiddleware` reads the cookie (or Authorization Bearer header) and
 * attaches `req.user = { id, email, role }` for protected routes.
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";

const JWT_SECRET =
  process.env.JWT_SECRET || "christ-libere-jwt-secret-change-in-prod-2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME || "auth_token";

export interface JwtUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

/**
 * Sign a JWT for an authenticated user.
 */
export function signToken(user: JwtUser): string {
  return jwt.sign(user, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Verify a JWT and return its payload (or null if invalid).
 */
export function verifyToken(token: string): JwtUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

/**
 * Set the auth cookie on the response.
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    path: "/",
  });
}

/**
 * Clear the auth cookie.
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
}

/**
 * Extract the JWT from the cookie or Authorization: Bearer <token> header.
 */
export function extractToken(req: Request): string | null {
  // 1. Cookie
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  // 2. Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

// Extend Express Request with a `user` field
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

/**
 * Express middleware: reads the JWT and populates `req.user`.
 * Does NOT block unauthenticated requests — use `requireAuth` for that.
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (token) {
    const user = verifyToken(token);
    if (user) req.user = user;
  }
  next();
}

/**
 * Express middleware: requires an authenticated user (401 if missing).
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  next();
}

/**
 * Verify an email + password against the DB and return the user (without hash).
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<JwtUser | null> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user || !user.passwordHash) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
