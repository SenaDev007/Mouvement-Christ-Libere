/**
 * GET /api/bible/bookmarks — Lister les marque-pages de l'utilisateur connecté
 * POST /api/bible/bookmarks — Ajouter un marque-page
 * DELETE /api/bible/bookmarks — Supprimer tous les marque-pages (optionnel)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — Lister les marque-pages de l'utilisateur
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    const bookmarks = await db.bibleBookmark.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error("[bible/bookmarks GET]", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// POST — Ajouter un marque-page
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { version, livreId, livreNom, chapitre, verset, texte, note, couleur } = body;

    // Validation
    if (!version || !livreId || !livreNom || !chapitre || !verset || !texte) {
      return NextResponse.json(
        { error: "Champs requis manquants" },
        { status: 400 }
      );
    }

    const bookmark = await db.bibleBookmark.upsert({
      where: {
        userId_version_livreId_chapitre_verset: {
          userId: session.user.id,
          version,
          livreId,
          chapitre: parseInt(chapitre),
          verset: parseInt(verset),
        },
      },
      create: {
        userId: session.user.id,
        version,
        livreId,
        livreNom,
        chapitre: parseInt(chapitre),
        verset: parseInt(verset),
        texte,
        note: note || null,
        couleur: couleur || null,
      },
      update: {
        texte,
        note: note || null,
        couleur: couleur || null,
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    console.error("[bible/bookmarks POST]", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
