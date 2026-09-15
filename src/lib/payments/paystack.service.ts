/**
 * ⭐ V3.82/V3.83 — Wrapper Paystack (paiement international).
 *
 * Couverture : cartes Visa / Mastercard émises n'importe où dans le
 * monde — règlement en XOF.
 *
 * Implémentation REST native (fetch) : aucune dépendance SDK.
 *
 * ⭐ V3.83 — La configuration vient du BACK-OFFICE (/admin/paiements) :
 *   · lireConfigPasserelle("paystack") résout la clé (base chiffrée puis
 *     variables d'environnement en repli — PAYSTACK_SECRET_KEY,
 *     PAYSTACK_WEBHOOK_SECRET) ;
 *   · les clés ne vivent QUE côté serveur (jamais envoyées au client).
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
import { lireConfigPasserelle } from "./gateway-config";

const API_PAYSTACK = "https://api.paystack.co";
const TIMEOUT_MS = 20_000;

/** Vrai si la clé secrète Paystack est configurée (back-office ou env). */
export async function paystackConfigure(): Promise<boolean> {
  const config = await lireConfigPasserelle("paystack");
  return Boolean(config.secretKey);
}

/** Libellé d'aide (où configurer la passerelle). */
export const PAYSTACK_AIDE_CONFIG =
  "Clé à configurer depuis le back-office → Passerelles de paiement (/admin/paiements) ou variable PAYSTACK_SECRET_KEY (Vercel).";

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
  const config = await lireConfigPasserelle("paystack");
  const cle = config.secretKey;
  if (!cle) {
    throw new ErreurPasserelle(
      "La passerelle Paystack n'est pas encore configurée (aucune clé API — voir /admin/paiements)."
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

/**
 * ⭐ V3.83 — Test de connexion depuis /admin/paiements.
 * Interroge une route légère en lecture (GET /transaction, 1 par page) :
 * 200 + status true = la clé est acceptée. Aucune écriture, aucun coût.
 */
export async function testerConnexionPaystack(
  cleFournie?: string | null
): Promise<{ ok: boolean; message: string }> {
  const cle = cleFournie?.trim() || (await lireConfigPasserelle("paystack")).secretKey;
  if (!cle) {
    return {
      ok: false,
      message:
        "Aucune clé à tester — collez d'abord la clé secrète API puis enregistrez-la.",
    };
  }
  try {
    const reponse = await fetch(
      `${API_PAYSTACK}/transaction?perPage=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cle}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (reponse.ok) {
      return {
        ok: true,
        message: "Connexion réussie — Paystack accepte cette clé.",
      };
    }
    if (reponse.status === 401 || reponse.status === 403) {
      return {
        ok: false,
        message:
          "Paystack a refusé cette clé (401/403) — vérifiez la clé secrète du compte.",
      };
    }
    return {
      ok: false,
      message: `Paystack a répondu ${reponse.status} — réessayez dans un instant.`,
    };
  } catch (e) {
    return {
      ok: false,
      message: `Impossible de joindre Paystack : ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
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
 * (back-office /admin/paiements, ou PAYSTACK_WEBHOOK_SECRET en repli —
 * par convention : la PAYSTACK_SECRET_KEY).
 * Comparaison à temps constant — jamais traité si non conforme.
 */
export async function verifierSignaturePaystack(
  corpsBrut: string,
  signatureEnTete: string | null
): Promise<boolean> {
  const config = await lireConfigPasserelle("paystack");
  const secret = config.webhookSecret;
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

/** Vrai si la clé de vérification de webhook Paystack est disponible (back-office ou env). */
export async function paystackWebhookConfigure(): Promise<boolean> {
  const config = await lireConfigPasserelle("paystack");
  return Boolean(config.webhookSecret);
}
