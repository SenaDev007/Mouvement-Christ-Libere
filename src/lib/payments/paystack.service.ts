/**
 * ⭐ V3.82 — Wrapper Paystack (paiement international).
 *
 * Couverture : cartes Visa / Mastercard émises n'importe où dans le
 * monde — règlement en XOF.
 *
 * Implémentation REST native (fetch) : aucune dépendance SDK. Les clés ne
 * vivent QUE côté serveur (variables d'environnement).
 *
 * Variables d'environnement :
 *   PAYSTACK_SECRET_KEY      sk_live_xxx | sk_test_xxx (requis)
 *   PAYSTACK_WEBHOOK_SECRET  secret du HMAC (défaut : PAYSTACK_SECRET_KEY)
 *
 * Ce service ne connaît PAS FedaPay — le routage passe par
 * /api/dons/initier (payment-types.ts est le seul terrain partagé).
 */

import {
  createHmac,
  timingSafeEqual,
} from "crypto";
import {
  DemandeDon,
  ErreurPasserelle,
  TransactionDon,
  urlSite,
} from "./payment-types";

const API_PAYSTACK = "https://api.paystack.co";
const TIMEOUT_MS = 20_000;

/** Vrai si la clé secrète Paystack est configurée. */
export function paystackConfigure(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/** Nom de la variable manquante (message d'aide pour l'administrateur). */
export const PAYSTACK_CLE_ENV = "PAYSTACK_SECRET_KEY";

/**
 * Initialise la transaction chez Paystack.
 *
 * POST /transaction/initialize — notre référence interne est transmise
 * telle quelle : Paystack la répétera dans le webhook (charge.success →
 * data.reference), c'est la clé de rapprochement la plus fiable.
 *
 * ⚠️ Paystack attend le montant en SOUS-UNITÉ (×100), même pour XOF —
 * un don de 10 000 FCFA part avec amount = 1 000 000.
 */
export async function initialiserTransactionPaystack(
  demande: DemandeDon,
  reference: string
): Promise<TransactionDon> {
  const cle = process.env.PAYSTACK_SECRET_KEY;
  if (!cle) {
    throw new ErreurPasserelle(
      "La passerelle Paystack n'est pas encore configurée (PAYSTACK_SECRET_KEY absente)."
    );
  }

  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), TIMEOUT_MS);

  try {
    const reponse = await fetch(
      `${API_PAYSTACK}/transaction/initialize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cle}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference,
          amount: demande.montant * 100, // sous-unité (centimes)
          currency: demande.devise,
          email: demande.email.trim(),
          callback_url: `${urlSite()}/contribuer/merci?ref=${reference}`,
          metadata: {
            reference,
            type_don: demande.type_don,
            ...(demande.nom ? { nom: demande.nom.slice(0, 80) } : {}),
          },
        }),
        signal: controle.signal,
      }
    );

    const corps = (await reponse.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    };

    if (!reponse.ok || !corps.status) {
      throw new ErreurPasserelle(
        corps.message ||
          `Paystack a refusé la requête (${reponse.status}).`,
        `HTTP_${reponse.status}`
      );
    }

    const paymentUrl = corps.data?.authorization_url;
    if (!paymentUrl) {
      throw new ErreurPasserelle(
        "Paystack n'a pas renvoyé d'URL de paiement."
      );
    }

    return {
      reference,
      provider: "paystack",
      // L'id numérique de transaction n'est connu qu'au webhook :
      // le rapprochement se fait par référence (notre clé, répétée).
      providerRef: corps.data?.reference || null,
      paymentUrl,
    };
  } catch (e) {
    if (e instanceof ErreurPasserelle) throw e;
    const abort = e instanceof Error && e.name === "AbortError";
    throw new ErreurPasserelle(
      abort
        ? "Paystack n'a pas répondu à temps (20 s) — réessayez."
        : `Impossible de joindre Paystack : ${
            e instanceof Error ? e.message : String(e)
          }`
    );
  } finally {
    clearTimeout(minuteur);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Webhook — vérification de signature
// ─────────────────────────────────────────────────────────────────────

/**
 * Vérifie la signature d'un webhook Paystack.
 *
 * L'en-tête `x-paystack-signature` porte le HMAC-SHA512 (hex) du corps
 * BRUT de la requête, calculé avec la clé secrète du compte
 * (PAYSTACK_WEBHOOK_SECRET — par convention : la PAYSTACK_SECRET_KEY).
 * Comparaison à temps constant — jamais traité si non conforme.
 */
export function verifierSignaturePaystack(
  corpsBrut: string,
  signatureEnTete: string | null
): boolean {
  const secret =
    process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return false;
  if (!signatureEnTete) return false;

  const attendu = createHmac("sha512", secret)
    .update(corpsBrut, "utf8")
    .digest("hex");
  const recu = signatureEnTete.trim().toLowerCase();

  if (attendu.length !== recu.length) return false;
  try {
    return timingSafeEqual(Buffer.from(attendu, "utf8"), Buffer.from(recu, "utf8"));
  } catch {
    return false;
  }
}

/** Vrai si la clé de vérification de webhook Paystack est disponible. */
export function paystackWebhookConfigure(): boolean {
  return Boolean(
    process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY
  );
}
