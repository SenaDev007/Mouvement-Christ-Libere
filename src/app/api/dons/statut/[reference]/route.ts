import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDonsTables } from "@/lib/ensure-schema";

/**
 * ⭐ V3.82 — GET /api/dons/statut/[reference]
 *
 * Consulté par la page /contribuer/merci : elle lit le statut RÉEL en
 * base (mis à jour par le webhook signé), jamais un paramètre d'URL.
 *
 * ⚠️ Champs volontairement minimaux (aucune donnée personnelle) : le
 * donateur consulte sa propre référence, mais la réponse ne divulgue ni
 * l'email ni le nom — juste de quoi afficher la confirmation.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  if (!reference || !/^don_[a-z0-9]+_[a-f0-9]+$/i.test(reference)) {
    return NextResponse.json(
      { error: "Référence de don invalide." },
      { status: 400 }
    );
  }

  try {
    await ensureDonsTables();

    const don = await db.donation.findUnique({
      where: { reference },
      select: {
        reference: true,
        statut: true,
        amount: true,
        currency: true,
        typeDon: true,
        provider: true,
        createdAt: true,
      },
    });

    if (!don) {
      return NextResponse.json({ error: "Don introuvable." }, { status: 404 });
    }

    return NextResponse.json(
      {
        reference: don.reference,
        statut: don.statut,
        montant: don.amount,
        devise: don.currency,
        type_don: don.typeDon,
        provider: don.provider,
        date: don.createdAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[dons/statut] Erreur :", e);
    return NextResponse.json(
      { error: "Erreur de consultation du statut." },
      { status: 500 }
    );
  }
}
