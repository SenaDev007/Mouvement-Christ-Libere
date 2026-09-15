/**
 * ⭐ V3.82 — Machine à états partagée des webhooks de paiement.
 *
 * Utilisée par /api/webhooks/fedapay et /api/webhooks/paystack (eux-mêmes
 * se chargent UNIQUEMENT de vérifier la signature et de lire le payload
 * propre à leur fournisseur).
 *
 * Garanties (spécification — non négociables) :
 *  · idempotence : un webhook reçu deux fois ne duplique NI l'écriture
 *    trésorerie NI l'email de reçu (transition atomique pending → final,
 *    seul le premier appel produit les effets de bord) ;
 *  · dispatch trésorerie : chaque don approuvé crée une écriture
 *    TreasuryTransaction (RECETTE, catégorie offrande/dime/don, caisse
 *    « Dons en ligne ») dans la MÊME transaction SQL que le changement
 *    de statut ;
 *  · email de reçu : envoyé uniquement sur l'approbation, jamais depuis
 *    le front, jamais en double ;
 *  · journal : chaque événement est consigné dans WebhookLog (signature
 *    invalide, don inconnu, déjà traité, traité, ignoré, erreur) — le
 *    corps brut tronqué permet un rejeu manuel en cas d'incident.
 */

import { db } from "@/lib/db";
import { ensureDonsTables } from "@/lib/ensure-schema";
import { envoyerEmail } from "@/lib/email";
import { sujetRecuDon, templateRecuDon } from "@/lib/email-templates";
import {
  ProviderId,
  libelleProvider,
  libelleTypeDon,
} from "./payment-types";

/** Code retour du traitement (journalisé dans WebhookLog.statut). */
export type CodeTraitementWebhook =
  | "SIGNE_INVALIDE"
  | "CORPS_INVALIDE"
  | "DON_INCONNU"
  | "DEJA_TRAITE"
  | "TRAITE"
  | "IGNORE"
  | "ERREUR";

/** Statut final visé par l'événement (null = événement sans effet). */
export type StatutFinal = "approved" | "failed" | null;

/** Taille maximale du corps brut conservé dans WebhookLog (20 Ko). */
const TAILLE_MAX_PAYLOAD = 20_000;

// ─────────────────────────────────────────────────────────────────────
// Journal (best-effort — jamais bloquant)
// ─────────────────────────────────────────────────────────────────────

export async function journaliserWebhook(entree: {
  provider: ProviderId;
  event: string;
  statut: CodeTraitementWebhook;
  reference?: string | null;
  providerRef?: string | null;
  erreur?: string | null;
  corpsBrut?: string;
}): Promise<void> {
  try {
    await db.webhookLog.create({
      data: {
        provider: entree.provider,
        event: entree.event.slice(0, 120),
        statut: entree.statut,
        reference: entree.reference ?? null,
        providerRef: entree.providerRef != null ? String(entree.providerRef).slice(0, 120) : null,
        erreur: entree.erreur ? entree.erreur.slice(0, 1_000) : null,
        payload: entree.corpsBrut
          ? entree.corpsBrut.slice(0, TAILLE_MAX_PAYLOAD)
          : null,
      },
    });
  } catch (e) {
    console.warn("[dons-webhook] Journalisation WebhookLog impossible :", e);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Résolution du don concerné
// ─────────────────────────────────────────────────────────────────────

/** Extrait une référence interne (don_xxx) d'un texte libre (description FedaPay). */
export function extraireReferenceDescription(texte: string | null | undefined): string | null {
  if (!texte) return null;
  const correspondance = texte.match(/don_[a-z0-9]+_[a-f0-9]+/i);
  return correspondance ? correspondance[0] : null;
}

/**
 * Retrouve le don par référence interne (prioritaire), sinon par
 * identifiant fournisseur (providerRef).
 */
async function retrouverDon(
  reference: string | null,
  providerRef: string | null
) {
  if (reference) {
    const parReference = await db.donation.findUnique({
      where: { reference },
    });
    if (parReference) return parReference;
  }
  if (providerRef) {
    const parFournisseur = await db.donation.findFirst({
      where: { providerRef: String(providerRef) },
    });
    if (parFournisseur) return parFournisseur;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Traitement
// ─────────────────────────────────────────────────────────────────────

export interface EntreeTraitementWebhook {
  provider: ProviderId;
  /** Nom de l'événement brut (transaction.approved, charge.success…). */
  evenement: string;
  /** Référence interne résolue depuis le payload (si disponible). */
  reference: string | null;
  /** Identifiant transaction côté fournisseur (si disponible). */
  providerRef: string | null;
  /** Statut final visé — null = événement ignoré (créé, en cours…). */
  statutFinal: StatutFinal;
  /** Corps brut de la requête (journal). */
  corpsBrut: string;
}

export interface ResultatTraitementWebhook {
  code: CodeTraitementWebhook;
  http: number;
}

/**
 * Applique un événement de paiement validé (signature déjà vérifiée par
 * l'appelant) : transition atomique du don + écriture trésorerie + email
 * de reçu — chacun au plus une fois, quel que soit le nombre de réceptions.
 */
export async function traiterEvenementDon(
  entree: EntreeTraitementWebhook
): Promise<ResultatTraitementWebhook> {
  const base = {
    provider: entree.provider,
    event: entree.evenement,
    reference: entree.reference,
    providerRef: entree.providerRef,
    corpsBrut: entree.corpsBrut,
  };

  // Événement sans effet comptable (transaction.created, refund…).
  if (entree.statutFinal === null) {
    await journaliserWebhook({ ...base, statut: "IGNORE" });
    return { code: "IGNORE", http: 200 };
  }

  try {
    await ensureDonsTables();

    const don = await retrouverDon(entree.reference, entree.providerRef);
    if (!don) {
      await journaliserWebhook({ ...base, statut: "DON_INCONNU" });
      // 404 : le fournisseur réessaiera — utile si le webhook devance
      // l'écriture providerRef (course improbable au retour d'initier).
      return { code: "DON_INCONNU", http: 404 };
    }

    const finalReference = entree.reference || don.reference;
    const statutInitial = don.statut;

    // Transition ATOMIQUE : seul un don « pending » bouge — un webhook
    // rejoué (ou doublon) trouve « approved » et ne refait RIEN.
    const resultat = await db.$transaction(async (tx) => {
      const maj = await tx.donation.updateMany({
        where: { id: don.id, statut: "pending" },
        data: {
          statut: entree.statutFinal as "approved" | "failed",
          ...(entree.statutFinal === "approved" ? { confirmedAt: new Date() } : {}),
          ...(entree.providerRef && !don.providerRef
            ? { providerRef: String(entree.providerRef).slice(0, 120) }
            : {}),
        },
      });

      if (maj.count !== 1) return { transition: false as const };

      // ⭐ Dispatch trésorerie — uniquement à l'approbation, dans la même
      // transaction que le changement de statut (jamais de doublon).
      if (entree.statutFinal === "approved") {
        const caisse = await tx.treasuryCashAccount.findUnique({
          where: { code: "dons-en-ligne" },
        });

        await tx.treasuryTransaction.create({
          data: {
            type: "RECETTE",
            category: don.typeDon || "don", // offrande | dime | don
            amount: don.amount,
            currency: don.currency,
            method: don.provider === "fedapay" ? "mobile_money" : "carte",
            label: `${libelleTypeDon(don.typeDon)} en ligne — ${libelleProvider(don.provider)} — ${don.reference}`,
            date: new Date(),
            reference: don.reference,
            donorName: don.donorName || null,
            isAnonymous: !don.donorName,
            note: `Don payé en ligne via ${libelleProvider(don.provider)} (${entree.evenement}) — écriture générée automatiquement à l'approbation du paiement.`,
            caisseId: caisse?.id ?? null,
          },
        });
      }

      return { transition: true as const };
    });

    if (!resultat.transition) {
      await journaliserWebhook({ ...base, statut: "DEJA_TRAITE" });
      return { code: "DEJA_TRAITE", http: 200 };
    }

    // ⭐ Email de reçu — uniquement à l'approbation, après le commit
    // (best-effort : un échec d'envoi n'annule pas le don, il est
    // journalisé dans OutgoingEmail pour reprise).
    if (entree.statutFinal === "approved" && don.donorEmail) {
      const { html, text } = templateRecuDon({
        nom: don.donorName,
        montant: don.amount,
        devise: don.currency,
        typeDon: don.typeDon,
        reference: don.reference || finalReference,
        provider: don.provider,
        date: new Date(),
      });
      const envoi = await envoyerEmail({
        to: don.donorEmail,
        toName: don.donorName,
        subject: sujetRecuDon(),
        html,
        text,
        category: "RECU_DON",
      });
      if (!envoi.ok) {
        console.error("[dons-webhook] Échec d'envoi du reçu :", envoi.erreur);
      }
    }

    await journaliserWebhook({ ...base, statut: "TRAITE" });
    console.log(
      `[dons-webhook] ${entree.provider}:${entree.evenement} → don ${finalReference} ${entree.statutFinal}` +
        (statutInitial !== "pending" ? ` (statut initial : ${statutInitial})` : "")
    );
    return { code: "TRAITE", http: 200 };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await journaliserWebhook({ ...base, statut: "ERREUR", erreur: message });
    console.error("[dons-webhook] Erreur de traitement :", message);
    // 500 : le fournisseur réessaiera — la transition atomique garantit
    // qu'un nouvel essai ne dupliquera rien.
    return { code: "ERREUR", http: 500 };
  }
}
