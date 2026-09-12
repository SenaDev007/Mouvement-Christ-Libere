import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import { ANNONCE_CATEGORIES_VALEURS } from "@/lib/staff-space/constants";
import { relayerAnnonceMinistere } from "@/lib/staff-space/annonce-relay";

/**
 * ⭐ V3.66 — Secrétariat : annonces officielles du ministère.
 *
 *   GET   /secretariat/api/annonces?categorie=&statut=&limit=
 *   POST  /secretariat/api/annonces
 *         { title, content, category, isPublished, relayYeshua }
 *
 * Le relais Yeshua Connect (optionnel) est best-effort APRÈS la réponse
 * (pattern `after` V3.36) : la publication dans le secrétariat ne doit
 * jamais être ralentie ni échouer à cause du relais.
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const url = new URL(request.url);
    const categorie = url.searchParams.get("categorie") || "";
    const statut = url.searchParams.get("statut") || ""; // publiee | brouillon
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 200);

    const where: Record<string, unknown> = {};
    if (categorie && ANNONCE_CATEGORIES_VALEURS.includes(categorie)) {
      where.category = categorie;
    }
    if (statut === "publiee") where.isPublished = true;
    if (statut === "brouillon") where.isPublished = false;

    const [items, total] = await Promise.all([
      db.ministryAnnouncement.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
      }),
      db.ministryAnnouncement.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  } catch (error) {
    console.error("[secretariat/api/annonces] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des annonces" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

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

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Titre et contenu sont requis" },
        { status: 400 }
      );
    }

    const categorie =
      category && ANNONCE_CATEGORIES_VALEURS.includes(category) ? category : "generale";
    const publier = isPublished !== false; // défaut : publiée immédiatement

    const annonce = await db.ministryAnnouncement.create({
      data: {
        title: title.trim().substring(0, 200),
        content: content.trim().substring(0, 8000),
        category: categorie,
        isPublished: publier,
        publishedAt: publier ? new Date() : null,
        authorId: userId,
      },
    });

    // Journal d'audit.
    try {
      await db.auditLog.create({
        data: {
          action: "ANNONCE_CREATE",
          userId,
          targetId: annonce.id,
          metadata: { titre: annonce.title, categorie, publiee: publier },
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/annonces] AuditLog impossible :", e);
    }

    // Relais Yeshua Connect (best-effort, après la réponse).
    if (publier && relayYeshua) {
      const payload = {
        titre: annonce.title,
        contenu: annonce.content,
        categorie: annonce.category,
      };
      after(async () => {
        const resultat = await relayerAnnonceMinistere(payload);
        if (resultat.ok) {
          await db.ministryAnnouncement
            .update({
              where: { id: annonce.id },
              data: { relayedToYeshua: true, relayedAt: new Date() },
            })
            .catch(() => {});
        }
      });
    }

    return NextResponse.json({ item: annonce }, { status: 201 });
  } catch (error) {
    console.error("[secretariat/api/annonces] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'annonce" },
      { status: 500 }
    );
  }
}
