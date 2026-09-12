import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import { DEMANDE_STATUT_VALEURS } from "@/lib/staff-space/constants";
import {
  genererRegistreDemandes,
  genererRegistreAnnonces,
  enTetesPdf,
} from "@/lib/staff-space/pdf/documents";

/**
 * ⭐ V3.66 — POST /secretariat/api/rapports
 *
 * Génère le registre PDF du secrétariat :
 *   { type: "demandes", du, au, statut? } → registre des demandes ;
 *   { type: "annonces", du, au }          → registre des annonces.
 *
 * Réponse : binaire application/pdf (téléchargement direct).
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const body = await request.json();
    const { type, du, au, statut } = body as {
      type?: string;
      du?: string;
      au?: string;
      statut?: string;
    };

    const dateDu = parseDate(du) || new Date(Date.now() - 90 * 86400_000);
    // Fin de journée incluse.
    const dateAu = parseDate(au)
      ? new Date(parseDate(au)!.getTime() + 86_399_000)
      : new Date();
    if (dateAu < dateDu) {
      return NextResponse.json(
        { error: "La date de fin précède la date de début." },
        { status: 400 }
      );
    }

    let pdf: Uint8Array;
    let nomFichier: string;

    if (type === "demandes") {
      const statutFiltre =
        statut && DEMANDE_STATUT_VALEURS.includes(statut) ? statut : undefined;
      const where: Record<string, unknown> = {
        createdAt: { gte: dateDu, lte: dateAu },
      };
      if (statutFiltre) where.status = statutFiltre;

      const demandes = await db.meetingRequest.findMany({
        where,
        orderBy: { createdAt: "asc" },
      });

      pdf = await genererRegistreDemandes(demandes, {
        du: dateDu,
        au: dateAu,
        statut: statutFiltre,
      });
      nomFichier = `registre-demandes-${du || "periode"}.pdf`;
    } else if (type === "annonces") {
      const annonces = await db.ministryAnnouncement.findMany({
        where: {
          OR: [
            { publishedAt: { gte: dateDu, lte: dateAu } },
            { isPublished: false, createdAt: { gte: dateDu, lte: dateAu } },
          ],
        },
        orderBy: { createdAt: "asc" },
      });

      pdf = await genererRegistreAnnonces(annonces, { du: dateDu, au: dateAu });
      nomFichier = `registre-annonces-${du || "periode"}.pdf`;
    } else {
      return NextResponse.json(
        { error: "Type de rapport invalide (demandes | annonces)" },
        { status: 400 }
      );
    }

    // ⚠️ copyOnce : NextResponse avec Buffer — le cast évite le problème de
    // BodyInit typé (Uint8Array est accepté au runtime).
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        ...enTetesPdf(),
        "Content-Disposition": `attachment; filename="${nomFichier}"`,
      },
    });
  } catch (error) {
    console.error("[secretariat/api/rapports] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du rapport" },
      { status: 500 }
    );
  }
}
