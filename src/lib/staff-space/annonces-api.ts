import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession } from "@/lib/staff-space/session";
import { ANNONCE_CATEGORIES_VALEURS } from "@/lib/staff-space/constants";
import { relayerAnnonceMinistere } from "@/lib/staff-space/annonce-relay";
import { publierAnnoncesEchues } from "@/lib/staff-space/annonces";

/**
 * ⭐ V3.89 — Handlers PARTAGÉS des annonces du ministère.
 *
 * La V3.66 avait créé le registre des annonces pour le SEUL secrétariat
 * (rôles SECRETARY / SUPER_ADMIN). Directive du pasteur : « même depuis le
 * back-office, que les super admins soient aussi capables de créer des
 * annonces exactement comme le secrétaire le fait depuis l'interface
 * secrétariat ».
 *
 * Toute la logique (liste, création, mise à jour, suppression, relais
 * Yeshua Connect, programmation publishAt) vit ICI, UNE SEULE FOIS :
 *   · /secretariat/api/annonces        → ROLES_SECRETARIAT ;
 *   · /admin/api/annonces (V3.89)      → super admins du back-office.
 * Les deux interfaces partagent le MÊME composant
 * (src/components/staff-space/annonces-view.tsx) et la MÊME table
 * MinistryAnnouncement — une annonce créée au back-office apparaît
 * immédiatement dans le registre du secrétariat (et réciproquement).
 */

/** Étiquette d'audit selon l'espace appelant (traçabilité). */
function prefixeAudit(roles: readonly string[]): string {
  return roles.includes("SECRETARY") ? "[secretariat/api/annonces]" : "[admin/api/annonces]";
}

// ─────────────────────────────────────────────────────────────────────
// GET — liste (filtres catégorie / statut, pagination)
// ─────────────────────────────────────────────────────────────────────
export async function handlerListerAnnonces(
  request: NextRequest,
  rolesAutorises: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, rolesAutorises);
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
    console.error(`${prefixeAudit(rolesAutorises)} GET error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des annonces" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// POST — création
// ─────────────────────────────────────────────────────────────────────
export async function handlerCreerAnnonce(
  request: NextRequest,
  rolesAutorises: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, rolesAutorises);
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

    // Journal d'audit (source = espace appelant).
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
            source: rolesAutorises.includes("SECRETARY") ? "secretariat" : "back-office",
          },
        },
      });
    } catch (e) {
      console.warn(`${prefixeAudit(rolesAutorises)} AuditLog impossible :`, e);
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
    console.error(`${prefixeAudit(rolesAutorises)} POST error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'annonce" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// PATCH — mise à jour / (dé)publication / planification / relais
// ─────────────────────────────────────────────────────────────────────
export async function handlerModifierAnnonce(
  request: NextRequest,
  rolesAutorises: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, rolesAutorises);
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
      console.warn(`${prefixeAudit(rolesAutorises)} AuditLog impossible :`, e);
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
    console.error(`${prefixeAudit(rolesAutorises)} PATCH error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'annonce" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// DELETE — suppression
// ─────────────────────────────────────────────────────────────────────
export async function handlerSupprimerAnnonce(
  request: NextRequest,
  rolesAutorises: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, rolesAutorises);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

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
      console.warn(`${prefixeAudit(rolesAutorises)} AuditLog impossible :`, e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`${prefixeAudit(rolesAutorises)} DELETE error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'annonce" },
      { status: 500 }
    );
  }
}
