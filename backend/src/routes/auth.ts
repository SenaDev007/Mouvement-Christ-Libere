/**
 * Auth routes — JWT-based replacement for NextAuth v5.
 *   POST   /api/auth/register   — create user, return JWT
 *   POST   /api/auth/login      — verify credentials, return JWT
 *   POST   /api/auth/logout     — clear cookie
 *   GET    /api/auth/session    — return current user
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  type JwtUser,
} from "../lib/auth";
import {
  createSessionToken,
  verifyPassword,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "../lib/admin-auth";

const router = Router();

/**
 * POST /api/auth/register
 * Body: { name, email, password, isMinor }
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, isMinor } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email et mot de passe requis" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Le mot de passe doit faire au moins 8 caractères" });
    }

    if (isMinor) {
      return res
        .status(403)
        .json({ error: "Vous devez être majeur pour créer un compte" });
    }

    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "Un compte existe déjà avec cet email" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "MEMBER",
        isMinor: false,
        acceptedTerms: new Date(),
      },
    });

    const jwtUser: JwtUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const token = signToken(jwtUser);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      userId: user.id,
      email: user.email,
      token,
    });
  } catch (error) {
    console.error("[auth/register] Error:", error);
    return res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email et mot de passe requis" });
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const jwtUser: JwtUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const token = signToken(jwtUser);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      user: jwtUser,
      token,
    });
  } catch (error) {
    console.error("[auth/login] Error:", error);
    return res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  return res.json({ success: true });
});

/**
 * GET /api/auth/session
 * Returns the current authenticated user (from JWT).
 */
router.get("/session", requireAuth, (req, res) => {
  return res.json({
    user: req.user,
    expires: null,
  });
});

/**
 * POST /api/auth/admin-login
 * Body: { password }
 * Sets the admin_session cookie (backoffice).
 */
router.post("/admin-login", (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Mot de passe requis" });
    }
    if (!verifyPassword(password)) {
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }

    const token = createSessionToken("admin");
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

/**
 * POST /api/auth/admin-logout
 */
router.post("/admin-logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  return res.json({ success: true });
});

/**
 * Compatibility endpoints for NextAuth v5 clients:
 *   GET  /api/auth/csrf
 *   GET  /api/auth/providers
 *
 * The Next.js frontend may still call these — return safe stubs so the
 * `useSession()` hook doesn't crash during the migration window.
 */
router.get("/csrf", (_req, res) => {
  return res.json({ csrfToken: "backend-csrf-stub" });
});

router.get("/providers", (_req, res) => {
  return res.json({
    credentials: {
      id: "credentials",
      name: "Credentials",
      type: "credentials",
      signinUrl: "/api/auth/login",
      callbackUrl: "/api/auth/callback/credentials",
    },
  });
});

export default router;
