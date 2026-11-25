/**
 * POST /admin/api/books/presign — URL pré-signée d'upload direct (R2)
 *
 * ⭐ V4.40 — Bibliothèque : la couverture et le PDF d'un livre sont
 * envoyés DIRECTEMENT du navigateur vers Cloudflare R2 via une URL
 * pré-signée (même mécanique que les vidéos V3.35/V3.51). Pourquoi :
 * les fonctions serverless Vercel refusent les corps > ~4,5 Mo — un
 * PDF d'un livre fait souvent 2 à 20 Mo, l'upload relayé par le serveur
 * échouerait. Avec le PUT pré-signé, le fichier ne transite JAMAIS par
 * Vercel : aucune limite de taille (plafond pratique 100 Mo côté client),
 * progression visible, et le serveur reste léger.
 *
 * Body JSON :
 *   { type: "pdf" | "couverture", filename: "mon-livre.pdf", contentType: "application/pdf" }
 *
 * Retour : { uploadUrl, key, publicUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  isR2Configured,
  getPresignedUploadUrl,
  getPublicUrl,
  generateKey,
} from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Extensions acceptées par type de fichier (la 1re est celle attendue).
const EXTENSIONS: Record<string, string[]> = {
  pdf: ["pdf"],
  couverture: ["jpg", "jpeg", "png", "webp"],
};

// Types MIME acceptés par type de fichier (le navigateur renseigne le sien).
const MIME_OK: Record<string, RegExp> = {
  pdf: /^application\/pdf$/i,
  couverture: /^image\/(jpeg|png|webp|avif)$/i,
};

export async function POST(request: NextRequest) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const type = (body.type as string)?.trim();
  const filename = (body.filename as string)?.trim() || "";
  const contentType = (body.contentType as string)?.trim() || "";

  if (type !== "pdf" && type !== "couverture") {
    return NextResponse.json(
      { error: "Type de fichier invalide (pdf ou couverture attendu)" },
      { status: 400 }
    );
  }

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "Nom de fichier et type MIME requis" },
      { status: 400 }
    );
  }

  // Type MIME déclaré par le navigateur : doit correspondre au type demandé.
  if (!MIME_OK[type].test(contentType)) {
    return NextResponse.json(
      { error: `Type de fichier refusé (${contentType}) — attendu : ${type === "pdf" ? "un PDF" : "une image (jpg, png, webp)"}` },
      { status: 400 }
    );
  }

  // Extension du fichier original (sanitisée) — utilisée dans la clé R2.
  const extBrut = filename.split(".").pop() || "";
  const ext = extBrut.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ext || !EXTENSIONS[type].includes(ext)) {
    return NextResponse.json(
      { error: `Extension « .${ext || "?"} » non reconnue — attendu : ${EXTENSIONS[type].join(", ")}` },
      { status: 400 }
    );
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error:
          "Stockage R2 non configuré — variables d'environnement requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (à définir sur Vercel). En attendant, utilisez le champ « URL manuelle ».",
      },
      { status: 503 }
    );
  }

  try {
    // Clé : livres/pdf-<ts>-<rand>.pdf / livres/couverture-<ts>-<rand>.jpg
    const key = generateKey("livres", type, ext);
    const uploadUrl = await getPresignedUploadUrl(key, contentType);
    return NextResponse.json({
      uploadUrl,
      key,
      // URL publique définitive du fichier (domaine R2 configuré) — c'est
      // ELLE qui est enregistrée dans les champs coverUrl / fileUrl du livre.
      publicUrl: getPublicUrl(key),
    });
  } catch (err) {
    console.error("[admin/books/presign] Erreur :", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Échec de la génération de l'URL d'upload" },
      { status: 500 }
    );
  }
}

async function authentifier(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}
