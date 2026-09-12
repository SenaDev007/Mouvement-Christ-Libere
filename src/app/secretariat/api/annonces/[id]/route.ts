import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import { ANNONCE_CATEGORIES_VALEURS } from "@/lib/staff-space/constants";
import { relayerAnnonceMinistere } from "@/lib/staff-space/annonce-relay";

/**
 * ⭐ V3.66 — Secrétariat : mise à jour / suppression d'une annonce.
 *
 *   PATCH  /secretariat/api/annonces/[id]
 *          { title?, content?, category?, isPublished?, relayYeshua? }
 *          — la (dé)publication met à jour publishedAt ;
 *          — relais Yeshua Connect optionnel au moment de la publication.
 *   DELETE /secretariat/api/annonces/[id]
 *
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      content,
      category,
      isPublished,
      relayYeshua,
    } = body as {
      title?: string;
      content?: string;
      category?: string;
      isPublished?: boolean;
      relayYeshua?: boolean;
    };

    const annonce = await db.ministryAnnouncement.findUnique({ where: { id } });
    if (!annonce) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (title?.trim()) data.title = title.trim().substring(0, 200);
    if (content?.trim()) data.content = content.trim().substring(0, 8000);
    if (category && ANNONCE_CATEGORIES_VALEURS.includes(category)) {
      data.category = category;
    }
    if (typeof isPublished === "boolean") {
      data.isPublished = isPublished;
      data.publishedAt = isPublished ? new Date() : null;
    }

    const modifiee = await db.ministryAnnouncement.update({
      where: { id },
      data: data as never,
    });

    try {
      await db.auditLog.create({
        data: {
          action: "ANNONCE_UPDATE",
          userId,
          targetId: id,
          metadata: { titre: modifiee.title, publiee: modifiee.isPublished },
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/annonces] AuditLog impossible :", e);
    }

    if (relayYeshua && modifiee.isPublished) {
      const payload = {
        titre: modifiee.title,
        contenu: modifiee.content,
        categorie: modifiee.category,
      };
      after(async () => {
        const resultat = await relayerAnnonceMinistere(payload);
        if (resultat.ok) {
          await db.ministryAnnouncement
            .update({
              where: { id },
              data: { relayedToYeshua: true, relayedAt: new Date() },
            })
            .catch(() => {});
        }
      });
    }

    return NextResponse.json({ item: modifiee });
  } catch (error) {
    console.error("[secretariat/api/annonces/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'annonce" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

    const { id } = await params;
    const annonce = await db.ministryAnnouncement.findUnique({ where: { id } });
    if (!annonce) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    await db.ministryAnnouncement.delete({ where: { id } });

    try {
      await db.auditLog.create({
        data: {
          action: "ANNONCE_DELETE",
          userId,
          targetId: id,
          metadata: { titre: annonce.title, categorie: annonce.category },
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/annonces] AuditLog impossible :", e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[secretariat/api/annonces/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'annonce" },
      { status: 500 }
    );
  }
}
