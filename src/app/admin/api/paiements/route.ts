import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigerSession } from "@/lib/staff-space/session";
import {
  enregistrerConfigPasserelle,
  lireEtatPasserelles,
} from "@/lib/payments/gateway-config";
import { testerConnexionFedapay } from "@/lib/payments/fedapay.service";
import { testerConnexionPaystack } from "@/lib/payments/paystack.service";
import { PROVIDERS_VALEURS, ProviderId, urlSite } from "@/lib/payments/payment-types";

/**
 * ⭐ V3.83 — /admin/api/paiements : configuration des passerelles de
 * paiement depuis le back-office (directive : « les administrateurs
 * Pastor Congo et Afrika doivent pouvoir paramétrer FedaPay et Paystack,
 * toutes les clés API et webhooks »).
 *
 *   · GET  — état des deux passerelles (clés MASQUÉES — jamais renvoyées) ;
 *   · PUT  — enregistrement (chiffrement AES-256-GCM + audit + cache
 *            invalidé immédiatement) ;
 *   · POST — test de connexion (lecture légère chez le fournisseur :
 *            aucune écriture, aucun paiement créé).
 *
 * Garde : SUPER_ADMIN (les deux serviteurs de Dieu) — exigerSession
 * répond lui-même en 401/403 JSON (le proxy laisse passer cette route
 * sans redirection : ADMIN_API_AVEC_GARDE_PROPRE).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ["SUPER_ADMIN"]);
  if ("reponse" in garde) return garde.reponse;

  try {
    const etats = await lireEtatPasserelles();
    return NextResponse.json({
      etats,
      webhooks: {
        fedapay: `${urlSite()}/api/webhooks/fedapay`,
        paystack: `${urlSite()}/api/webhooks/paystack`,
      },
    });
  } catch (e) {
    console.error("[admin/api/paiements] GET :", e);
    return NextResponse.json(
      { error: "Lecture de la configuration impossible." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const garde = exigerSession(request, ["SUPER_ADMIN"]);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  let corps: {
    provider?: string;
    activee?: boolean;
    environment?: string;
    secretKey?: string;
    publicKey?: string;
    webhookSecret?: string;
  };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 }
    );
  }

  // ── Validations ──
  const provider = corps.provider as ProviderId;
  if (!provider || !PROVIDERS_VALEURS.includes(provider)) {
    return NextResponse.json(
      { error: "Passerelle inconnue (fedapay ou paystack attendu)." },
      { status: 400 }
    );
  }
  const environment = corps.environment === "live" ? "live" : "sandbox";
  // ⚠️ Paystack : la « case » environnement est indicative (sk_test_ / sk_live_)
  // mais la cohérence du préfixe est vérifiée à l'enregistrement.

  try {
    const resultat = await enregistrerConfigPasserelle({
      provider,
      activee: corps.activee === true,
      environment,
      secretKey: typeof corps.secretKey === "string" ? corps.secretKey : null,
      // ⭐ V3.85 — clé publique (widget FedaPay) : chaîne vide = retrait
      // explicite ; absence = conservation.
      publicKey:
        typeof corps.publicKey === "string" ? corps.publicKey : undefined,
      webhookSecret:
        typeof corps.webhookSecret === "string" ? corps.webhookSecret : null,
      par: userId,
    });

    if (!resultat.ok) {
      return NextResponse.json({ error: resultat.erreur }, { status: 400 });
    }

    // ⭐ Gouvernance : trace d'audit (JAMAIS le secret lui-même).
    try {
      await db.auditLog.create({
        data: {
          action: "PAIEMENTS_CONFIG",
          userId,
          targetId: provider,
          metadata: {
            passerelle: provider,
            activee: corps.activee === true,
            environnement: environment,
            cleMasquee: resultat.masque,
            cleFournie: typeof corps.secretKey === "string" && corps.secretKey.trim().length > 0,
            clePubliqueFournie:
              typeof corps.publicKey === "string" && corps.publicKey.trim().length > 0,
            webhookFourni:
              typeof corps.webhookSecret === "string" && corps.webhookSecret.trim().length > 0,
          } as never,
        },
      });
    } catch (e) {
      console.warn("[admin/api/paiements] AuditLog impossible :", e);
    }

    // État frais (cache invalidé par l'enregistrement).
    const etats = await lireEtatPasserelles();
    return NextResponse.json({
      ok: true,
      masque: resultat.masque,
      etats,
    });
  } catch (e) {
    console.error("[admin/api/paiements] PUT :", e);
    return NextResponse.json(
      { error: "Enregistrement impossible — réessayez dans un instant." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ["SUPER_ADMIN"]);
  if ("reponse" in garde) return garde.reponse;

  let corps: {
    provider?: string;
    secretKey?: string;
    environment?: string;
  };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 }
    );
  }

  const provider = corps.provider as ProviderId;
  if (!provider || !PROVIDERS_VALEURS.includes(provider)) {
    return NextResponse.json(
      { error: "Passerelle inconnue (fedapay ou paystack attendu)." },
      { status: 400 }
    );
  }

  // Test en lecture seule — la clé du champ (non enregistrée) si fournie,
  // sinon la clé effective (back-office puis environnement).
  const resultat =
    provider === "fedapay"
      ? await testerConnexionFedapay({
          cle: typeof corps.secretKey === "string" ? corps.secretKey : null,
          environment: corps.environment === "live" ? "live" : "sandbox",
        })
      : await testerConnexionPaystack(
          typeof corps.secretKey === "string" ? corps.secretKey : null
        );

  return NextResponse.json(resultat, { status: resultat.ok ? 200 : 400 });
}
