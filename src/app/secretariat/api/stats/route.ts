import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — GET /secretariat/api/stats
 *
 * KPIs du tableau de bord secrétariat :
 *  · demandes par statut (reçues / transmises / traitées / archivées) ;
 *  · demandes par serviteur (Pam / Pasteur Kongo) ;
 *  · demandes urgentes en attente ;
 *  · annonces publiées / brouillons ;
 *  · dernières demandes reçues (aperçu) + prochaines annonces.
 *
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const [
      recues,
      transmises,
      validees,
      traitees,
      archivees,
      urgentesAttente,
      pourPam,
      pourKongo,
      annoncesPubliees,
      annoncesBrouillons,
      dernieresDemandes,
      dernieresAnnonces,
    ] = await Promise.all([
      db.meetingRequest.count({ where: { status: "RECUE" } }),
      db.meetingRequest.count({ where: { status: "TRANSMISE" } }),
      // ⭐ V3.74 — demandes validées par les serviteurs (notification).
      db.meetingRequest.count({ where: { status: "VALIDEE" } }),
      db.meetingRequest.count({ where: { status: "TRAITEE" } }),
      db.meetingRequest.count({ where: { status: "ARCHIVEE" } }),
      db.meetingRequest.count({
        where: { urgency: "urgente", status: { in: ["RECUE", "TRANSMISE"] } },
      }),
      db.meetingRequest.count({
        where: { servantCode: "pam", status: { in: ["RECUE", "TRANSMISE"] } },
      }),
      db.meetingRequest.count({
        where: { servantCode: "kongo", status: { in: ["RECUE", "TRANSMISE"] } },
      }),
      db.ministryAnnouncement.count({ where: { isPublished: true } }),
      db.ministryAnnouncement.count({ where: { isPublished: false } }),
      db.meetingRequest.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          requesterName: true,
          servantCode: true,
          subject: true,
          urgency: true,
          status: true,
          createdAt: true,
        },
      }),
      db.ministryAnnouncement.findMany({
        take: 5,
        where: { isPublished: true },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          title: true,
          category: true,
          publishedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      demandes: {
        recues,
        transmises,
        validees,
        traitees,
        archivees,
        urgentesAttente,
        pourPam,
        pourKongo,
      },
      annonces: { publiees: annoncesPubliees, brouillons: annoncesBrouillons },
      dernieresDemandes,
      dernieresAnnonces,
    });
  } catch (error) {
    console.error("[secretariat/api/stats] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des statistiques" },
      { status: 500 }
    );
  }
}
