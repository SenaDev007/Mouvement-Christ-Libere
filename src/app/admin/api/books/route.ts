/**
 * GET  /admin/api/books — liste tous les livres (admin)
 * POST /admin/api/books — crée un nouveau livre
 *
 * ⭐ V4.38 — Bibliothèque documentaire : gestion des livres gratuits
 * publiés par le pasteur et Afrika Pamela.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function authentifier(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

// ─── GET : liste ──────────────────────────────────────────────────────

export async function GET() {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const books = await db.book.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        servant: { select: { code: true, shortName: true } },
      },
    });

    return NextResponse.json({
      books: books.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        servantCode: b.servant?.code || null,
        servantShortName: b.servant?.shortName || null,
      })),
    });
  } catch (err) {
    console.error("[admin/books GET] Erreur :", err);
    return NextResponse.json({ error: "Erreur lecture livres" }, { status: 500 });
  }
}

// ─── POST : création ──────────────────────────────────────────────────

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

  const title = (body.title as string)?.trim();
  const author = (body.author as string)?.trim();
  const description = (body.description as string)?.trim() || "";
  const category = (body.category as string)?.trim() || "Autres";
  const coverUrl = (body.coverUrl as string)?.trim() || null;
  const fileUrl = (body.fileUrl as string)?.trim() || null;
  const fileSize = body.fileSize ? Number(body.fileSize) : null;
  const pageCount = body.pageCount ? Number(body.pageCount) : null;
  const language = (body.language as string)?.trim() || "Français";
  const publishedYear = body.publishedYear ? Number(body.publishedYear) : null;
  const isPublished = body.isPublished !== false;
  const sortOrder = body.sortOrder ? Number(body.sortOrder) : 0;
  const servantId = (body.servantId as string)?.trim() || null;

  if (!title || !author) {
    return NextResponse.json({ error: "Titre et auteur requis" }, { status: 400 });
  }

  try {
    const book = await db.book.create({
      data: {
        title,
        author,
        description,
        category,
        coverUrl,
        fileUrl,
        fileSize,
        pageCount,
        language,
        publishedYear,
        isPublished,
        sortOrder,
        servantId,
      },
    });
    return NextResponse.json({ ok: true, id: book.id });
  } catch (err) {
    console.error("[admin/books POST] Erreur :", err);
    return NextResponse.json({ error: "Erreur création livre" }, { status: 500 });
  }
}
