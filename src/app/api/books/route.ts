/**
 * GET /api/books — liste publique des livres publiés
 *
 * Query params optionnels :
 *   ?category=Enseignements — filtrer par catégorie
 *   ?servantCode=afrika     — filtrer par serviteur
 *
 * Retourne uniquement les livres avec isPublished = true.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category")?.trim() || null;
  const servantCode = request.nextUrl.searchParams.get("servantCode")?.trim() || null;

  try {
    const books = await db.book.findMany({
      where: {
        isPublished: true,
        ...(category ? { category } : {}),
        ...(servantCode
          ? { servant: { code: { equals: servantCode, mode: "insensitive" } } }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        author: true,
        description: true,
        category: true,
        coverUrl: true,
        fileUrl: true,
        fileSize: true, // ⭐ V4.40 — taille affichée + transmise à l'app mobile
        pageCount: true,
        language: true,
        publishedYear: true,
        isbn: true, // ⭐ V4.40 — champs professionnels
        editeur: true,
        tags: true,
        isDownloadable: true,
        downloadCount: true,
        servant: { select: { code: true, shortName: true } },
      },
    });

    return NextResponse.json({
      books: books.map((b) => ({
        ...b,
        servantCode: b.servant?.code || null,
        servantShortName: b.servant?.shortName || null,
      })),
    });
  } catch (err) {
    console.error("[api/books GET] Erreur :", err);
    return NextResponse.json({ error: "Erreur lecture livres" }, { status: 500 });
  }
}
