/**
 * Admin backoffice routes — generic CRUD.
 *
 *   POST   /api/admin/login              — admin login (password only)
 *   POST   /api/admin/logout             — admin logout
 *
 *   GET    /api/admin/:entity            — list (paginated)
 *   POST   /api/admin/:entity            — create
 *   GET    /api/admin/:entity/:id        — detail
 *   PATCH  /api/admin/:entity/:id        — update
 *   DELETE /api/admin/:entity/:id        — delete
 *
 * `:entity` is one of: servants, biographies, testimonies, teachings,
 * videos, lives, channels, users, contactrequests, donations, communities,
 * calendar.
 *
 * Admin auth uses the `admin_session` cookie (HMAC-signed token).
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../lib/db";
import {
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "../lib/admin-auth";

const router = Router();

const ENTITY_MAP = {
  servants: "servant",
  biographies: "biography",
  testimonies: "testimony",
  teachings: "teaching",
  videos: "video",
  lives: "liveStream",
  channels: "channel",
  users: "user",
  contactrequests: "contactRequest",
  donations: "donation",
  communities: "community",
  calendar: "liturgicalEvent",
} as const;

type EntityName = keyof typeof ENTITY_MAP;

function getDelegate(entity: EntityName) {
  const modelName = ENTITY_MAP[entity];
  return (db as unknown as Record<string, typeof db.servant>)[modelName];
}

function isValidEntity(entity: string): entity is EntityName {
  return entity in ENTITY_MAP;
}

/**
 * Middleware: require admin session cookie.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token || !verifySessionToken(token)) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  next();
}

// ============================================================
// ADMIN LOGIN / LOGOUT
// ============================================================

router.post("/login", (req, res) => {
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

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  return res.json({ success: true });
});

// ============================================================
// CRUD ROUTES — protected by admin cookie
// ============================================================

router.get("/:entity", requireAdmin, async (req, res) => {
  const entity = String(req.params.entity);
  if (!isValidEntity(entity)) {
    return res.status(404).json({ error: "Entité inconnue" });
  }

  try {
    const limit = parseInt((req.query.limit as string) || "50");
    const offset = parseInt((req.query.offset as string) || "0");

    const delegate = getDelegate(entity);
    const [items, total] = await Promise.all([
      delegate.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" } as any,
      }),
      delegate.count(),
    ]);

    return res.json({ items, total });
  } catch (error) {
    console.error(`[admin/api/${entity}] GET error:`, error);
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.post("/:entity", requireAdmin, async (req, res) => {
  const entity = String(req.params.entity);
  if (!isValidEntity(entity)) {
    return res.status(404).json({ error: "Entité inconnue" });
  }

  try {
    const delegate = getDelegate(entity);
    const created = await delegate.create({ data: req.body || {} });
    return res.status(201).json({ item: created });
  } catch (error) {
    console.error(`[admin/api/${entity}] POST error:`, error);
    return res.status(500).json({ error: "Erreur lors de la création" });
  }
});

router.get("/:entity/:id", requireAdmin, async (req, res) => {
  const entity = String(req.params.entity);
  const id = String(req.params.id);
  if (!isValidEntity(entity)) {
    return res.status(404).json({ error: "Entité inconnue" });
  }

  try {
    const delegate = getDelegate(entity);
    const item = await delegate.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: "Introuvable" });
    }
    return res.json({ item });
  } catch (error) {
    console.error(`[admin/api/${entity}/${id}] GET error:`, error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.patch("/:entity/:id", requireAdmin, async (req, res) => {
  const entity = String(req.params.entity);
  const id = String(req.params.id);
  if (!isValidEntity(entity)) {
    return res.status(404).json({ error: "Entité inconnue" });
  }

  try {
    const delegate = getDelegate(entity);
    const updated = await delegate.update({
      where: { id },
      data: req.body || {},
    });
    return res.json({ item: updated });
  } catch (error) {
    console.error(`[admin/api/${entity}/${id}] PATCH error:`, error);
    return res.status(500).json({ error: "Erreur lors de la modification" });
  }
});

router.delete("/:entity/:id", requireAdmin, async (req, res) => {
  const entity = String(req.params.entity);
  const id = String(req.params.id);
  if (!isValidEntity(entity)) {
    return res.status(404).json({ error: "Entité inconnue" });
  }

  try {
    const delegate = getDelegate(entity);
    await delegate.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error(`[admin/api/${entity}/${id}] DELETE error:`, error);
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

export default router;
