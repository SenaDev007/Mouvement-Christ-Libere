import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";

/**
 * ⭐ V3.74 — Notifications in-app de l'espace Secrétariat (cloche).
 *
 *   GET  /secretariat/api/notifications — compte non lues + 30 dernières
 *        (validation d'une demande par le serviteur, etc.) ;
 *   POST /secretariat/api/notifications
 *        · { action: "marquerLues" }        — tout marquer lu ;
 *        · { action: "lue", id }            — une notification précise.
 *
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESPACE = "secretariat";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const [nonLues, items] = await Promise.all([
      db.staffNotification.count({
        where: { espace: ESPACE, readAt: null },
      }),
      db.staffNotification.findMany({
        where: { espace: ESPACE },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          titre: true,
          message: true,
          lien: true,
          readAt: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({ nonLues, items });
  } catch (error) {
    console.error("[secretariat/api/notifications] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des notifications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const body = await request.json().catch(() => ({}));
    const { action, id } = body as { action?: string; id?: string };

    if (action === "lue" && id) {
      await db.staffNotification.updateMany({
        where: { id, espace: ESPACE, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "marquerLues" || action === undefined) {
      const resultat = await db.staffNotification.updateMany({
        where: { espace: ESPACE, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        marquees: resultat.count,
      });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("[secretariat/api/notifications] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des notifications" },
      { status: 500 }
    );
  }
}
