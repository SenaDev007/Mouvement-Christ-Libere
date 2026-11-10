import { NextRequest, NextResponse } from "next/server";
import { autoriserCron } from "@/lib/cron-auth";
import { recupererDonsPendantsFedapay } from "@/lib/payments/recuperation-dons";

/**
 * ⭐ V3.87 — GET /api/cron/recuperer-dons-fedapay
 * ⭐ V4.21 — DÉCLENCHEMENT MANUEL UNIQUEMENT (cron retiré de vercel.json).
 *
 * Filet de sécurité des dons FedaPay « pending » (paiement réel mais
 * jamais confirmé — POST de confirmation perdu, webhook non envoyé/non
 * déclaré : constat Academia-Helm « le webhook n'est pas toujours envoyé »).
 *
 * L'ancien cron horaire réveillait la base Neon 24×/jour pour re-vérifier
 * des dons en attente, même la nuit (facture 158 $/3 mois). La récupération
 * est désormais « PARESSEUSE », déclenchée par un VRAI humain :
 *   · le DONATEUR → page /contriburer/merci (re-vérification instantanée
 *     via /api/dons/statut/[reference], déjà en place) ;
 *   · la TRÉSORERIE → ouverture de /admin/dons (récupération arrière-plan
 *     via after(), throttle 5 min, cf. la page).
 * Personne ne visite → la base dort.
 *
 * CETTE ROUTE RESTE pour un balayage complet À LA DEMANDE :
 *   curl -H "X-Cron-Secret: $CRON_SECRET" https://www.mouvementchristlibere.com/api/cron/recuperer-dons-fedapay
 *
 * Pour chaque don FedaPay en attente des dernières 48 h :
 *   ① s'il a un providerRef → re-vérification directe auprès de FedaPay
 *      (GET /v1/transactions/{id}, clé secrète, montant exact exigé) ;
 *   ② sinon → rapprochement par description (la transaction FedaPay porte
 *      « <Type> — don_xxx »), puis vérification individuelle.
 * Dès qu'FedaPay dit « approved », la MÊME machine à états que les webhooks
 * finalise le don (écriture trésorerie unique + reçu email unique).
 *
 * Idempotent (transition atomique pending → final) : relancer ne duplique
 * rien. Budget 25 s < plafond serverless 30 s.
 *
 * Sécurité : Authorization Bearer (Vercel Cron) OU X-Cron-Secret (manuel).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!autoriserCron(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    // Budget 25 s : rendre la main avant le plafond serverless.
    const resultat = await recupererDonsPendantsFedapay({ budgetMs: 25_000 });
    console.log(
      `[cron/recuperer-dons-fedapay] traités=${resultat.traites} approuvés=${resultat.approuves}`
    );
    return NextResponse.json(resultat);
  } catch (error) {
    console.error("[cron/recuperer-dons-fedapay] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur pendant la récupération des dons FedaPay" },
      { status: 500 }
    );
  }
}
