import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDonsTables } from "@/lib/ensure-schema";
import {
  creerTransactionFedapay,
  fedapayConfigure,
  FEDAPAY_AIDE_CONFIG,
} from "@/lib/payments/fedapay.service";
import {
  initialiserTransactionPaystack,
  paystackConfigure,
  PAYSTACK_AIDE_CONFIG,
} from "@/lib/payments/paystack.service";
import {
  DemandeDon,
  DEVISE_DON,
  emailValide,
  genererReferenceDon,
  montantValide,
  PROVIDERS_VALEURS,
  TYPES_DON_VALEURS,
} from "@/lib/payments/payment-types";

/**
 * ⭐ V3.82 — POST /api/dons/initier
 *
 * Unique point de routage des passerelles (FedaPay et Paystack ne se
 * connaissent jamais) :
 *   ① valide la demande (type de don, montant XOF entier borné, email) ;
 *   ② crée la ligne « dons » EN BASE AVANT tout appel externe, avec la
 *      référence interne (don_xxx) — le don reste retrouvable même si le
 *      fournisseur ne répond jamais ;
 *   ③ appelle le bon service et renvoie { paymentUrl, reference } — le
 *      front redirige immédiatement vers la page de paiement hébergée.
 *
 * Sécurité : la confirmation d'un paiement ne vient JAMAIS d'ici — seul
 * le webhook signé fait passer le statut à approved (voir
 * /api/webhooks/fedapay et /api/webhooks/paystack).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Anti-abus (mémoire d'instance — bloque au moins les rafales d'un
// même visiteur sur une instance donnée ; les bornes de validation
// protègent le reste). ──
const FENETRE_ANTI_ABUS_MS = 10 * 60 * 1000;
const MAX_INITIATIONS_PAR_FENETRE = 12;
const ipInitiations = new Map<string, number[]>();

function ipCliente(request: NextRequest): string {
  const transpose = request.headers.get("x-forwarded-for");
  if (transpose) return transpose.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "inconnu";
}

function autoriseInitiation(ip: string): boolean {
  const maintenant = Date.now();
  const initiations = (ipInitiations.get(ip) || []).filter(
    (t) => maintenant - t < FENETRE_ANTI_ABUS_MS
  );
  if (initiations.length >= MAX_INITIATIONS_PAR_FENETRE) {
    ipInitiations.set(ip, initiations);
    return false;
  }
  initiations.push(maintenant);
  ipInitiations.set(ip, initiations);
  // Nettoyage périodique (croissance bornée).
  if (ipInitiations.size > 5_000) {
    for (const [cle, marques] of ipInitiations) {
      if (marques.every((t) => maintenant - t >= FENETRE_ANTI_ABUS_MS)) {
        ipInitiations.delete(cle);
      }
    }
  }
  return true;
}

export async function POST(request: NextRequest) {
  let corps: Partial<DemandeDon>;
  try {
    corps = (await request.json()) as Partial<DemandeDon>;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 }
    );
  }

  // ── Validation stricte de la demande ──
  const provider = corps.provider;
  if (!provider || !PROVIDERS_VALEURS.includes(provider)) {
    return NextResponse.json(
      { error: "Passerelle inconnue (fedapay ou paystack attendu)." },
      { status: 400 }
    );
  }
  const typeDon = corps.type_don;
  if (!typeDon || !TYPES_DON_VALEURS.includes(typeDon)) {
    return NextResponse.json(
      { error: "Type de don inconnu (offrande, dime ou don attendu)." },
      { status: 400 }
    );
  }
  const montant = corps.montant;
  if (typeof montant !== "number" || !montantValide(montant)) {
    return NextResponse.json(
      {
        error: `Le montant doit être un nombre entier entre 100 et 5 000 000 FCFA.`,
      },
      { status: 400 }
    );
  }
  const devise = corps.devise || DEVISE_DON;
  if (devise !== DEVISE_DON) {
    return NextResponse.json(
      { error: "Seule la devise XOF (FCFA) est acceptée pour l'instant." },
      { status: 400 }
    );
  }
  const email = (corps.email || "").trim().toLowerCase().slice(0, 160);
  if (!emailValide(email)) {
    return NextResponse.json(
      { error: "Une adresse email valide est requise (envoi du reçu)." },
      { status: 400 }
    );
  }
  const nom = (corps.nom || "").toString().trim().slice(0, 80) || null;
  const recurrent = corps.recurrent === true;

  if (!autoriseInitiation(ipCliente(request))) {
    return NextResponse.json(
      {
        error:
          "Trop de tentatives de paiement rapprochées — patientez quelques minutes.",
      },
      { status: 429 }
    );
  }

  // ── Passerelle configurée ? (message d'aide précis pour l'admin) ──
  // ⭐ V3.83 — La configuration se fait désormais depuis le back-office
  // (/admin/paiements) ; les variables d'environnement restent un repli.
  if (provider === "fedapay" && !(await fedapayConfigure())) {
    return NextResponse.json(
      {
        error:
          "Le paiement depuis l'Afrique de l'Ouest (FedaPay) n'est pas encore activé — configuration manquante.",
        detail: FEDAPAY_AIDE_CONFIG,
      },
      { status: 503 }
    );
  }
  if (provider === "paystack" && !(await paystackConfigure())) {
    return NextResponse.json(
      {
        error:
          "Le paiement depuis l'étranger (Paystack) n'est pas encore activé — configuration manquante.",
        detail: PAYSTACK_AIDE_CONFIG,
      },
      { status: 503 }
    );
  }

  try {
    await ensureDonsTables();

    const demande: DemandeDon = {
      provider,
      type_don: typeDon,
      montant,
      devise,
      email,
      nom,
      recurrent,
    };
    const reference = genererReferenceDon();
    let donCree = false;

    try {
      // ① Ligne « en attente » AVANT l'appel externe — source de vérité.
      await db.donation.create({
        data: {
          reference,
          provider,
          typeDon,
          amount: montant,
          currency: devise,
          method: provider,
          donorEmail: email,
          donorName: nom,
          isAnonymous: !nom,
          statut: "pending",
          recurrent,
        },
      });
      donCree = true;

      // ② Appel du fournisseur (le seul point de divergence).
      const transaction =
        provider === "fedapay"
          ? await creerTransactionFedapay(demande, reference)
          : await initialiserTransactionPaystack(demande, reference);

      // ③ Trace de l'id fournisseur (rapprochement du webhook).
      await db.donation.updateMany({
        where: { reference },
        data: { providerRef: transaction.providerRef },
      });

      return NextResponse.json(
        { paymentUrl: transaction.paymentUrl, reference },
        { status: 200 }
      );
    } catch (e) {
      // La transaction n'a pas pu être créée/terminée chez le fournisseur :
      // aucun paiement ne peut survenir — le don passe en échec (seulement
      // s'il est encore en attente : jamais de marche arrière sur un
      // webhook déjà reçu).
      if (donCree) {
        await db.donation
          .updateMany({
            where: { reference, statut: "pending" },
            data: { statut: "failed" },
          })
          .catch(() => undefined);
      }
      throw e;
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erreur inattendue du paiement.";
    console.error("[dons/initier] Échec :", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
