/**
 * ⭐ V3.87 — Récupération automatique des dons FedaPay « pending ».
 *
 * CONSTAT (modèle Academia-Helm) : le webhook FedaPay n'est PAS toujours
 * envoyé (sandbox, webhook non déclaré dans le dashboard, incident) — on ne
 * peut donc PAS en faire le seul canal de confirmation. Le widget checkout.js
 * ne fait pas foi non plus (le navigateur est cliente, pas autoritaire).
 *
 * Cette bibliothèque ajoute les DEUX canaux serveur-autoritaires manquants :
 *   ① RE-VÉRIFICATION au fil de l'eau — la page /contribuer/merci scrute
 *      /api/dons/statut toutes les 4 s : pour un don FedaPay encore
 *      « pending », le serveur interroge LUI-MÊME FedaPay
 *      (GET /v1/transactions/{id}, clé secrète) et finalise dès qu'FedaPay
 *      dit « approved » (montant exact exigé, même machine à états que les
 *      webhooks — idempotence, trésorerie, reçu) ;
 *   ② RAPPROCHEMENT PAR DESCRIPTION — si le POST de confirmation du
 *      navigateur n'est jamais arrivé (onglet fermé, réseau coupé), le don
 *      n'a PAS de providerRef : on liste les transactions récentes FedaPay
 *      et on raccroche le don à la transaction dont la description contient
 *      sa référence interne ( « Dîme — don_xxx » — même format que le widget
 *      ET que le flux serveur), puis on vérifie individuellement.
 *   ③ CRON DE SÉCURITÉ — /api/cron/recuperer-dons-fedapay rejoue ①+②
 *      périodiquement pour les dons des dernières 48 h (filet qui guérit
 *      même sans visite de la page merci).
 *
 * Anti-hammering : colonne runtime « providerVerifiedAt » (pattern
 * LiveStream.youtubeVerifyLastAt — ALTER ADD COLUMN IF NOT EXISTS, zéro
 * migration Prisma) ; la « claim » atomique UPDATE … WHERE ancien guarantee
 * qu'un seul appel FedaPay par don toutes les DELAI_MIN_VERIFICATIONS s.
 */

import { db } from "@/lib/db";
import {
  listerTransactionsFedapayRecentes,
  verifierTransactionFedapay,
} from "./fedapay.service";
import { extraireReferenceDescription, traiterEvenementDon } from "./dons-webhook";

/** Délai minimum entre deux vérifications FedaPay d'un même don. */
export const DELAI_MIN_VERIFICATIONS_MS = 8_000;

/** Âge maximal d'un don pour la re-vérification au fil de l'eau (page merci). */
export const AGE_MAX_STATUT_MS = 30 * 60 * 1000;

/** Âge maximal d'un don pour le cron de récupération. */
export const AGE_MAX_CRON_MS = 48 * 60 * 60 * 1000;

/** Nombre maximal de dons traités par passage du cron. */
export const MAX_DONS_PAR_CRON = 30;

// ── Colonne runtime (idempotent, mémoïsé) ─────────────────────────────

let colonneOk = false;
let colonneEnCours: Promise<void> | null = null;

/** Crée la colonne providerVerifiedAt si absente (pattern youtubeVerifyLastAt). */
export function ensureColonneVerificationDon(): Promise<void> {
  if (colonneOk) return Promise.resolve();
  if (!colonneEnCours) {
    colonneEnCours = (async () => {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "providerVerifiedAt" TIMESTAMPTZ`
        );
        colonneOk = true;
      } catch (e) {
        console.warn(
          "[recuperation-dons] Colonne Donation.providerVerifiedAt impossible :",
          e
        );
      } finally {
        colonneEnCours = null;
      }
    })();
  }
  return colonneEnCours;
}

// ── Claim atomique du droit de vérifier ───────────────────────────────

/**
 * « Réserve » le droit de vérifier ce don maintenant (au plus une
 * vérification FedaPay par don toutes les DELAI_MIN_VERIFICATIONS ms,
 * quel que soit le nombre d'instances serverless ou de pollings clients).
 */
async function reclamerVerification(donId: string): Promise<boolean> {
  const lignes = await db.$executeRaw`
    UPDATE "Donation"
    SET "providerVerifiedAt" = now()
    WHERE "id" = ${donId}
      AND ("providerVerifiedAt" IS NULL
           OR "providerVerifiedAt" <= now() - interval '8 seconds')
  `;
  return lignes === 1;
}

// ── Types internes ────────────────────────────────────────────────────

interface DonMinimal {
  id: string;
  reference: string | null;
  provider: string | null;
  providerRef: string | null;
  statut: string;
  amount: number;
}

/** Vérifie auprès de FedaPay et finalise le don si nécessaire (autorisé). */
async function verifierEtFinaliser(
  don: DonMinimal,
  fedapayRef: string,
  source: "statut" | "cron"
): Promise<"approved" | "failed" | "pending"> {
  const verification = await verifierTransactionFedapay(fedapayRef);

  // Montant EXACT exigé (même règle que /api/dons/fedapay/confirmation) :
  // impossible d'approuver un don de 100 000 payé 100.
  if (
    verification.statut === "approved" &&
    verification.montant !== null &&
    verification.montant !== don.amount
  ) {
    await traiterEvenementDon({
      provider: "fedapay",
      evenement: `recuperation_${source}.montant_incoherent`,
      reference: don.reference,
      providerRef: fedapayRef,
      statutFinal: null, // ignoré comptablement — journalisé pour audit
      corpsBrut: JSON.stringify({
        source: `recuperation_${source}`,
        fedapayRef,
        statutFournisseur: verification.statut,
        montantFournisseur: verification.montant,
        montantDon: don.amount,
      }),
    }).catch(() => undefined);
    return "pending";
  }

  const statutFinal =
    verification.statut === "approved"
      ? "approved"
      : verification.statut === "declined" || verification.statut === "cancelled"
        ? "failed"
        : null;
  if (statutFinal === null) return "pending"; // pending/inconnu : rien à décider

  await traiterEvenementDon({
    provider: "fedapay",
    evenement:
      statutFinal === "approved"
        ? `recuperation_${source}.approved`
        : `recuperation_${source}.declined`,
    reference: don.reference,
    providerRef: verification.id || fedapayRef,
    statutFinal,
    corpsBrut: JSON.stringify({
      source: `recuperation_${source}`,
      fedapayRef,
      statutFournisseur: verification.statut,
      montantFournisseur: verification.montant,
    }),
  });
  return statutFinal;
}

/** Rapproche un don sans providerRef via la description des transactions. */
async function rapprocherParDescription(
  don: DonMinimal,
  source: "statut" | "cron"
): Promise<"approved" | "failed" | "pending"> {
  const transactions = await listerTransactionsFedapayRecentes(
    source === "cron" ? 50 : 25
  );
  for (const transaction of transactions) {
    const description =
      typeof transaction.description === "string"
        ? transaction.description
        : null;
    const referenceExtraite = extraireReferenceDescription(description);
    if (referenceExtraite !== don.reference) continue;

    const idFournisseur =
      transaction.id !== undefined && transaction.id !== null
        ? String(transaction.id)
        : null;
    if (!idFournisseur) continue;

    // Mémoriser le rapprochement (les prochaines re-vérifications passeront
    // directement par le providerRef — plus de liste).
    await db.donation
      .updateMany({
        where: { id: don.id, statut: "pending", providerRef: null },
        data: { providerRef: idFournisseur.slice(0, 120) },
      })
      .catch(() => undefined);

    return verifierEtFinaliser(don, idFournisseur, source);
  }
  return "pending";
}

// ── API publique ──────────────────────────────────────────────────────

/**
 * Tente de faire avancer un don FedaPay « pending » vers son statut réel.
 *
 * Appelée par /api/dons/statut/[reference] (page merci — don récent) et par
 * le cron /api/cron/recuperer-dons-fedapay (dons des dernières 48 h).
 * Ne lève JAMAIS : toute erreur interne retourne « pending » (le donateur
 * continue de voir l'état réel, les autres canaux restent en jeu).
 */
export async function retenterVerificationDon(
  reference: string,
  source: "statut" | "cron" = "statut"
): Promise<"approved" | "failed" | "pending"> {
  try {
    await ensureColonneVerificationDon();

    const don = await db.donation.findUnique({
      where: { reference },
      select: {
        id: true,
        reference: true,
        provider: true,
        providerRef: true,
        statut: true,
        amount: true,
      },
    });
    if (!don || don.provider !== "fedapay" || don.statut !== "pending") {
      return "pending";
    }

    // Anti-hammering : au plus une vérification FedaPay par fenêtre.
    if (!(await reclamerVerification(don.id))) return "pending";

    // ① providerRef connu → vérification directe.
    if (don.providerRef) {
      return await verifierEtFinaliser(don, don.providerRef, source);
    }

    // ② Aucun providerRef → rapprochement par description.
    return await rapprocherParDescription(don, source);
  } catch (e) {
    console.warn(
      "[recuperation-dons] Re-vérification impossible (",
      reference,
      ") :",
      e instanceof Error ? e.message : e
    );
    return "pending";
  }
}

/**
 * Passage du cron : re-vérifie les dons FedaPay « pending » récents
 * (≤ 48 h). Budget-borné pour respecter la limite serverless.
 */
export async function recupererDonsPendantsFedapay(params: {
  budgetMs?: number;
}): Promise<{ traites: number; approuves: number }> {
  const budgetMs = params.budgetMs ?? 25_000;
  const debut = Date.now();
  let traites = 0;
  let approuves = 0;

  try {
    await ensureColonneVerificationDon();

    const dons = await db.donation.findMany({
      where: {
        provider: "fedapay",
        statut: "pending",
        createdAt: { gte: new Date(Date.now() - AGE_MAX_CRON_MS) },
      },
      select: { reference: true },
      orderBy: { createdAt: "desc" },
      take: MAX_DONS_PAR_CRON,
    });

    for (const don of dons) {
      if (Date.now() - debut > budgetMs) break;
      if (!don.reference) continue;
      traites += 1;
      const statut = await retenterVerificationDon(don.reference, "cron");
      if (statut === "approved") approuves += 1;
    }
  } catch (e) {
    console.warn(
      "[recuperation-dons] Passage cron impossible :",
      e instanceof Error ? e.message : e
    );
  }

  return { traites, approuves };
}
