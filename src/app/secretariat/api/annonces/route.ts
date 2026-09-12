import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import { ANNONCE_CATEGORIES_VALEURS } from "@/lib/staff-space/constants";
import { relayerAnnonceMinistere } from "@/lib/staff-space/annonce-relay";
import { publierAnnoncesEchues } from "@/lib/staff-space/annonces";

/**
 * ⭐ V3.66/V3.67 — Secrétariat : annonces officielles du ministère.
 *
 *   GET   /secretariat/api/annonces?categorie=&statut=&limit=&offset=
 *   POST  /secretariat/api/annonces
 *         { title, content, category, isPublished, publishAt?, relayYeshua }
 *
 * ⭐ V3.67 — PROGRAMMATION : publishAt (datetime-local ISO) planifie la
 * publication. Chaque lecture du registre BASCULE automatiquement les
 * annonces dont l'heure est atteinte (isPublished → true, publishedAt =
 * publishAt) — sans cron, l'annonce publie dès la première consultation
 * après l'échéance (page publique /annonces incluse).
 *
 * Le relais Yeshua Connect (optionnel) est best-effort APRÈS la réponse
 * (pattern `after` V3.36) : la publication dans le secrétariat ne doit
 * jamais être ralentie ni échouer à cause du relais.
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La bascule des publications planifiées (publierAnnoncesEchues) vit dans
// src/lib/staff-space/annonces.ts — partagée avec la page publique.

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    // ⭐ V3.67 — publications planifiées arrivées à échéance.
    await publierAnnoncesEchues();

    const url = new URL(request.url);
    const categorie = url.searchParams.get("categorie") || "";
    const statut = url.searchParams.get("statut") || ""; // publiee | brouillon | planifiee
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (categorie && ANNONCE_CATEGORIES_VALEURS.includes(categorie)) {
      where.category = categorie;
    }
    if (statut === "publiee") where.isPublished = true;
    if (statut === "brouillon") where.isPublished = false;
    if (statut === "planifiee") {
      where.isPublished = false;
      where.publishAt = { not: null };
    }

    const [items, total] = await Promise.all([
      db.ministryAnnouncement.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
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
      publishAt,
      relayYeshua,
    } = body as {
      title?: string;
      content?: string;
      category?: string;
      isPublished?: boolean;
      publishAt?: string;
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

    // ⭐ V3.67 — publication planifiée : publishAt dans le futur → brouillon
    // PROGRAMMÉ (bascule automatique à l'échéance) ; publishAt passé ou
    // absent → publication immédiate.
    let datePlanifiee: Date | null = null;
    if (publishAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(publishAt)) {
      const d = new Date(publishAt);
      if (!Number.isNaN(d.getTime())) datePlanifiee = d;
    }
    const planifiee =
      datePlanifiee !== null && datePlanifiee.getTime() > Date.now();
    const publier = planifiee ? false : isPublished !== false;

    const annonce = await db.ministryAnnouncement.create({
      data: {
        title: title.trim().substring(0, 200),
        content: content.trim().substring(0, 8000),
        category: categorie,
        isPublished: publier,
        publishedAt: publier ? new Date() : null,
        publishAt: planifiee ? datePlanifiee : null,
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
          metadata: {
            titre: annonce.title,
            categorie,
            publiee: publier,
            planifieePour: planifiee ? datePlanifiee?.toISOString() : null,
          },
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
