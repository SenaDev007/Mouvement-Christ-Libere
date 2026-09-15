import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDonsTables } from "@/lib/ensure-schema";
import { retenterVerificationDon } from "@/lib/payments/recuperation-dons";

/**
 * ⭐ V3.82/V3.87 — GET /api/dons/statut/[reference]
 *
 * Consulté par la page /contribuer/merci : elle lit le statut RÉEL en
 * base (mis à jour par le webhook signé ou la confirmation serveur),
 * jamais un paramètre d'URL.
 *
 * ⭐ V3.87 — AUTO-GUÉRISON : pour un don FedaPay encore « pending », le
 * serveur re-vérifie LUI-MÊME auprès de FedaPay (clé secrète, montant
 * exact exigé — le navigateur ne fait jamais foi) AVANT de répondre.
 * Concrètement : dès que FedaPay connaît le paiement comme approuvé, le
 * don est finalisé (trésorerie + reçu) et cette route renvoie « approved »
 * — la page merci bascule aussitôt, SANS dépendre du webhook (qui n'est
 * pas toujours envoyé — constat Academia-Helm). Throttle 8 s par don
 * (colonne providerVerifiedAt) : le polling 4 s de la page n'excède jamais
 * un appel FedaPay toutes les 8 s.
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

    let don = await db.donation.findUnique({
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

    // ⭐ V3.87 — Don FedaPay encore en attente : re-vérification serveur
    // autoritaire (throttlée) avant de répondre — si FedaPay a approuvé le
    // paiement entre-temps, le don est finalisé ICI et la page merci
    // affiche directement le succès (modèle Academia-Helm : tout est direct).
    if (
      don.provider === "fedapay" &&
      don.statut === "pending" &&
      Date.now() - don.createdAt.getTime() < 30 * 60 * 1000
    ) {
      await retenterVerificationDon(reference, "statut");
      don = await db.donation.findUnique({
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
