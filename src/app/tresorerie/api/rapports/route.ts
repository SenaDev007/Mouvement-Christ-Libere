import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import { DEVISE_CODES } from "@/lib/staff-space/constants";
import { calculerSituationMulticaisse } from "@/lib/staff-space/multicaisse";
import { genererRapportFinancier, enTetesPdf } from "@/lib/staff-space/pdf/documents";

/**
 * ⭐ V3.66 — POST /tresorerie/api/rapports
 *
 * Rapport financier PDF (période + devise) :
 *  · synthèse (totaux recettes / dépenses / solde) ;
 *  · récapitulatif par catégorie ;
 *  · journal détaillé avec solde cumulé — ordre chronologique.
 *
 * Réponse : binaire application/pdf (téléchargement direct).
 * ⚠️ Rôles : TREASURER, SUPER_ADMIN.
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
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const body = await request.json();
    const { du, au, devise } = body as { du?: string; au?: string; devise?: string };

    const deviseFinale =
      devise && DEVISE_CODES.includes(devise) ? devise : "EUR";

    const dateDu = parseDate(du) || new Date(Date.now() - 90 * 86400_000);
    const dateAu = parseDate(au)
      ? new Date(parseDate(au)!.getTime() + 86_399_000)
      : new Date();
    if (dateAu < dateDu) {
      return NextResponse.json(
        { error: "La date de fin précède la date de début." },
        { status: 400 }
      );
    }

    const [transactions, caisses] = await Promise.all([
      db.treasuryTransaction.findMany({
        where: { currency: deviseFinale, date: { gte: dateDu, lte: dateAu } },
        orderBy: { date: "asc" },
      }),
      db.treasuryCashAccount.findMany({ select: { id: true, name: true } }),
    ]);

    // ⭐ V3.67 — noms des caisses sur chaque écriture (journal + transferts).
    const nomsCaisses = new Map(caisses.map((c) => [c.id, c.name]));
    const transactionsEnrichies = transactions.map((t) => ({
      ...t,
      caisseNom: t.caisseId ? nomsCaisses.get(t.caisseId) || null : null,
      caisseDestinationNom: t.caisseDestinationId
        ? nomsCaisses.get(t.caisseDestinationId) || null
        : null,
    }));

    // ⭐ V3.67 — situation multicaisse (section « Situation par caisse »).
    const situation = await calculerSituationMulticaisse();

    const pdf = await genererRapportFinancier(
      transactionsEnrichies,
      { du: dateDu, au: dateAu },
      deviseFinale,
      { caisses: situation.caisses }
    );

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        ...enTetesPdf(),
        "Content-Disposition": `attachment; filename="rapport-financier-${deviseFinale}-${du || "periode"}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[tresorerie/api/rapports] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du rapport" },
      { status: 500 }
    );
  }
}
