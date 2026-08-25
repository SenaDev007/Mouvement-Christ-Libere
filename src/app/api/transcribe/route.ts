import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * POST /api/transcribe
 *
 * Transcribes an audio file using OpenAI Whisper API.
 * Used for:
 *   - Subtitling video teachings (V2.4)
 *   - Transcribing voice messages in Yeshua Connect
 *
 * Body: FormData { audio: File, language?: string }
 * Response: { text, language, duration }
 *
 * Env vars:
 *   OPENAI_API_KEY
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const language = (formData.get("language") as string) || "fr";

    if (!audioFile) {
      return NextResponse.json({ error: "Fichier audio requis" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: "OPENAI_API_KEY non configuré",
        devMode: true,
      }, { status: 503 });
    }

    // Convert File to buffer
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const file = new File([buffer], audioFile.name || "audio.webm", {
      type: audioFile.type || "audio/webm",
    });

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    return NextResponse.json({
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments?.map(s => ({
        id: s.id,
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    });
  } catch (error: any) {
    console.error("[transcribe] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur de transcription" },
      { status: 500 },
    );
  }
}
