import { NextRequest, NextResponse } from "next/server";
import {
  isR2Configured,
  ensureR2CorsConfig,
  generateKey,
  getPresignedUploadUrl,
  getPublicUrl,
} from "@/lib/r2";

/**
 * ⭐ V4.43 — PRESIGN D'UPLOAD DES PIÈCES JOINTES DE LA RETRAITE SPIRITUELLE.
 *
 * POST /api/retreat/presign
 * Body: { kind: "identite" | "paiement", contentType: "image/jpeg" | … }
 * Response: { uploadUrl, publicUrl, key }
 *
 * Même mécanique que les notes vocales (/api/temoignages-croyants/audio-presign)
 * et les livres (V4.40) : le navigateur (ou l'app Flutter) demande une URL
 * pré-signée — AUCUN octet d'image ne transite par cette route — puis envoie
 * le fichier DIRECTEMENT à Cloudflare R2 via PUT. Le POST final /api/retreat
 * reçoit les deux URL publiques et vérifie qu'elles pointent vers notre
 * bucket (préfixe retraite-docs/).
 *
 * ⚠️ Route PUBLIQUE mais encadrée :
 *   - kind = identite (pièce d'identité) ou paiement (preuve 15 000 FCFA) ;
 *   - Content-Type IMAGE uniquement (liste blanche) ;
 *   - anti-abus : ≤ 8 presign/heure/adresse IP (garde best-effort en
 *     mémoire d'instance, cohérente avec le reste du projet) ;
 *   - l'URL pré-signée expire au bout d'1 h et n'autorise qu'UN PUT.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Types d'images acceptés (web + sélecteur système mobile). */
const MIMES_IMAGES_ACCEPTES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Extension déduite du Content-Type (clé R2 lisible). */
function extensionImage(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("heif")) return "heif";
  return "jpg";
}

/* ── Anti-abus best-effort (mémoire d'instance) ── */
const FENETRE_MS = 60 * 60 * 1000; // 1 h
const MAX_PAR_FENETRE = 8;
const compteurs = new Map<string, { n: number; reset: number }>();

function autoriserParIp(ip: string): boolean {
  const maintenant = Date.now();
  const c = compteurs.get(ip);
  if (!c || maintenant > c.reset) {
    compteurs.set(ip, { n: 1, reset: maintenant + FENETRE_MS });
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
        { error: "Trop de demandes d'upload. Réessayez dans une heure." },
        { status: 429 }
      );
    }

    // ── R2 configuré ? ──
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          error:
            "L'envoi des pièces jointes n'est pas disponible pour le moment. Réessayez plus tard ou contactez la secrétaire.",
          r2NotConfigured: true,
        },
        { status: 503 }
      );
    }

    // ── Corps : kind + Content-Type image attendus ──
    const body = await request.json().catch(() => null);
    const kind = String((body as Record<string, unknown> | null)?.kind || "").trim();
    const contentType = String(
      (body as Record<string, unknown> | null)?.contentType || ""
    ).trim();

    if (kind !== "identite" && kind !== "paiement") {
      return NextResponse.json(
        { error: "Type de pièce invalide (identite ou paiement attendus)." },
        { status: 400 }
      );
    }

    if (!MIMES_IMAGES_ACCEPTES.has(contentType)) {
      return NextResponse.json(
        { error: "Format d'image non supporté (JPEG, PNG, WebP ou HEIC)." },
        { status: 400 }
      );
    }

    // ── CORS du bucket (idempotent — PUT direct depuis le navigateur/app) ──
    await ensureR2CorsConfig();

    // ── Présignature : clé sous retraite-docs/ ──
    const id = crypto.randomUUID();
    const key = generateKey("retraite-docs", `${kind}-${id}`, extensionImage(contentType));
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 3600);
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({ uploadUrl, publicUrl, key, kind });
  } catch (e) {
    console.error("[api/retreat/presign] POST :", e);
    return NextResponse.json(
      { error: "Impossible de préparer l'upload de la pièce. Réessayez dans un instant." },
      { status: 500 }
    );
  }
}
