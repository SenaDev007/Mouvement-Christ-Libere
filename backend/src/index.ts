/**
 * Mouvement Christ Libère — Backend API (Express)
 *
 * Standalone Node.js server replicating all the Next.js API routes.
 * Deployed on Railway. The Next.js frontend (Vercel) calls this via the
 * NEXT_PUBLIC_API_URL environment variable.
 *
 * Routes mounted under /api/* mirror the original Next.js paths.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";

import { authMiddleware } from "./lib/auth";
import authRoutes from "./routes/auth";
import yeshuaConnectRoutes from "./routes/yeshua-connect";
import pushRoutes from "./routes/push";
import matrixRoutes from "./routes/matrix";
import livekitRoutes from "./routes/livekit";
import transcribeRoutes from "./routes/transcribe";
import userRoutes from "./routes/user";
import calendrierRoutes from "./routes/calendrier";
import bibleRoutes from "./routes/bible";
import contactRoutes from "./routes/contact";
import homeRoutes from "./routes/home";
import intercessionRoutes from "./routes/intercession";
import dispersesRoutes from "./routes/disperses";
import cronRoutes from "./routes/cron";
import adminRoutes from "./routes/admin";
import arweaveRoutes from "./routes/arweave";
import calendrierBibliqueRoutes from "./routes/calendrier-biblique";
import bibleV2Routes from "./routes/bible-v2";
import soustitresRoutes from "./routes/soustitres";
import deadMansSwitchRoutes from "./routes/dead-mans-switch";
import liveRoutes from "./routes/live";
import videosRoutes from "./routes/videos";

const app = express();

// --- Trust proxy (needed for secure cookies behind Railway's reverse proxy) ---
app.set("trust proxy", 1);

// --- CORS ---
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      // In development, allow any localhost origin
      if (
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/localhost(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// --- Body parsers ---
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// --- Auth middleware (populates req.user from JWT cookie/header) ---
app.use(authMiddleware);

// --- Static files for uploads (yeshua-connect attachments) ---
const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public", "uploads"), {
    maxAge: "7d",
  }),
);

// --- Health check ---
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mouvement-christ-libere-backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// --- Root ---
app.get("/api", (_req, res) => {
  res.json({ message: "Mouvement Christ Libère — Backend API" });
});

// --- API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/yeshua-connect", yeshuaConnectRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/matrix", matrixRoutes);
app.use("/api/livekit", livekitRoutes);
app.use("/api/transcribe", transcribeRoutes);
app.use("/api/user", userRoutes);
app.use("/api/calendrier", calendrierRoutes);
app.use("/api/bible", bibleRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/intercession", intercessionRoutes);
app.use("/api/disperses", dispersesRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/arweave", arweaveRoutes);
app.use("/api/calendrier-biblique", calendrierBibliqueRoutes);
app.use("/api/bible-v2", bibleV2Routes);
app.use("/api/soustitres", soustitresRoutes);
app.use("/api/dead-mans-switch", deadMansSwitchRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/videos", videosRoutes);

// --- Warmup endpoint (garde Neon DB éveillée) ---
app.get("/api/warmup", async (_req, res) => {
  try {
    const { db } = await import("./lib/db");
    await db.user.count();
    res.json({ status: "warm", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: "error", error: "DB unreachable" });
  }
});

// --- Stats endpoint ---
app.get("/api/stats", async (_req, res) => {
  try {
    const { db } = await import("./lib/db");
    const [videos, testimonies, teachings, liveStreams] = await Promise.all([
      db.video.count(), db.testimony.count(), db.teaching.count(), db.liveStream.count(),
    ]);
    const totalViews = await db.video.aggregate({ _sum: { views: true } });
    res.json({ videos, testimonies, teachings, liveStreams, totalViews: totalViews._sum.views || 0 });
  } catch {
    res.json({ videos: 0, testimonies: 0, teachings: 0, liveStreams: 0, totalViews: 0 });
  }
});

// --- 404 handler for unknown API routes ---
app.use("/api", (req, res) => {
  res.status(404).json({
    error: `Route non trouvée: ${req.method} ${req.originalUrl}`,
  });
});

// --- Global error handler ---
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[express] Unhandled error:", err);
    const message =
      err instanceof Error ? err.message : "Erreur interne du serveur";
    res.status(500).json({ error: message });
  },
);

// --- Start server ---
import http from "http";
import { initSocketServer } from "./socket/yeshua-connect";

const PORT = parseInt(process.env.PORT || "3000", 10);
const httpServer = http.createServer(app);

// Initialize Socket.io for real-time messaging
initSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Socket.io: ws://localhost:${PORT}/yeshua-connect`);
  console.log(`   CORS origins: ${corsOrigins.join(", ")}`);
});

export default app;
