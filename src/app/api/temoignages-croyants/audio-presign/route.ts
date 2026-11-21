import { NextRequest, NextResponse } from "next/server";
import {
  isR2Configured,
  ensureR2CorsConfig,
  generateKey,
  getPresignedUploadUrl,
  getPublicUrl,
} from "@/lib/r2";

/**
 * ⭐ V4.25 — PRESIGN D'UPLOAD DE LA NOTE VOCALE DU TÉMOIGNAGE.
 *
 * POST /api/temoignages-croyants/audio-presign
 * Body: { contentType: "audio/webm;codecs=opus" | "audio/mp4" | … }
 * Response: { uploadUrl, publicUrl, key }
 *
 * POURQUOI UNE ROUTE SÉPARÉE (motif /api/videos/[id]/presign) :
 * le témoin peut enregistrer un vocal de DURÉE ILLIMITÉE (demande du
 * pasteur). Faire transiter l'audio par le body d'une fonction Next.js
 * le limiterait à ~4,5 Mo (limite serverless Vercel ≈ 2 min d'opus).
 * Ici, le navigateur (ou l'app Flutter) :
 *   1. demande une URL pré-signée (cette route — AUCUN octet audio
 *      ne transite par elle) ;
 *   2. uploade le fichier DIRECTEMENT vers Cloudflare R2 via PUT
 *      (aucune limite de durée ni de taille) ;
 *   3. envoie le témoignage en JSON à /api/temoignages-croyants avec
 *      l'URL publique de l'audio — le POST vérifie que cette URL
 *      appartient bien à notre bucket R2.
 *
 * ⚠️ Route PUBLIQUE (comme la soumission) mais encadrée :
 *   - Content-Type AUDIO uniquement (liste blanche) ;
 *   - anti-abus : ≤ 6 presign/heure/adresse IP (en mémoire d'instance —
 *     les lambdas Vercel étant éphémères, c'est une garde best-effort,
 *     cohérente avec le reste du projet) ;
 *   - l'URL pré-signée expire au bout d'1 h et n'autorise qu'UN PUT.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Types audio acceptés (web: webm/opus · iOS Safari: mp4 · app: m4a). */
const MIMES_AUDIO_ACCEPTES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/aac",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
]);

/** Extension déduite du Content-Type (clé R2 lisible). */
function extensionAudio(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("flac")) return "flac";
  if (mime.includes("aac")) return "aac";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  return "bin";
}

/* ── Anti-abus best-effort (mémoire d'instance) ── */
const FENETRE_MS = 60 * 60 * 1000; // 1 h
const MAX_PAR_FENETRE = 6;
const compteurs = new Map<string, { n: number; reset: number }>();

function autoriserParIp(ip: string): boolean {
  const maintenant = Date.now();
  const c = compteurs.get(ip);
  if (!c || maintenant > c.reset) {
    compteurs.set(ip, { n: 1, reset: maintenant + FENETRE_MS });
    // Nettoyage opportuniste (la Map reste petite).
    if (compteurs.size > 512) {
      for (const [cle, val] of compteurs) {
        if (maintenant > val.reset) compteurs.delete(cle);
      }
    }
    return true;
  }
  if (c.n >= MAX_PAR_FENETRE) return false;
  c.n += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // ── Anti-abus ──
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "inconnu";
    if (!autoriserParIp(ip)) {
      return NextResponse.json(
        { error: "Trop de demandes d'upload vocal. Réessayez dans une heure." },
        { status: 429 }
      );
    }

    // ── R2 configuré ? ──
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          error:
            "L'upload de notes vocales n'est pas disponible pour le moment — vous pouvez envoyer votre témoignage écrit.",
          r2NotConfigured: true,
        },
        { status: 503 }
      );
    }

    // ── Corps : Content-Type audio attendu ──
    const body = await request.json().catch(() => null);
    const contentType = String(
      (body as Record<string, unknown> | null)?.contentType || ""
    ).trim();

    if (!MIMES_AUDIO_ACCEPTES.has(contentType)) {
      return NextResponse.json(
        { error: "Type audio non supporté." },
        { status: 400 }
      );
    }

    // ── CORS du bucket (idempotent — PUT direct depuis le navigateur) ──
    await ensureR2CorsConfig();

    // ── Présignature : clé sous temoignages-audio/ ──
    const id = crypto.randomUUID();
    const key = generateKey("temoignages-audio", id, extensionAudio(contentType));
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 3600);
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (e) {
    console.error("[api/temoignages-croyants/audio-presign] POST :", e);
    return NextResponse.json(
      { error: "Impossible de préparer l'upload vocal. Réessayez dans un instant." },
      { status: 500 }
    );
  }
}
