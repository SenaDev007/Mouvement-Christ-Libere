import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import { ANNONCE_CATEGORIES_VALEURS } from "@/lib/staff-space/constants";
import { relayerAnnonceMinistere } from "@/lib/staff-space/annonce-relay";

/**
 * ⭐ V3.66/V3.67 — Secrétariat : mise à jour / suppression d'une annonce.
 *
 *   PATCH  /secretariat/api/annonces/[id]
 *          { title?, content?, category?, isPublished?, publishAt?, relayYeshua? }
 *          — la (dé)publication met à jour publishedAt ;
 *          — publishAt (V3.67) planifie la publication (bascule auto
 *            à l'échéance, cf. secretariat/api/annonces) ;
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
      publishAt,
      relayYeshua,
    } = body as {
      title?: string;
      content?: string;
      category?: string;
      isPublished?: boolean;
      publishAt?: string | null;
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

    // ⭐ V3.67 — planification : publishAt futur → brouillon programmé.
    // Une publication MANUELLE (isPublished=true) annule la planification.
    if (publishAt !== undefined) {
      if (publishAt === null || publishAt === "") {
        data.publishAt = null;
      } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(publishAt)) {
        const d = new Date(publishAt);
        if (!Number.isNaN(d.getTime())) {
          if (d.getTime() > Date.now()) {
            data.publishAt = d;
            data.isPublished = false;
            data.publishedAt = null;
          } else {
            // Heure déjà passée → publication immédiate.
            data.publishAt = d;
            data.isPublished = true;
            data.publishedAt = new Date();
          }
        }
      }
    }
    if (typeof isPublished === "boolean") {
      data.isPublished = isPublished;
      data.publishedAt = isPublished ? new Date() : null;
      // Publication manuelle → la planification est retirée.
      if (isPublished) data.publishAt = null;
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
