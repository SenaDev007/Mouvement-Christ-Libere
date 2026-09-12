import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import {
  DEMANDE_STATUTS,
  DEMANDE_STATUT_VALEURS,
  DEMANDE_URGENCES,
  DEMANDE_URGENCE_VALEURS,
  SERVITEURS_RENDEZ_VOUS,
  SERVITEUR_CODES,
} from "@/lib/staff-space/constants";
import { genererCodeSuiviUnique } from "@/lib/staff-space/multicaisse";

/**
 * ⭐ V3.66/V3.67 — Secrétariat : demandes de rencontre.
 *
 *   GET   /secretariat/api/demandes?statut=&servant=&urgence=&q=&limit=&offset=
 *         — registre filtrable (toutes les demandes, tous statuts) ;
 *         — &format=csv : export CSV complet des demandes FILTRÉES
 *           (BOM UTF-8 pour Excel — V3.67 gap « pas d'export CSV »).
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
    const format = url.searchParams.get("format") || "";
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
      format === "csv"
        ? db.meetingRequest.findMany({ where, orderBy: [{ createdAt: "desc" }] })
        : db.meetingRequest.findMany({
            where,
            orderBy: [{ createdAt: "desc" }],
            take: limit,
            skip: offset,
          }),
      db.meetingRequest.count({ where }),
    ]);

    // ⭐ V3.67 — Export CSV (filtres actifs, toutes les lignes).
    if (format === "csv") {
      const separer = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lignes: string[] = [];
      lignes.push(
        [
          "Déposée le",
          "Source",
          "Statut",
          "Code de suivi",
          "Demandeur",
          "Contact",
          "Serviteur",
          "Objet",
          "Urgence",
          "Pays",
          "Ville",
          "Transmise le",
          "Validée le",
          "Traitée le",
        ]
          .map(separer)
          .join(";")
      );
      for (const d of items as typeof items & { transmittedAt?: Date | null; processedAt?: Date | null; validatedAt?: Date | null; source?: string; trackingCode?: string | null; urgency?: string; country?: string | null; city?: string | null }[]) {
        lignes.push(
          [
            new Date(d.createdAt).toISOString().substring(0, 10),
            d.source === "SITE" ? "Site public" : "Présentiel",
            DEMANDE_STATUTS[d.status as keyof typeof DEMANDE_STATUTS]?.libelle ?? d.status,
            d.trackingCode || "",
            d.requesterName,
            d.contact,
            SERVITEURS_RENDEZ_VOUS[d.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS]?.libelle ?? d.servantCode,
            d.subject,
            DEMANDE_URGENCES[d.urgency as keyof typeof DEMANDE_URGENCES]?.libelle ?? d.urgency,
            d.country || "",
            d.city || "",
            d.transmittedAt ? new Date(d.transmittedAt).toISOString().substring(0, 10) : "",
            d.validatedAt ? new Date(d.validatedAt).toISOString().substring(0, 10) : "",
            d.processedAt ? new Date(d.processedAt).toISOString().substring(0, 10) : "",
          ]
            .map((v) => separer(String(v)))
            .join(";")
        );
      }
      const csv = "\uFEFF" + lignes.join("\r\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="registre-demandes-${new Date()
            .toISOString()
            .substring(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

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

    // ⭐ V3.67 — code de suivi remis à la demanderesse ou demandeur.
    const codeSuivi = await genererCodeSuiviUnique();

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
        // ⭐ V3.74 — origine MANUEL : saisie présentiel / téléphone (la
        // ré-édition du modal est réservée à ce cas ; les demandes du site
        // public arrivent pré-remplies avec source SITE).
        source: "MANUEL",
        handledById: userId,
        trackingCode: codeSuivi,
      },
    });

    // Gouvernance : trace de la saisie manuelle.
    try {
      await db.auditLog.create({
        data: {
          action: "DEMANDE_CREATE",
          userId,
          targetId: nouvelle.id,
          metadata: {
            demandeur: nouvelle.requesterName,
            serviteur: servantCode,
            canal: "saisie secrétariat",
            codeSuivi,
          },
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/demandes] AuditLog impossible :", e);
    }

    return NextResponse.json({ item: nouvelle }, { status: 201 });
  } catch (error) {
    console.error("[secretariat/api/demandes] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la demande" },
      { status: 500 }
    );
  }
}
