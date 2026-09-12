/**
 * Mouvement Christ Libère — Backend API (Express)
 *
 * Standalone Node.js server replicating all the Next.js API routes.
 * Deployed on Railway. The Next.js frontend (Vercel) calls this via the
 * NEXT_PUBLIC_API_URL environment variable.
 *
 * ⭐ V3.70 — Domaine officiel du backend : https://api.mouvementchristlibere.com
 * (custom domain Railway). Utilisé par :
 *   - Socket.io Yeshua Connect (NEXT_PUBLIC_API_URL côté Vercel) ;
 *   - le RELAIS EMAIL (POST /api/email/send) : quand RESEND_API_KEY est
 *     absente de Vercel, la plateforme relaie ses envois ICI (la clé vit
 *     sur Railway) — voir backend/src/routes/email.ts.
 *
 * ⭐ V3.72 — Démarrage BLINDÉ (panne « 502 Application failed to respond ») :
 *   · écoute multi-ports : $PORT injecté par Railway + 3001 (ancien EXPOSE
 *     Dockerfile / ancien épinglage) + 3000 (défaut) — quel que soit le port
 *     que le proxy Railway route, l'app répond ;
 *   · gardes anti-crash : uncaughtException / unhandledRejection loggés,
 *     le process SURVIT (plus jamais de service mort en silence après un
 *     déploiement « Success ») ;
 *   · /api/health enrichi (ports écoutés, uptime, RSS, env) + heartbeat
 *     toutes les 5 min dans les logs Railway.
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
import emailRoutes from "./routes/email";

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
// ⭐ V3.72 : enrichi — ports réellement écoutés + mémoire + env (booléens,
// JAMAIS de valeurs de secrets) pour diagnostiquer en un seul curl.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mouvement-christ-libere-backend",
    version: "V3.72",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ports: portsEcoutes,
    node: process.version,
    rssMo: Math.round(process.memoryUsage().rss / 1048576),
    env: {
      port: process.env.PORT || null,
      resend: Boolean(process.env.RESEND_API_KEY),
      database: Boolean(process.env.DATABASE_URL),
      jwt: Boolean(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET),
      cors: process.env.CORS_ORIGIN || null,
    },
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
app.use("/api/email", emailRoutes);

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

// --- Start server (⭐ V3.72 — démarrage blindé multi-ports) ---
import http from "http";
import { initSocketServer } from "./socket/yeshua-connect";

// Ports candidats dédupliqués : PORT injecté par Railway en priorité, puis
// 3001 (EXPOSE historique du Dockerfile / épinglage dashboard éventuellement
// persistant) et 3000 (défaut applicatif). On écoute sur TOUS — le binding
// est gratuit et rend le routage Railway correct QUEL QUE SOIT le port sondé.
const PORT_INJECTE = parseInt(process.env.PORT || "3000", 10);
const PORTS_CANDIDATS = Array.from(
  new Set([PORT_INJECTE, 3001, 3000])
).filter((p) => Number.isInteger(p) && p > 0);

const portsEcoutes: number[] = [];
const httpServer = http.createServer(app);

// Socket.io attaché au serveur principal (l'instance est retournée pour
// pouvoir l'attacher aussi aux serveurs secondaires ci-dessous).
const io = initSocketServer(httpServer);

// Gardes anti-crash — un process qui meurt en silence est la panne la plus
// coûteuse possible (service 502 + aucun log). On logge et on SURVIT.
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException (process conservé vivant) :", err);
});
process.on("unhandledRejection", (raison) => {
  console.error("[process] unhandledRejection (process conservé vivant) :", raison);
});

function ecouter(srv: http.Server, port: number, principal: boolean) {
  return new Promise<void>((resoudre) => {
    srv.once("error", (err: NodeJS.ErrnoException) => {
      console.error(
        `[boot] ✗ port ${port} NON écouté (${err.code || err.message})` +
          (principal ? " — PORT INJECTÉ PAR RAILWAY, ÉCHEC CRITIQUE" : " — port secondaire, on continue")
      );
      resoudre();
    });
    srv.listen(port, () => {
      portsEcoutes.push(port);
      console.log(
        `[boot] ✓ écoute active sur ${principal ? "0.0.0.0:" + port + " (PORT Railway injecté)" : "0.0.0.0:" + port + " (port candidat additionnel)"}`
      );
      resoudre();
    });
  });
}

// Serveurs secondaires : même app Express, socket.io attaché en plus.
const serveursSecondaires = PORTS_CANDIDATS.filter((p) => p !== PORT_INJECTE).map(
  (port) => {
    const srv = http.createServer(app);
    try {
      io?.attach(srv);
    } catch (e) {
      console.error(`[boot] socket.io non attaché au port secondaire ${port} :`, e);
    }
    return { srv, port };
  }
);

Promise.all([
  ecouter(httpServer, PORT_INJECTE, true),
  ...serveursSecondaires.map(({ srv, port }) => ecouter(srv, port, false)),
]).then(() => {
  if (portsEcoutes.length === 0) {
    console.error(
      "[boot] ✗✗✗ AUCUN port écouté — arrêt (le dashboard Railway montrera un crash explicite plutôt qu'un 502 muet)"
    );
    process.exit(1);
  }
  console.log("──────────────────────────────────────────────────");
  console.log(
    `🚀 Backend V3.72 EN LIGNE — ports écoutés : ${portsEcoutes.join(", ")}`
  );
  console.log(`   PORT env injecté : ${process.env.PORT || "(absent)"}`);
  console.log(`   Health : http://localhost:${portsEcoutes[0]}/api/health`);
  console.log(`   Socket.io : ws://localhost:${portsEcoutes[0]}/yeshua-connect`);
  console.log(`   CORS origins : ${corsOrigins.join(", ") || "(aucune)"}`);
  console.log(
    `   env : RESEND_API_KEY=${process.env.RESEND_API_KEY ? "oui" : "non"} · DATABASE_URL=${process.env.DATABASE_URL ? "oui" : "non"}`
  );
  console.log("──────────────────────────────────────────────────");
});

// Heartbeat — preuve de vie toutes les 5 min dans les logs Railway.
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(
    `[heartbeat] vivant · uptime=${Math.round(process.uptime())}s · ports=${portsEcoutes.join(",") || "?"} · rss=${Math.round(mem.rss / 1048576)}Mo`
  );
}, 5 * 60 * 1000);

export default app;
