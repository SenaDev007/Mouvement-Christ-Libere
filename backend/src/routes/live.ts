import { Router } from "express";
import multer from "multer";
import { db } from "../lib/db";
import { verifyToken, AUTH_COOKIE_NAME } from "../lib/auth";
import { uploadToR2, generateKey, isR2Configured, getPresignedUploadUrl, getPublicUrl, diagnoseR2 } from "../lib/r2";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

// --- Admin auth middleware for live routes ---
function adminAuth(req: any, res: any, next: any) {
  const token = req.cookies?.[AUTH_COOKIE_NAME] || req.headers["x-admin-token"];
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: "Token invalide" });
  if (!["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(user.role)) {
    return res.status(403).json({ error: "Permissions insuffisantes" });
  }
  req.user = user;
  next();
}

// --- R2 test ---
router.get("/r2-test", adminAuth, async (req, res) => {
  const action = (req.query.action as string) || "status";
  if (action === "status") {
    return res.json({
      configured: isR2Configured(),
      provider: "Cloudflare R2",
      accountId: process.env.R2_ACCOUNT_ID ? `${process.env.R2_ACCOUNT_ID.substring(0, 8)}...` : "(non défini)",
      bucket: process.env.R2_BUCKET_NAME || "(non défini)",
      publicUrl: process.env.R2_PUBLIC_URL || "(non défini)",
      accessKeyId: process.env.R2_ACCESS_KEY_ID ? `${process.env.R2_ACCESS_KEY_ID.substring(0, 8)}...` : "(non défini)",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ? "(défini)" : "(non défini)",
      envCheck: {
        R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
        R2_PUBLIC_URL: !!process.env.R2_PUBLIC_URL,
      },
    });
  }
  if (action === "test" || action === "diagnose") {
    if (!isR2Configured()) {
      return res.status(503).json({ error: "R2 non configuré" });
    }
    const diag = await diagnoseR2();
    return res.json({
      success: diag.canWrite,
      message: diag.canWrite ? "Upload test réussi" : diag.error || "Échec",
      ...diag,
    });
  }
  res.status(400).json({ error: "Action inconnue" });
});

// --- Recording upload (FormData, up to 100MB) ---
router.post("/:id/recording", adminAuth, upload.single("file"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Fichier manquant" });

    let recordingUrl: string;
    if (isR2Configured()) {
      const ext = file.mimetype.includes("mp4") ? "mp4" : "webm";
      const key = generateKey("replays", id, ext);
      recordingUrl = await uploadToR2(key, file.buffer, file.mimetype);
    } else {
      // Fallback base64
      const base64 = file.buffer.toString("base64");
      recordingUrl = `data:${file.mimetype};base64,${base64}`;
    }

    await db.liveStream.update({ where: { id }, data: { recordingUrl } });
    const live = await db.liveStream.findUnique({ where: { id }, select: { title: true, servantId: true } });
    if (live) {
      const existing = await db.video.findFirst({ where: { servantId: live.servantId, title: { startsWith: `${live.title} (Replay)` } } });
      if (existing) await db.video.update({ where: { id: existing.id }, data: { videoUrl: recordingUrl } });
    }

    res.json({ success: true, recordingUrl, size: Math.round(file.size / 1024), storage: isR2Configured() ? "r2" : "base64" });
  } catch (error) {
    console.error("[recording]", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur" });
  }
});

// --- Presign URL for large file direct upload ---
router.post("/:id/presign", adminAuth, async (req, res) => {
  try {
    if (!isR2Configured()) return res.status(503).json({ error: "R2 non configuré" });
    const id = String(req.params.id);
    const contentType: string = req.body?.contentType || "video/webm";
    const ext = contentType.includes("mp4") ? "mp4" : "webm";
    const key = generateKey("replays", id, ext);
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 7200);
    const publicUrl = getPublicUrl(key);
    res.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur" });
  }
});

// --- Thumbnail upload ---
router.post("/:id/thumbnail", adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { thumbnail } = req.body;
    if (!thumbnail || !thumbnail.startsWith("data:image/")) return res.status(400).json({ error: "Image invalide" });
    const matches = thumbnail.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: "Format invalide" });
    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const mimeType = `image/${matches[1] === "jpg" ? "jpeg" : matches[1]}`;

    let thumbnailUrl: string;
    if (isR2Configured()) {
      const key = generateKey("thumbnails", `live-${id}`, ext);
      thumbnailUrl = await uploadToR2(key, buffer, mimeType);
    } else {
      thumbnailUrl = thumbnail;
    }

    await db.liveStream.update({ where: { id }, data: { thumbnailUrl } });
    res.json({ success: true, thumbnailUrl });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur" });
  }
});

// --- Chat messages ---
router.get("/:id/chat", async (req, res) => {
  try {
    const id = String(req.params.id);
    const since = (req.query.since as string) || "";
    const where: any = { liveId: id };
    if (since) where.createdAt = { gt: new Date(since) };
    const messages = await db.liveChatMessage.findMany({
      where,
      orderBy: { createdAt: since ? "asc" : "desc" },
      take: since ? 200 : 50,
    });
    const result = since ? messages : messages.reverse();
    res.json({
      messages: result.map((m) => ({
        id: m.id, userName: m.userName, content: m.content, type: m.type,
        emoji: m.emoji, likeCount: m.likeCount, createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
});

router.post("/:id/chat", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { userName, content, type = "message", emoji } = req.body;
    if (!userName || !content) return res.status(400).json({ error: "userName et content requis" });
    const trimmed = content.trim().substring(0, 500);
    if (!trimmed) return res.status(400).json({ error: "Message vide" });
    const message = await db.liveChatMessage.create({
      data: { liveId: id, userName: userName.substring(0, 50), content: trimmed, type: type === "reaction" ? "reaction" : "message", emoji: emoji || null },
    });
    res.json({
      success: true,
      message: {
        id: message.id, userName: message.userName, content: message.content,
        type: message.type, emoji: message.emoji, likeCount: message.likeCount,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
});

// --- Like a message ---
router.post("/:id/chat/like", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { messageId, liked } = req.body;
    if (!messageId) return res.status(400).json({ error: "messageId requis" });
    const message = await db.liveChatMessage.findFirst({ where: { id: messageId, liveId: id }, select: { id: true, likeCount: true } });
    if (!message) return res.status(404).json({ error: "Message introuvable" });
    const newCount = Math.max(0, message.likeCount + (liked ? 1 : -1));
    await db.liveChatMessage.update({ where: { id: messageId }, data: { likeCount: newCount } });
    res.json({ success: true, likeCount: newCount, liked: !!liked });
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
});

// --- Viewers ---
router.get("/:id/viewers", async (req, res) => {
  try {
    const id = String(req.params.id);
    const count = await db.liveViewer.count({ where: { liveId: id, isActive: true } });
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
});

router.post("/:id/viewers", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ error: "memberId requis" });
    const member = await db.liveMember.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: "Membre introuvable" });
    const viewer = await db.liveViewer.findFirst({ where: { liveId: id, memberId } });
    if (viewer) {
      await db.liveViewer.update({ where: { id: viewer.id }, data: { isActive: true, leftAt: null, joinedAt: new Date() } });
    } else {
      await db.liveViewer.create({ data: { liveId: id, memberId, isActive: true } });
      await db.liveMember.update({ where: { id: memberId }, data: { livesWatched: { increment: 1 } } });
    }
    const count = await db.liveViewer.count({ where: { liveId: id, isActive: true } });
    res.json({ success: true, viewerCount: count });
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
});

router.delete("/:id/viewers", async (req, res) => {
  try {
    const id = String(req.params.id);
    const memberId = (req.query.memberId as string) || "";
    if (!memberId) return res.status(400).json({ error: "memberId requis" });
    await db.liveViewer.updateMany({ where: { liveId: id, memberId, isActive: true }, data: { isActive: false, leftAt: new Date() } });
    const count = await db.liveViewer.count({ where: { liveId: id, isActive: true } });
    res.json({ success: true, viewerCount: count });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

router.patch("/:id/viewers", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { memberId, xp } = req.body;
    if (!memberId) return res.status(400).json({ error: "memberId requis" });
    await db.liveViewer.updateMany({ where: { liveId: id, memberId, isActive: true }, data: { xpPoints: { increment: xp || 1 } } });
    const member = await db.liveMember.update({ where: { id: memberId }, data: { totalXp: { increment: xp || 1 } } });
    res.json({ success: true, totalXp: member.totalXp });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

// --- Start live ---
router.post("/start", adminAuth, async (req, res) => {
  try {
    const { liveId } = req.body;
    if (!liveId) return res.status(400).json({ error: "liveId requis" });
    const live = await db.liveStream.findUnique({ where: { id: liveId }, include: { servant: { include: { streamConfig: true } } } });
    if (!live) return res.status(404).json({ error: "Live introuvable" });
    if (live.status === "LIVE") return res.status(400).json({ error: "Le live est déjà en cours" });
    const roomName = live.livekitRoomName || `live-${live.id}`;
    await db.liveStream.update({ where: { id: liveId }, data: { status: "LIVE", startedAt: new Date(), livekitRoomName: roomName } });
    await db.liveChatMessage.deleteMany({ where: { liveId } });
    await db.liveViewer.updateMany({ where: { liveId, isActive: true }, data: { isActive: false, leftAt: new Date() } });
    res.json({ success: true, liveId, roomName, status: "LIVE" });
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
});

// --- Stop live ---
router.post("/stop", adminAuth, async (req, res) => {
  try {
    const { liveId, recordingUrl } = req.body;
    if (!liveId) return res.status(400).json({ error: "liveId requis" });
    const live = await db.liveStream.findUnique({ where: { id: liveId }, include: { servant: true } });
    if (!live) return res.status(404).json({ error: "Live introuvable" });
    let durationStr = "";
    if (live.startedAt) {
      const durationMs = (live.endedAt || new Date()).getTime() - new Date(live.startedAt).getTime();
      const h = Math.floor(durationMs / 3600000);
      const m = Math.floor((durationMs % 3600000) / 60000);
      const s = Math.floor((durationMs % 60000) / 1000);
      durationStr = h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
    }
    await db.liveStream.update({ where: { id: liveId }, data: { status: "ENDED", endedAt: new Date(), recordingUrl: recordingUrl || null } });
    const replayUrl = recordingUrl || live.youtubeUrl || null;
    const liveDate = new Date(live.startedAt || live.scheduledAt);
    const dateStr = liveDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const uniqueViewerCount = await db.liveViewer.count({ where: { liveId } });
    const totalViews = Math.max(live.viewerCount, uniqueViewerCount);
    const existingReplay = await db.video.findFirst({ where: { servantId: live.servantId, title: { startsWith: `${live.title} (Replay)` } } });
    if (!existingReplay) {
      await db.video.create({
        data: {
          servantId: live.servantId, title: `${live.title} (Replay)`,
          description: `Replay du live du ${dateStr}${live.description ? ` — ${live.description}` : ""}`,
          duration: durationStr, views: totalViews, isLive: false, videoUrl: replayUrl,
          hlsUrl: recordingUrl || null, thumbnailUrl: live.thumbnailUrl || null, publishedAt: new Date(),
        },
      });
    } else {
      const newViews = Math.max(existingReplay.views, totalViews);
      await db.video.update({ where: { id: existingReplay.id }, data: { videoUrl: replayUrl || existingReplay.videoUrl, hlsUrl: recordingUrl || existingReplay.hlsUrl, duration: durationStr || existingReplay.duration, thumbnailUrl: live.thumbnailUrl || existingReplay.thumbnailUrl, views: newViews } });
    }
    res.json({ success: true, liveId, status: "ENDED", archived: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
});

// --- Active live ---
router.get("/active", async (req, res) => {
  try {
    const live = await db.liveStream.findFirst({ where: { status: "LIVE" }, include: { servant: true } });
    res.json({ live });
  } catch {
    res.json({ live: null });
  }
});

// --- Next live ---
router.get("/next", async (req, res) => {
  try {
    const live = await db.liveStream.findFirst({ where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, include: { servant: true } });
    res.json({ live });
  } catch {
    res.json({ live: null });
  }
});

export default router;
