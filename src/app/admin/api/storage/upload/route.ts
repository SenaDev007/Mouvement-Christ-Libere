/**
 * POST /admin/api/storage/upload
 *
 * Upload un fichier vers le stockage GitHub (repo GitHub).
 *
 * Body : multipart/form-data avec :
 *   - file       : le fichier (required)
 *   - type       : "documents" | "videos" | "audio" (required)
 *   - subType    : sous-dossier optionnel (ex: "bibliotheque", "vie-transformee")
 *   - filename   : nom personnalisé (optionnel — sinon utilise le nom du fichier)
 *
 * Réponse 200 : { url, path, sha, size }
 *   - url  : URL raw.githubusercontent.com pour lecture publique
 *   - path : chemin dans le repo (storage/videos/2026-11/28/filename.mp4)
 *   - sha  : SHA GitHub (pour suppression)
 *   - size : taille en octets
 *
 * Réponse 4xx/5xx : { error }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { uploadToGithub, isGithubStorageConfigured, type MediaType } from "@/lib/github-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth admin
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isGithubStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          "GITHUB_STORAGE_TOKEN n'est pas configuré sur Vercel. " +
          "Ajoutez cette variable d'environnement (Settings → Environment Variables) " +
          "avec un token GitHub ayant accès en écriture au repo.",
      },
      { status: 503 }
    );
  }

  // Parser le multipart/form-data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Body multipart/form-data invalide" }, { status: 400 });
  }

  const file = formData.get("file");
  const type = formData.get("type") as string | null;
  const subType = (formData.get("subType") as string | null) || null;
  const customFilename = (formData.get("filename") as string | null) || null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Champ 'file' requis (fichier)" }, { status: 400 });
  }
  if (!type || !["documents", "videos", "audio"].includes(type)) {
    return NextResponse.json(
      { error: "Champ 'type' requis : 'documents', 'videos' ou 'audio'" },
      { status: 400 }
    );
  }

  const filename = customFilename || file.name || `file-${Date.now()}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await uploadToGithub(
      arrayBuffer,
      type as MediaType,
      subType,
      filename
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[storage/upload] Erreur :", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur upload" },
      { status: 500 }
    );
  }
}
