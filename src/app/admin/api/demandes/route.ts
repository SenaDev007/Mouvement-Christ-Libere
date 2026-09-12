import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, resoudreCodeServiteur } from "@/lib/staff-space/session";

/**
 * ⭐ V3.74 — GET /admin/api/demandes — Module de RÉCEPTION des demandes
 * de rencontre, côté serviteurs de Dieu (back-office /admin/demandes).
 *
 * La secrétaire TRANSMET une demande (espace Secrétariat) → elle atterrit
 * directement ici, pré-remplie, pour le serviteur concerné : Pasteur Kongo
 * / Sœur Pam la lisent, la VALIDENT, la marquent traitée.
 *
 * Résolution du serviteur : depuis le NOM du compte connecté (contient
 * « kongo » ou « pam ») — le pasteur Congo voit ses demandes, la sœur Pam
 * les siennes. Un compte SUPER_ADMIN non rattaché voit tout (secours).
 *
 * ⚠️ Rôles : SUPER_ADMIN (les deux serviteurs de Dieu — données
 * personnelles des demandeurs).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ["SUPER_ADMIN"]);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

    const url = new URL(request.url);
    // Filtre explicite (« pam », « kongo ») ; sinon le serviteur résolu ;
    // « tous » force la vue complète (compte non rattaché).
    const filtre = url.searchParams.get("servant") || "";
    const monCode = await resoudreCodeServiteur(userId);
    const codeFinal =
      filtre === "tous" ? null : filtre || monCode || null;

    const where = {
      status: { in: ["TRANSMISE", "VALIDEE"] as string[] },
      ...(codeFinal ? { servantCode: codeFinal } : {}),
    };

    const [items, enAttente, validees] = await Promise.all([
      db.meetingRequest.findMany({
        where,
        orderBy: [{ transmittedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
      db.meetingRequest.count({
        where: {
          ...(codeFinal ? { servantCode: codeFinal } : {}),
          status: "TRANSMISE",
        },
      }),
      db.meetingRequest.count({
        where: {
          ...(codeFinal ? { servantCode: codeFinal } : {}),
          status: "VALIDEE",
        },
      }),
    ]);

    return NextResponse.json({
      items,
      monServiteur: monCode,
      compteur: { enAttente, validees },
    });
  } catch (error) {
    console.error("[admin/api/demandes] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des demandes" },
      { status: 500 }
    );
  }
}
