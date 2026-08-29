import { Router } from "express";
import multer from "multer";
import { db } from "../lib/db";
import { verifyToken, AUTH_COOKIE_NAME } from "../lib/auth";
import { uploadToR2, generateKey, isR2Configured } from "../lib/r2";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

function adminAuth(req: any, res: any, next: any) {
  const token = req.cookies?.[AUTH_COOKIE_NAME] || req.headers["x-admin-token"];
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: "Token invalide" });
  if (!["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(user.role)) return res.status(403).json({ error: "Permissions insuffisantes" });
  req.user = user;
  next();
}

// --- List videos ---
router.get("/", async (req, res) => {
  try {
    const servant = req.query.servant as string;
    const where: any = {};
    if (servant && servant !== "all") where.servant = { code: servant };
    const videos = await db.video.findMany({ where, orderBy: { publishedAt: "desc" }, include: { servant: true } });
    const formatted = videos.map((v) => {
      const youtubeId = v.videoUrl?.match(/v=([a-zA-Z0-9_-]{11})/)?.[1] || v.videoUrl?.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1] || "";
      const hasNativeVideo = !!v.videoUrl && (v.videoUrl.endsWith(".mp4") || v.videoUrl.startsWith("http") || v.videoUrl.startsWith("data:video")) && !youtubeId;
      return {
        id: v.id, youtubeId, videoUrl: v.videoUrl, hlsUrl: v.hlsUrl, title: v.title,
        description: v.description, duration: v.duration || "", views: v.views,
        publishedAt: v.publishedAt?.toISOString() || "",
        category: categorize(v.title, v.servant.code), servant: v.servant.code,
        servantName: v.servant.shortName,
        thumbnailUrl: v.thumbnailUrl || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : ""),
        isLive: v.isLive, hasNativeVideo,
      };
    });
    res.json({ videos: formatted });
  } catch (error) {
    console.error("[videos]", error);
    res.json({ videos: [] });
  }
});

// --- Upload video source ---
router.post("/:id/upload", adminAuth, upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Fichier manquant" });
    if (!file.mimetype.startsWith("video/")) return res.status(400).json({ error: "Type non supporté" });
    let videoUrl: string;
    if (isR2Configured()) {
      const ext = file.mimetype.includes("webm") ? "webm" : "mp4";
      const key = generateKey("videos", id, ext);
      videoUrl = await uploadToR2(key, file.buffer, file.mimetype);
    } else {
      const base64 = file.buffer.toString("base64");
      videoUrl = `data:${file.mimetype};base64,${base64}`;
    }
    await db.video.update({ where: { id }, data: { videoUrl } });
    res.json({ success: true, videoUrl, size: Math.round(file.size / 1024), storage: isR2Configured() ? "r2" : "base64" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur" });
  }
});

// --- Get video source ---
router.get("/:id/source", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const video = await db.video.findUnique({ where: { id }, select: { videoUrl: true } });
    if (!video) return res.status(404).json({ error: "Vidéo introuvable" });
    res.json({ videoUrl: video.videoUrl });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

// --- Like video ---
router.post("/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    await db.video.update({ where: { id }, data: { views: { increment: 1 } } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

function categorize(title: string, servant: string): string {
  const t = title.toLowerCase();
  if (t.includes("replay") || t.includes("(live)")) return "Lives & Directs";
  if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
  if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
  if (t.includes("témoignage") || t.includes("vision")) return "Témoignages & Visions";
  if (t.includes("shabbat") || t.includes("fête")) return "Fêtes & Shabbat";
  return "Paroles & Exhortations";
}

export default router;
