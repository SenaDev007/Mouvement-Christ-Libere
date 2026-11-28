/**
 * POST /admin/api/storage/transfer
 *
 * ⭐ V4.44 — Transfère un fichier de R2 (stockage temporaire) vers GitHub
 * (stockage permanent). Détection automatique :
 *   - ≤ 75 Mo → Contents API (URL raw.githubusercontent.com)
 *   - > 75 Mo → GitHub Releases (URL github.com/.../releases/download/...)
 *
 * Après le transfert :
 *   - Le fichier est supprimé de R2 (libère l'espace du plan gratuit 10 Go)
 *   - L'appelant met à jour l'URL en base vers l'URL GitHub
 *
 * Body JSON : { r2Url: string, type: MediaType, subType?: string, filename?: string }
 *
 * Réponse 200 : { githubUrl, path, sha, size, storage, r2Deleted }
 * Réponse 4xx/5xx : { error }
 *
 * Auth : session admin obligatoire.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  uploadToGithub,
  isGithubStorageConfigured,
  type MediaType,
} from "@/lib/github-storage";
import { extraireCleR2, deleteFromR2, getClient } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Télécharge un objet depuis R2 en mémoire (Buffer). */
async function downloadR2Object(key: string): Promise<Buffer> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);
  if (!response.Body) {
    throw new Error(`Objet R2 vide : ${key}`);
  }

  const chunks: Buffer[] = [];
  // @ts-expect-error — response.Body est un Readable en Node
  for await (const chunk of response.Body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isGithubStorageConfigured()) {
    return NextResponse.json(
      { error: "GITHUB_STORAGE_TOKEN n'est pas configuré sur Vercel." },
      { status: 503 }
    );
  }

  let body: {
    r2Url?: string;
    type?: string;
    subType?: string;
    filename?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const r2Url = body.r2Url?.trim();
  const type = body.type?.trim();
  const subType = body.subType?.trim() || null;
  const customFilename = body.filename?.trim() || null;

  if (!r2Url) {
    return NextResponse.json({ error: "Champ 'r2Url' requis" }, { status: 400 });
  }
  if (!type || !["documents", "videos", "audio"].includes(type)) {
    return NextResponse.json(
      { error: "Champ 'type' requis : 'documents', 'videos' ou 'audio'" },
      { status: 400 }
    );
  }

  // ① Extraire la clé R2 depuis l'URL
  const keyR2 = extraireCleR2(r2Url);
  if (!keyR2) {
    return NextResponse.json(
      { error: "L'URL n'est pas un fichier R2 valide (host non reconnu)." },
      { status: 400 }
    );
  }

  try {
    // ② Télécharger depuis R2
    const buffer = await downloadR2Object(keyR2);
    const size = buffer.length;

    // ③ Extraire le nom de fichier
    const filename = customFilename || keyR2.split("/").pop() || `file-${Date.now()}`;

    // ④ Upload vers GitHub (Contents ≤ 75 Mo, Releases > 75 Mo)
    const result = await uploadToGithub(buffer, type as MediaType, subType, filename);

    // ⑤ Supprimer de R2 (best-effort — libère l'espace du plan gratuit)
    let r2Deleted = false;
    try {
      await deleteFromR2(keyR2);
      r2Deleted = true;
    } catch (delErr) {
      console.warn(
        "[storage/transfer] Échec suppression R2 (best-effort) :",
        delErr instanceof Error ? delErr.message : delErr
      );
    }

    console.log(
      `[storage/transfer] Transfert OK : R2(${keyR2.slice(0, 40)}…) → GitHub(${result.storage}, ${(size / 1024 / 1024).toFixed(2)} Mo, r2Deleted=${r2Deleted})`
    );

    return NextResponse.json({
      githubUrl: result.url,
      path: result.path,
      sha: result.sha,
      size: result.size,
      storage: result.storage,
      r2Deleted,
    });
  } catch (err) {
    console.error("[storage/transfer] Erreur :", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur transfert" },
      { status: 500 }
    );
  }
}
