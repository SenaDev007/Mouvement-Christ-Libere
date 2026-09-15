import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDonsTables } from "@/lib/ensure-schema";
import { verifierTransactionFedapay } from "@/lib/payments/fedapay.service";
import {
  journaliserWebhook,
  traiterEvenementDon,
} from "@/lib/payments/dons-webhook";

/**
 * ⭐ V3.85 — POST /api/dons/fedapay/confirmation (modèle Academia-Helm).
 *
 * Le widget checkout.js s'ouvre SUR LA PAGE /contribuer (clé publique) ;
 * quand le donateur termine (ou abandonne), le navigateur appelle cette
 * route pour CONFIRMER le don côté serveur.
 *
 * Sécurité — le navigateur ne fait JAMAIS foi :
 *   ① le don est retrouvé par SA référence interne (don_…) ;
 *   ② la transaction est VÉRIFIÉE auprès de FedaPay avec la clé SECRÈTE
 *      (GET /v1/transactions/{ref} — même niveau de confiance que le
 *      webhook signé) ;
 *   ③ le montant FedaPay doit correspondre EXACTEMENT au montant du don
 *      (sinon : refus — impossible de « payer 100 pour un don de 100 000 ») ;
 *   ④ la transition passe par la MÊME machine à états atomique que les
 *      webhooks (traiterEvenementDon) : idempotence, écriture trésorerie
 *      unique, reçu email unique, journal WebhookLog.
 *
 * Le webhook signé reste valable en parallèle (sécurité) — le premier des
 * deux à traiter le don gagne, l'autre constate « déjà traité ».
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anti-abus mémoire d'instance (même garde-fou que /api/dons/initier).
const FENETRE_MS = 10 * 60 * 1000;
const MAX_PAR_FENETRE = 30;
const parIp = new Map<string, number[]>();

function ipCliente(request: NextRequest): string {
  const transpose = request.headers.get("x-forwarded-for");
  if (transpose) return transpose.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "inconnu";
}

function autorise(ip: string): boolean {
  const maintenant = Date.now();
  const marques = (parIp.get(ip) || []).filter(
    (t) => maintenant - t < FENETRE_MS
  );
  if (marques.length >= MAX_PAR_FENETRE) {
    parIp.set(ip, marques);
    return false;
  }
  marques.push(maintenant);
  parIp.set(ip, marques);
  if (parIp.size > 5_000) {
    for (const [cle, liste] of parIp) {
      if (liste.every((t) => maintenant - t >= FENETRE_MS)) parIp.delete(cle);
    }
  }
  return true;
}

export async function POST(request: NextRequest) {
  if (!autorise(ipCliente(request))) {
    return NextResponse.json(
      { error: "Trop de requêtes rapprochées — patientez un instant." },
      { status: 429 }
    );
  }

  let corps: { reference?: string; fedapayRef?: string | number | null };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 }
    );
  }

  const reference = (corps.reference || "").toString().trim();
  // Format canonique don_<base36>_<10 hex> — rejet immédiat sinon.
  if (!/^don_[a-z0-9]+_[a-f0-9]{6,}$/i.test(reference)) {
    return NextResponse.json(
      { error: "Référence de don invalide." },
      { status: 400 }
    );
  }
  const fedapayRefFourni =
    corps.fedapayRef !== undefined && corps.fedapayRef !== null
      ? String(corps.fedapayRef).trim().slice(0, 120)
      : null;

  try {
    await ensureDonsTables();

    const don = await db.donation.findUnique({ where: { reference } });
    if (!don) {
      return NextResponse.json({ error: "Don introuvable." }, { status: 404 });
    }
    if (don.provider !== "fedapay") {
      return NextResponse.json(
        { error: "Ce don n'utilise pas la passerelle FedaPay." },
        { status: 400 }
      );
    }

    // Déjà finalisé (webhook passé avant la confirmation) → simple constat.
    if (don.statut !== "pending") {
      return NextResponse.json({ ok: true, statut: don.statut });
    }

    const fedapayRef = fedapayRefFourni || don.providerRef;
    if (!fedapayRef) {
      // Aucune référence fournisseur : le webhook (s'il est déclaré) reste
      // le canal de confirmation — la page merci continue de scruter.
      return NextResponse.json({
        ok: true,
        statut: "pending",
        detail: "confirmation-en-attente",
      });
    }

    // ② Vérification AUTORITAIRE auprès de FedaPay (clé secrète).
    let verification;
    try {
      verification = await verifierTransactionFedapay(fedapayRef);
    } catch (e) {
      // FedaPay injoignable/refus : ne RIEN décider — le donateur est
      // redirigé vers la page merci qui scrute (le webhook tranche aussi).
      console.error(
        "[dons/fedapay/confirmation] Vérification impossible :",
        e instanceof Error ? e.message : e
      );
      return NextResponse.json(
        {
          ok: false,
          statut: "pending",
          error:
            "La vérification du paiement auprès de FedaPay a échoué — votre don reste en cours de traitement (la page suivante affichera son état réel).",
        },
        { status: 502 }
      );
    }

    // ③ Montant : correspondance EXACTE exigée (XOF entier, devise unique).
    if (
      verification.statut === "approved" &&
      verification.montant !== null &&
      verification.montant !== don.amount
    ) {
      await journaliserWebhook({
        provider: "fedapay",
        event: "confirmation_widget",
        statut: "ERREUR",
        reference,
        providerRef: fedapayRef,
        erreur: `montant mismatch : FedaPay ${verification.montant} ≠ don ${don.amount}`,
        corpsBrut: JSON.stringify({
          source: "confirmation",
          fedapayRef,
          montantFournisseur: verification.montant,
        }),
      });
      return NextResponse.json(
        {
          ok: false,
          statut: "pending",
          error:
            "Le montant payé ne correspond pas au don — le paiement n'a pas été confirmé. Contactez le ministère si vous avez été débité.",
        },
        { status: 400 }
      );
    }

    // ④ Machine à états partagée (transition atomique + trésorerie + reçu).
    const statutFinal =
      verification.statut === "approved"
        ? "approved"
        : verification.statut === "declined" ||
            verification.statut === "cancelled"
          ? "failed"
          : null;

    if (statutFinal === null) {
      // pending / inconnu : rien à décider — page merci + webhook.
      return NextResponse.json({ ok: true, statut: "pending" });
    }

    const resultat = await traiterEvenementDon({
      provider: "fedapay",
      evenement:
        statutFinal === "approved"
          ? "confirmation_widget.approved"
          : "confirmation_widget.declined",
      reference,
      providerRef: verification.id || fedapayRef,
      statutFinal,
      corpsBrut: JSON.stringify({
        source: "confirmation_widget",
        fedapayRef,
        statutFournisseur: verification.statut,
        montantFournisseur: verification.montant,
      }),
    });

    return NextResponse.json(
      {
        ok: resultat.code === "TRAITE" || resultat.code === "DEJA_TRAITE",
        statut: statutFinal,
        code: resultat.code,
      },
      {
        status:
          resultat.code === "TRAITE" || resultat.code === "DEJA_TRAITE"
            ? 200
            : resultat.http,
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dons/fedapay/confirmation] Erreur :", message);
    return NextResponse.json(
      { error: "Confirmation impossible — réessayez dans un instant." },
      { status: 500 }
    );
  }
}
