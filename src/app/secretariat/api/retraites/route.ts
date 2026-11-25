import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";

/**
 * ⭐ V4.43 — GET /secretariat/api/retraites — Registre des demandes de
 * retraite spirituelle (espace Secrétariat).
 *
 * Filtres :
 *   · statut  = SOUMISE | EN_EXAMEN | ACCEPTEE | REJETEE (ou absent = tous) ;
 *   · q       = recherche (nom, prénom, code de suivi, téléphone, ville) ;
 *   · limit / offset = pagination (limit plafonné à 200) ;
 *   · format=csv     = export complet des lignes filtrées (BOM UTF-8, « ; »).
 *
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN (même garde que /secretariat/api/demandes).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STATUTS_RETRAITE = ["SOUMISE", "EN_EXAMEN", "ACCEPTEE", "REJETEE"] as const;

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const { searchParams } = new URL(request.url);
    const statut = (searchParams.get("statut") || "").trim().toUpperCase();
    const q = (searchParams.get("q") || "").trim();
    const format = (searchParams.get("format") || "").trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10) || 25, 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

    const where: Record<string, unknown> = {};
    if ((STATUTS_RETRAITE as readonly string[]).includes(statut)) {
      where.status = statut;
    }
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { trackingCode: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
      ];
    }

    // ── Export CSV (même mécanique que les demandes de rencontre) ──
    if (format === "csv") {
      const lignes = await db.retreatRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      const entetes = [
        "Code de suivi",
        "Prénom",
        "Nom",
        "Genre",
        "Email",
        "Téléphone",
        "Pays",
        "Ville",
        "Adresse",
        "Profession",
        "Situation matrimoniale",
        "Contact d'urgence",
        "Arrivée souhaitée",
        "Jours",
        "Déjà venu",
        "Moyen de paiement",
        "Statut",
        "Origine",
        "Motif/attentes",
        "Décision (précisions)",
        "Déposée le",
      ];
      const echapper = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const corps = lignes.map((d) =>
        [
          d.trackingCode,
          d.firstName,
          d.lastName,
          d.gender,
          d.email,
          d.phone,
          d.country,
          d.city,
          d.address,
          d.profession,
          d.maritalStatus,
          d.emergencyContact,
          d.arrivalDate ? d.arrivalDate.toISOString().slice(0, 10) : "",
          d.numberOfDays,
          d.hasBeenBefore ? "oui" : "non",
          d.paymentMethod,
          d.status,
          d.source,
          d.expectations,
          d.decisionReason,
          d.createdAt.toISOString(),
        ]
          .map(echapper)
          .join(";")
      );
      const csv =
        "\uFEFF" + entetes.map(echapper).join(";") + "\n" + corps.join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="retraites-spirituelles.csv"`,
        },
      });
    }

    const [items, total] = await Promise.all([
      db.retreatRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.retreatRequest.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  } catch (error) {
    console.error("[secretariat/api/retraites] GET :", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des demandes de retraite." },
      { status: 500 }
    );
  }
}
