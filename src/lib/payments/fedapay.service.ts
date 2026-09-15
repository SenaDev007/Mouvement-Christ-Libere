/**
 * ⭐ V3.82/V3.83 — Wrapper FedaPay (paiement local : Afrique de l'Ouest).
 *
 * Couverture : Mobile Money (MTN, Orange, Moov, Wave), cartes bancaires
 * régionales, zone UEMOA — règlement en XOF.
 *
 * Implémentation REST native (fetch) : aucune dépendance SDK, comportement
 * identique en sandbox et en production, sérialisation maîtrisée.
 *
 * ⭐ V3.83 — La configuration vient du BACK-OFFICE (/admin/paiements) :
 *   · lireConfigPasserelle("fedapay") résout la clé (base chiffrée puis
 *     variables d'environnement en repli — FEDAPAY_SECRET_KEY,
 *     FEDAPAY_ENV, FEDAPAY_API_BASE, FEDAPAY_WEBHOOK_SECRET) ;
 *   · les clés ne vivent QUE côté serveur (jamais envoyées au client).
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
import { lireConfigPasserelle } from "./gateway-config";

const API_LIVE = "https://api.fedapay.com";
const API_SANDBOX = "https://sandbox-api.fedapay.com";
const TIMEOUT_MS = 20_000;

/** Base API selon l'environnement (surcharge FEDAPAY_API_BASE respectée). */
function baseApi(environment: "sandbox" | "live"): string {
  if (process.env.FEDAPAY_API_BASE) {
    return process.env.FEDAPAY_API_BASE.replace(/\/$/, "");
  }
  return environment === "live" ? API_LIVE : API_SANDBOX;
}

/** Vrai si la clé secrète FedaPay est configurée (back-office ou env). */
export async function fedapayConfigure(): Promise<boolean> {
  const config = await lireConfigPasserelle("fedapay");
  return Boolean(config.secretKey);
}

/** Libellé d'aide (où configurer la passerelle). */
export const FEDAPAY_AIDE_CONFIG =
  "Clé à configurer depuis le back-office → Passerelles de paiement (/admin/paiements) ou variable FEDAPAY_SECRET_KEY (Vercel).";

/**
 * ⭐ V3.84 — Extrait l'objet transaction de la réponse FedaPay.
 *
 * L'API RÉELLE enveloppe la ressource sous une clé VERSIONNÉE
 * « v1/transaction » — confirmé par les SDK officiels PHP et Node
 * (Util::convertToFedaPayObject lit resp['klass'] = "v1/transaction",
 * puis refreshFrom/stripApiVersion déballe l'objet sous cette clé avant
 * que Create::create() ne retourne $object->transaction). La
 * documentation, elle, présente l'objet à plat — les DEUX formes sont
 * donc acceptées, ainsi que deux enveloppes défensives :
 *   ① { "klass": "v1/transaction", "v1/transaction": { id, … } } ← réelle
 *   ② { "transaction": { id, … } }
 *   ③ { "data": { id, … } }
 *   ④ { id, … } (plate — documentation)
 */
function extraireTransaction(
  reponse: Record<string, unknown>
): Record<string, unknown> | null {
  const enveloppes: unknown[] = [
    reponse["v1/transaction"], // ← forme réelle de l'API (clé versionnée)
    reponse.transaction, // enveloppe non versionnée
    reponse.data, // enveloppe « data » (défensive)
    reponse, // objet plat (présenté par la documentation)
  ];
  for (const enveloppe of enveloppes) {
    if (!enveloppe || typeof enveloppe !== "object") continue;
    const objet = enveloppe as Record<string, unknown>;
    // Certains niveaux imbriquent encore un « data » (défensif).
    const internes: unknown[] = [
      objet,
      typeof objet.data === "object" && objet.data !== null
        ? objet.data
        : undefined,
    ];
    for (const interne of internes) {
      if (
        interne &&
        typeof interne === "object" &&
        (interne as Record<string, unknown>).id != null
      ) {
        return interne as Record<string, unknown>;
      }
    }
  }
  return null;
}

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
  const config = await lireConfigPasserelle("fedapay");
  if (!config.secretKey) {
    throw new ErreurPasserelle(
      "La passerelle FedaPay n'est pas encore configurée (aucune clé API — voir /admin/paiements)."
    );
  }

  const urlRetour = `${urlSite()}/contribuer/merci?ref=${reference}`;

  const reponse = await appelApi(
    { base: baseApi(config.environment), cle: config.secretKey },
    "/v1/transactions",
    {
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
    }
  );

  // ⭐ V3.84 — la réponse réelle est enveloppée sous « v1/transaction »
  // (les SDK officiels la déballe) : l'extraction multi-formes remplace
  // l'ancien parsing qui ne voyait que « transaction » ou l'objet plat.
  const transaction = extraireTransaction(reponse);
  const idFournisseur = transaction?.id;
  if (idFournisseur === null || idFournisseur === undefined) {
    // Clés SEULEMENT (jamais les valeurs) : diagnostiquer sans rien exposer.
    const clesRecues = Object.keys(reponse)
      .slice(0, 6)
      .join(", ");
    throw new ErreurPasserelle(
      `FedaPay n'a pas renvoyé d'identifiant de transaction (clés reçues : ${
        clesRecues || "réponse vide"
      }).`
    );
  }

  const tokenRacine = (await appelApi(
    { base: baseApi(config.environment), cle: config.secretKey },
    `/v1/transactions/${idFournisseur}/token`,
    {},
    "POST"
  )) as Record<string, unknown>;

  // ⭐ V3.84 — URL de paiement multi-formes : la réponse réelle est plate
  // (token + url sont des chaînes au premier niveau — cf. generateToken()
  // des SDK officiels qui lit ->token / ->url directement) ; les
  // enveloppes « v1/token », « token » et « data » restent acceptées.
  const candidatsUrl: unknown[] = [
    tokenRacine.url,
    typeof tokenRacine["v1/token"] === "object" && tokenRacine["v1/token"] !== null
      ? (tokenRacine["v1/token"] as Record<string, unknown>).url
      : undefined,
    typeof tokenRacine.token === "object" && tokenRacine.token !== null
      ? (tokenRacine.token as Record<string, unknown>).url
      : undefined,
    typeof tokenRacine.data === "object" && tokenRacine.data !== null
      ? (tokenRacine.data as Record<string, unknown>).url
      : undefined,
  ];
  const paymentUrl = candidatsUrl.find(
    (u): u is string => typeof u === "string" && u.length > 0
  );
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

/**
 * ⭐ V3.83 — Test de connexion depuis /admin/paiements.
 * Interroge une route légère en lecture (GET /v1/transactions, limite 1) :
 * 200 = la clé est acceptée ; 401/403 = clé invalide ; autre = incident.
 * Aucune écriture, aucun coût, aucun paiement créé.
 */
export async function testerConnexionFedapay(params: {
  cle?: string | null;
  environment: "sandbox" | "live";
}): Promise<{ ok: boolean; message: string }> {
  const cle =
    params.cle?.trim() ||
    (await lireConfigPasserelle("fedapay")).secretKey;
  if (!cle) {
    return {
      ok: false,
      message:
        "Aucune clé à tester — collez d'abord la clé secrète API puis enregistrez-la.",
    };
  }
  try {
    const reponse = await fetch(
      `${baseApi(params.environment)}/v1/transactions?limit=1`,
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
        message: `Connexion réussie — FedaPay accepte cette clé (environnement ${
          params.environment === "live" ? "production" : "sandbox"
        }).`,
      };
    }
    if (reponse.status === 401 || reponse.status === 403) {
      return {
        ok: false,
        message:
          "FedaPay a refusé cette clé (401/403) — vérifiez la clé secrète et l'environnement sélectionné.",
      };
    }
    return {
      ok: false,
      message: `FedaPay a répondu ${reponse.status} — réessayez dans un instant.`,
    };
  } catch (e) {
    return {
      ok: false,
      message: `Impossible de joindre FedaPay : ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
}

/** Appel JSON signé Bearer vers l'API FedaPay (timeout global 20 s). */
async function appelApi(
  identifiants: { base: string; cle: string },
  chemin: string,
  corps: unknown,
  methode: "POST" = "POST"
): Promise<Record<string, unknown>> {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const reponse = await fetch(`${identifiants.base}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${identifiants.cle}`,
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
 * de la requête, calculé avec le secret configuré dans le dashboard FedaPay
 * (back-office /admin/paiements, ou FEDAPAY_WEBHOOK_SECRET en repli).
 * Comparaison à temps constant — une longueur différente est un rejet
 * immédiat (jamais traité).
 */
export async function verifierSignatureFedapay(
  corpsBrut: string,
  signatureEnTete: string | null
): Promise<boolean> {
  const config = await lireConfigPasserelle("fedapay");
  const secret = config.webhookSecret;
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

/** Vrai si le secret de webhook FedaPay est configuré (back-office ou env). */
export async function fedapayWebhookConfigure(): Promise<boolean> {
  const config = await lireConfigPasserelle("fedapay");
  return Boolean(config.webhookSecret);
}
