import { NextRequest, NextResponse } from "next/server";
import {
  fedapayWebhookConfigure,
  verifierSignatureFedapay,
} from "@/lib/payments/fedapay.service";
import {
  extraireReferenceDescription,
  journaliserWebhook,
  StatutFinal,
  traiterEvenementDon,
} from "@/lib/payments/dons-webhook";

/**
 * ⭐ V3.82 — POST /api/webhooks/fedapay
 *
 * Réception des événements de paiement FedaPay (canal local — Afrique
 * de l'Ouest). URL à déclarer dans le dashboard FedaPay :
 *   https://www.mouvementchristlibere.com/api/webhooks/fedapay
 *
 * Sécurité (spécification — non négociable) :
 *   ① signature vérifiée AVANT toute écriture en base : l'en-tête
 *      X-FEDAPAY-SIGNATURE porte le HMAC-SHA256 du corps brut, calculé
 *      avec FEDAPAY_WEBHOOK_SECRET — requête sans signature valide :
 *      401, jamais traitée ;
 *   ② c'est LE SEUL endroit qui fait passer un don à « approved » ;
 *   ③ idempotence garantie par la transition atomique pending → final
 *      (traiterEvenementDon) : un doublon de webhook ne duplique ni
 *      l'écriture trésorerie ni l'email de reçu ;
 *   ④ chaque événement est journalisé dans WebhookLog.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Événements FedaPay menant à un statut final. */
function statutFinalFedaPay(nomEvenement: string): StatutFinal {
  switch (nomEvenement) {
    case "transaction.approved":
      return "approved";
    case "transaction.declined":
    case "transaction.canceled":
    case "transaction.failed":
      return "failed";
    default:
      return null; // transaction.created, refund… → ignoré (journalisé)
  }
}

export async function POST(request: NextRequest) {
  const corpsBrut = await request.text();
  const signature = request.headers.get("x-fedapay-signature");

  // ① Signature : aucun traitement tant qu'elle n'est pas prouvée.
  if (!fedapayWebhookConfigure()) {
    console.error(
      "[webhooks/fedapay] Rejet : FEDAPAY_WEBHOOK_SECRET absent — configurez-le (Vercel) puis redéclarez le webhook dans le dashboard FedaPay."
    );
    await journaliserWebhook({
      provider: "fedapay",
      event: "(secret absent)",
      statut: "SIGNE_INVALIDE",
      erreur: "FEDAPAY_WEBHOOK_SECRET non configuré",
      corpsBrut,
    });
    return NextResponse.json(
      { error: "Webhook non vérifiable (secret serveur absent)." },
      { status: 503 }
    );
  }
  if (!verifierSignatureFedapay(corpsBrut, signature)) {
    await journaliserWebhook({
      provider: "fedapay",
      event: "(signature invalide)",
      statut: "SIGNE_INVALIDE",
      erreur: signature
        ? "HMAC-SHA256 non conforme"
        : "en-tête X-FEDAPAY-SIGNATURE manquant",
      corpsBrut,
    });
    return NextResponse.json(
      { error: "Signature invalide." },
      { status: 401 }
    );
  }

  // ② Lecture du payload propre à FedaPay.
  let evenement: {
    name?: string;
    entity?: {
      id?: number | string;
      description?: string;
      custom_metadata?: { reference?: string };
    };
  };
  try {
    evenement = JSON.parse(corpsBrut);
  } catch {
    await journaliserWebhook({
      provider: "fedapay",
      event: "(corps invalide)",
      statut: "CORPS_INVALIDE",
      corpsBrut,
    });
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 }
    );
  }

  const nomEvenement = evenement.name || "(sans nom)";
  const entite = evenement.entity || {};
  const reference =
    entite.custom_metadata?.reference ||
    extraireReferenceDescription(entite.description) ||
    null;
  const providerRef =
    entite.id !== undefined && entite.id !== null
      ? String(entite.id)
      : null;

  // ③ Machine à états partagée (transition atomique + trésorerie + reçu).
  const resultat = await traiterEvenementDon({
    provider: "fedapay",
    evenement: nomEvenement,
    reference,
    providerRef,
    statutFinal: statutFinalFedaPay(nomEvenement),
    corpsBrut,
  });

  return NextResponse.json(
    resultat.code === "TRAITE" || resultat.code === "IGNORE"
      ? { ok: true, code: resultat.code }
      : { ok: false, code: resultat.code },
    { status: resultat.http }
  );
}
