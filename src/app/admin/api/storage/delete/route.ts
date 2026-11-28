/**
 * POST /admin/api/storage/delete
 *
 * Supprime un fichier du stockage GitHub.
 *
 * Body JSON : { path?: string, url?: string }
 *   - path : chemin dans le repo (storage/videos/2026-11/28/file.mp4)
 *   - url  : URL raw.githubusercontent.com (alternative au path)
 *
 * Réponse 200 : { ok: true, deleted: boolean }
 * Réponse 4xx/5xx : { error }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  deleteFromGithub,
  deleteFromGithubUrl,
  isGithubStorageConfigured,
} from "@/lib/github-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isGithubStorageConfigured()) {
    return NextResponse.json(
      { error: "GITHUB_STORAGE_TOKEN n'est pas configuré." },
      { status: 503 }
    );
  }

  let body: { path?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const path = body.path?.trim();
  const url = body.url?.trim();

  if (!path && !url) {
    return NextResponse.json(
      { error: "Champ 'path' ou 'url' requis" },
      { status: 400 }
    );
  }

  try {
    let deleted: boolean;
    if (path) {
      deleted = await deleteFromGithub(path);
    } else {
      deleted = await deleteFromGithubUrl(url!);
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error("[storage/delete] Erreur :", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur suppression" },
      { status: 500 }
    );
  }
}
