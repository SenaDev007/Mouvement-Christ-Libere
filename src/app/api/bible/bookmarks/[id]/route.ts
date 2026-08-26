/**
 * DELETE /api/bible/bookmarks/[id] — Supprimer un marque-page
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Vérifier que le marque-page appartient à l'utilisateur
    const bookmark = await db.bibleBookmark.findUnique({ where: { id } });
    if (!bookmark || bookmark.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Marque-page non trouvé" },
        { status: 404 }
      );
    }

    await db.bibleBookmark.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[bible/bookmarks/[id] DELETE]", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
