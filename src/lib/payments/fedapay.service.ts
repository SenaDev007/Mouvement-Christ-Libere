/**
 * ⭐ V3.82 — Wrapper FedaPay (paiement local : Afrique de l'Ouest).
 *
 * Couverture : Mobile Money (MTN, Orange, Moov, Wave), cartes bancaires
 * régionales, zone UEMOA — règlement en XOF.
 *
 * Implémentation REST native (fetch) : aucune dépendance SDK, comportement
 * identique en sandbox et en production, sérialisation maîtrisée. Les
 * clés ne vivent QUE côté serveur (variables d'environnement).
 *
 * Variables d'environnement :
 *   FEDAPAY_SECRET_KEY     sk_live_xxx | sk_sandbox_xxx (requis)
 *   FEDAPAY_ENV            sandbox | live (défaut : sandbox)
 *   FEDAPAY_API_BASE       surcharge explicite de l'API (optionnel)
 *   FEDAPAY_WEBHOOK_SECRET secret des webhooks (requis en production)
 *
 * Ce service ne connaît PAS Paystack — le routage passe par
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
  libelleTypeDon,
  urlSite,
} from "./payment-types";

const API_LIVE = "https://api.fedapay.com";
const API_SANDBOX = "https://sandbox-api.fedapay.com";
const TIMEOUT_MS = 20_000;

function baseApi(): string {
  if (process.env.FEDAPAY_API_BASE) {
    return process.env.FEDAPAY_API_BASE.replace(/\/$/, "");
  }
  return process.env.FEDAPAY_ENV === "live" ? API_LIVE : API_SANDBOX;
}

/** Vrai si la clé secrète FedaPay est configurée. */
export function fedapayConfigure(): boolean {
  return Boolean(process.env.FEDAPAY_SECRET_KEY);
}

/** Nom de la variable manquante (message d'aide pour l'administrateur). */
export const FEDAPAY_CLE_ENV = "FEDAPAY_SECRET_KEY";

/**
 * Crée la transaction chez FedaPay puis génère le token de paiement.
 *
 * ① POST /v1/transactions — description « <Type> — <référence> »,
 *    montant XOF (unité entière — pas de sous-unité), devise ISO,
 *    callback de retour vers /contribuer/merci?ref=<référence>,
 *    client (email + nom) et custom_metadata.reference (clé de
 *    rapprochement du webhook — prioritaire sur l'id fournisseur).
 * ② POST /v1/transactions/{id}/token — renvoie l'URL de la page de
 *    paiement hébergée (pay.fedapay.com / sandbox-pay.fedapay.com).
 */
export async function creerTransactionFedapay(
  demande: DemandeDon,
  reference: string
): Promise<TransactionDon> {
  const cle = process.env.FEDAPAY_SECRET_KEY;
  if (!cle) {
    throw new ErreurPasserelle(
      "La passerelle FedaPay n'est pas encore configurée (FEDAPAY_SECRET_KEY absente)."
    );
  }

  const urlRetour = `${urlSite()}/contribuer/merci?ref=${reference}`;

  const reponse = await appelApi("/v1/transactions", {
    description: `${libelleTypeDon(demande.type_don)} — ${reference}`,
    amount: demande.montant,
    currency: { iso: demande.devise },
    callback_url: urlRetour,
    customer: {
      email: demande.email.trim(),
      ...(demande.nom ? { firstname: demande.nom.slice(0, 80) } : {}),
    },
    custom_metadata: {
      reference,
      type_don: demande.type_don,
    },
  });

  const racine = (reponse.transaction ?? reponse) as
    | Record<string, unknown>
    | undefined;
  const sousRacine = racine?.data as Record<string, unknown> | undefined;
  const idFournisseur =
    racine?.id ?? sousRacine?.id ?? null;
  if (idFournisseur === null || idFournisseur === undefined) {
    throw new ErreurPasserelle(
      "FedaPay n'a pas renvoyé d'identifiant de transaction."
    );
  }

  const tokenRacine = (await appelApi(
    `/v1/transactions/${idFournisseur}/token`,
    {},
    "POST"
  )) as Record<string, unknown>;
  const tokenImbrique = (tokenRacine.token ?? tokenRacine.data) as
    | Record<string, unknown>
    | undefined;
  const paymentUrl =
    (tokenRacine.url as string | undefined) ??
    (tokenImbrique?.url as string | undefined) ??
    null;
  if (!paymentUrl) {
    throw new ErreurPasserelle(
      "FedaPay n'a pas renvoyé d'URL de paiement."
    );
  }

  return {
    reference,
    provider: "fedapay",
    providerRef: String(idFournisseur),
    paymentUrl,
  };
}

/** Appel JSON signé Bearer vers l'API FedaPay (timeout global 20 s). */
async function appelApi(
  chemin: string,
  corps: unknown,
  methode: "POST" = "POST"
): Promise<Record<string, unknown>> {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const reponse = await fetch(`${baseApi()}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(corps),
      signal: controle.signal,
    });

    const donnees = (await reponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!reponse.ok) {
      const message =
        (donnees.message as string) ||
        `FedaPay a refusé la requête (${reponse.status}).`;
      throw new ErreurPasserelle(message, `HTTP_${reponse.status}`);
    }
    return donnees;
  } catch (e) {
    if (e instanceof ErreurPasserelle) throw e;
    const abort = e instanceof Error && e.name === "AbortError";
    throw new ErreurPasserelle(
      abort
        ? "FedaPay n'a pas répondu à temps (20 s) — réessayez."
        : `Impossible de joindre FedaPay : ${
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
 * Vérifie la signature d'un webhook FedaPay.
 *
 * L'en-tête `X-FEDAPAY-SIGNATURE` porte le HMAC-SHA256 (hex) du corps BRUT
 * de la requête, calculé avec le secret configuré dans le dashboard
 * FedaPay (FEDAPAY_WEBHOOK_SECRET). Comparaison à temps constant —
 * une longueur différente est un rejet immédiat (jamais traité).
 */
export function verifierSignatureFedapay(
  corpsBrut: string,
  signatureEnTete: string | null
): boolean {
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signatureEnTete) return false;

  const attendu = createHmac("sha256", secret).update(corpsBrut, "utf8").digest("hex");
  const recu = signatureEnTete.trim().toLowerCase();

  if (attendu.length !== recu.length) return false;
  try {
    return timingSafeEqual(Buffer.from(attendu, "utf8"), Buffer.from(recu, "utf8"));
  } catch {
    return false;
  }
}

/** Vrai si le secret de webhook FedaPay est configuré. */
export function fedapayWebhookConfigure(): boolean {
  return Boolean(process.env.FEDAPAY_WEBHOOK_SECRET);
}
