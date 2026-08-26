/**
 * Transcription routes.
 *   POST /api/transcribe — Whisper transcription (multipart/form-data: audio, language)
 */

import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";

const router = Router();

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "missing-key-for-bootstrap",
    });
  }
  return openaiClient;
}

// In-memory storage (we need the Buffer for OpenAI)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (Whisper limit)
});

router.post("/", upload.single("audio"), async (req, res) => {
  try {
    const audioFile = req.file;
    const language = req.body?.language || "fr";

    if (!audioFile) {
      return res.status(400).json({ error: "Fichier audio requis" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "OPENAI_API_KEY non configuré",
        devMode: true,
      });
    }

    // OpenAI SDK accepts a File-like object. Convert the Buffer.
    const file = new File([audioFile.buffer], audioFile.originalname || "audio.webm", {
      type: audioFile.mimetype || "audio/webm",
    });

    const transcription = await getOpenAI().audio.transcriptions.create({
      file,
      model: "whisper-1",
      language,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    return res.json({
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments?.map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    });
  } catch (error: any) {
    console.error("[transcribe] Error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Erreur de transcription" });
  }
});

export default router;
