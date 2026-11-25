/**
 * PATCH  /admin/api/books/<id> — modifie un livre
 * DELETE /admin/api/books/<id> — supprime un livre
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import { purgerArtefactsR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function authentifier(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const champs = [
    "title", "author", "description", "category", "coverUrl", "fileUrl",
    "fileSize", "pageCount", "language", "publishedYear", "isPublished",
    "sortOrder", "servantId",
    // ⭐ V4.40 — champs professionnels (ISBN, éditeur, mots-clés,
    // téléchargeable).
    "isbn", "editeur", "tags", "isDownloadable",
  ];
  for (const c of champs) {
    if (c in body) data[c] = body[c];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  try {
    await db.book.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/books PATCH] Erreur :", err);
    return NextResponse.json({ error: "Livre introuvable ou erreur MAJ" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // ⭐ V4.40 — purge du stockage R2 : supprimer un livre supprime AUSSI sa
    // couverture et son PDF du bucket (politique V3.58 des vidéos — aucun
    // fichier orphelin, facturé et invérifiable). Seules les URL pointant
    // vers NOS hôtes R2 sont converties en clés (extraireCleR2) : une
    // couverture externe n'est jamais touchée. Best-effort : la suppression
    // en base reste prioritaire et un échec R2 ne la bloque pas.
    try {
      const book = await db.book.findUnique({
        where: { id },
        select: { coverUrl: true, fileUrl: true },
      });
      if (book) {
        const purge = await purgerArtefactsR2({
          urls: [book.coverUrl, book.fileUrl],
        });
        if (purge.supprimes > 0) {
          console.log(
            `[admin/books DELETE] R2 : ${purge.supprimes} fichier(s) purgé(s) pour le livre ${id}`
          );
        }
      }
    } catch (e) {
      console.warn(
        "[admin/books DELETE] Purge R2 best-effort échouée :",
        e instanceof Error ? e.message : e
      );
    }

    await db.book.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/books DELETE] Erreur :", err);
    return NextResponse.json({ error: "Livre introuvable" }, { status: 404 });
  }
}
