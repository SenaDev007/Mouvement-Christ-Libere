import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import { genererRecuDon, enTetesPdf } from "@/lib/staff-space/pdf/documents";

/**
 * ⭐ V3.67 — POST /tresorerie/api/rapports/recu/[id]
 *
 * Reçu de don PDF pour une RECETTE du journal (dons, offrandes, dîmes…) :
 * identification du donateur, montant, nature, méthode d'encaissement,
 * caisse, espace de signature du trésorier. Mention : document de
 * confirmation — pas un reçu fiscal.
 *
 * Réponse : binaire application/pdf (affichage navigateur).
 * ⚠️ Rôles : TREASURER, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

    const { id } = await params;
    const transaction = await db.treasuryTransaction.findUnique({
      where: { id },
    });
    if (!transaction) {
      return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 });
    }
    if (transaction.type !== "RECETTE") {
      return NextResponse.json(
        { error: "Un reçu ne peut être émis que pour une recette (don, offrande, dîme…)." },
        { status: 400 }
      );
    }

    // Nom de la caisse d'encaissement (facultatif).
    let caisseNom: string | null = null;
    if (transaction.caisseId) {
      const caisse = await db.treasuryCashAccount.findUnique({
        where: { id: transaction.caisseId },
        select: { name: true },
      });
      caisseNom = caisse?.name || null;
    }

    const pdf = await genererRecuDon({
      id: transaction.id,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      currency: transaction.currency,
      method: transaction.method,
      label: transaction.label,
      date: transaction.date,
      reference: transaction.reference,
      donorName: transaction.donorName,
      isAnonymous: transaction.isAnonymous,
      note: transaction.note,
      caisseNom,
    });

    // Gouvernance : trace de l'émission du reçu.
    try {
      await db.auditLog.create({
        data: {
          action: "TRESORERIE_RECU_PDF",
          userId,
          targetId: id,
          metadata: {
            montant: transaction.amount,
            devise: transaction.currency,
            donateur: transaction.isAnonymous
              ? "anonyme"
              : transaction.donorName || "non précisé",
          },
        },
      });
    } catch (e) {
      console.warn("[tresorerie/api/rapports/recu] AuditLog impossible :", e);
    }

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        ...enTetesPdf(),
        "Content-Disposition": `inline; filename="recu-don-${(transaction.reference || transaction.id).toUpperCase()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[tresorerie/api/rapports/recu] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du reçu" },
      { status: 500 }
    );
  }
}
