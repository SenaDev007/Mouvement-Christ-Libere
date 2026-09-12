import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import {
  DEMANDE_STATUT_VALEURS,
  DEMANDE_URGENCE_VALEURS,
  SERVITEUR_CODES,
} from "@/lib/staff-space/constants";

/**
 * ⭐ V3.66 — Secrétariat : demandes de rencontre.
 *
 *   GET   /secretariat/api/demandes?statut=&servant=&urgency=&limit=&offset=
 *         — registre filtrable (toutes les demandes, tous statuts).
 *   POST  /secretariat/api/demandes
 *         — saisie MANUELLE par la secrétaire d'une demande reçue par
 *           téléphone / WhatsApp / en personne (le canal public /rendez-vous
 *           écrit directement en base via /api/rendez-vous).
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

    const url = new URL(request.url);
    const statut = url.searchParams.get("statut") || "";
    const servant = url.searchParams.get("servant") || "";
    const urgency = url.searchParams.get("urgence") || "";
    const recherche = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (statut && DEMANDE_STATUT_VALEURS.includes(statut)) where.status = statut;
    if (servant && SERVITEUR_CODES.includes(servant)) where.servantCode = servant;
    if (urgency && DEMANDE_URGENCE_VALEURS.includes(urgency)) where.urgency = urgency;
    if (recherche) {
      where.OR = [
        { requesterName: { contains: recherche, mode: "insensitive" } },
        { subject: { contains: recherche, mode: "insensitive" } },
        { contact: { contains: recherche, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.meetingRequest.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      db.meetingRequest.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  } catch (error) {
    console.error("[secretariat/api/demandes] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des demandes" },
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
      requesterName,
      contact,
      servantCode,
      subject,
      message,
      urgency,
      country,
      city,
    } = body as {
      requesterName?: string;
      contact?: string;
      servantCode?: string;
      subject?: string;
      message?: string;
      urgency?: string;
      country?: string;
      city?: string;
    };

    if (!requesterName?.trim() || !contact?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Nom, contact, objet et message sont requis" },
        { status: 400 }
      );
    }
    if (!servantCode || !SERVITEUR_CODES.includes(servantCode)) {
      return NextResponse.json(
        { error: "Serviteur demandé invalide (pam ou kongo)" },
        { status: 400 }
      );
    }
    const urgenceFinale = urgency && DEMANDE_URGENCE_VALEURS.includes(urgency) ? urgency : "normale";

    const nouvelle = await db.meetingRequest.create({
      data: {
        requesterName: requesterName.trim().substring(0, 120),
        contact: contact.trim().substring(0, 160),
        servantCode,
        subject: subject.trim().substring(0, 200),
        message: message.trim().substring(0, 5000),
        urgency: urgenceFinale,
        country: country?.trim()?.substring(0, 60) || null,
        city: city?.trim()?.substring(0, 60) || null,
        status: "RECUE",
        handledById: userId,
      },
    });

    return NextResponse.json({ item: nouvelle }, { status: 201 });
  } catch (error) {
    console.error("[secretariat/api/demandes] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la demande" },
      { status: 500 }
    );
  }
}
