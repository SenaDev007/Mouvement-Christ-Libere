import { NextRequest, NextResponse } from "next/server";
import {
  paystackWebhookConfigure,
  verifierSignaturePaystack,
} from "@/lib/payments/paystack.service";
import {
  journaliserWebhook,
  StatutFinal,
  traiterEvenementDon,
} from "@/lib/payments/dons-webhook";

/**
 * ⭐ V3.82 — POST /api/webhooks/paystack
 *
 * Réception des événements de paiement Paystack (canal international).
 * URL à déclarer dans le dashboard Paystack :
 *   https://www.mouvementchristlibere.com/api/webhooks/paystack
 *
 * Sécurité (spécification — non négociable) :
 *   ① signature vérifiée AVANT toute écriture en base : l'en-tête
 *      x-paystack-signature porte le HMAC-SHA512 du corps brut, calculé
 *      avec PAYSTACK_WEBHOOK_SECRET (par convention : la clé secrète du
 *      compte) — requête sans signature valide : 401, jamais traitée ;
 *   ② c'est LE SEUL endroit qui fait passer un don à « approved » ;
 *   ③ idempotence garantie par la transition atomique pending → final
 *      (traiterEvenementDon) : un doublon de webhook ne duplique ni
 *      l'écriture trésorerie ni l'email de reçu ;
 *   ④ chaque événement est journalisé dans WebhookLog.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Événements Paystack menant à un statut final. */
function statutFinalPaystack(nomEvenement: string): StatutFinal {
  switch (nomEvenement) {
    case "charge.success":
      return "approved";
    case "charge.failed":
      return "failed";
    default:
      return null; // transfer.*, refund… → ignoré (journalisé)
  }
}

export async function POST(request: NextRequest) {
  const corpsBrut = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  // ① Signature : aucun traitement tant qu'elle n'est pas prouvée.
  // ⭐ V3.83 — Secret résolu depuis le back-office (/admin/paiements)
  // avec repli sur PAYSTACK_WEBHOOK_SECRET (par convention : la clé du compte).
  if (!(await paystackWebhookConfigure())) {
    console.error(
      "[webhooks/paystack] Rejet : secret absent — configurez la clé depuis le back-office (/admin/paiements) ou via PAYSTACK_SECRET_KEY, puis déclarez le webhook dans le dashboard Paystack."
    );
    await journaliserWebhook({
      provider: "paystack",
      event: "(secret absent)",
      statut: "SIGNE_INVALIDE",
      erreur: "clé/secret Paystack non configuré (back-office ni environnement)",
      corpsBrut,
    });
    return NextResponse.json(
      { error: "Webhook non vérifiable (secret serveur absent)." },
      { status: 503 }
    );
  }
  if (!(await verifierSignaturePaystack(corpsBrut, signature))) {
    await journaliserWebhook({
      provider: "paystack",
      event: "(signature invalide)",
      statut: "SIGNE_INVALIDE",
      erreur: signature
        ? "HMAC-SHA512 non conforme"
        : "en-tête x-paystack-signature manquant",
      corpsBrut,
    });
    return NextResponse.json(
      { error: "Signature invalide." },
      { status: 401 }
    );
  }

  // ② Lecture du payload propre à Paystack.
  let evenement: {
    event?: string;
    data?: {
      id?: number | string;
      reference?: string;
      amount?: number;
      currency?: string;
      status?: string;
    };
  };
  try {
    evenement = JSON.parse(corpsBrut);
  } catch {
    await journaliserWebhook({
      provider: "paystack",
      event: "(corps invalide)",
      statut: "CORPS_INVALIDE",
      corpsBrut,
    });
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 }
    );
  }

  const nomEvenement = evenement.event || "(sans nom)";
  const donnees = evenement.data || {};
  const reference = donnees.reference || null;
  const providerRef =
    donnees.id !== undefined && donnees.id !== null
      ? String(donnees.id)
      : null;

  // ③ Machine à états partagée (transition atomique + trésorerie + reçu).
  const resultat = await traiterEvenementDon({
    provider: "paystack",
    evenement: nomEvenement,
    reference,
    providerRef,
    statutFinal: statutFinalPaystack(nomEvenement),
    corpsBrut,
  });

  return NextResponse.json(
    resultat.code === "TRAITE" || resultat.code === "IGNORE"
      ? { ok: true, code: resultat.code }
      : { ok: false, code: resultat.code },
    { status: resultat.http }
  );
}
