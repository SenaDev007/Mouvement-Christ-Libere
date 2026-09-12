import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — GET /tresorerie/api/caisse
 *
 * Situation de caisse calculée depuis le journal (jamais stockée) :
 *  · par DEVISE : total recettes, total dépenses, solde ;
 *  · par MÉTHODE (espèces, mobile money, virement…) pour chaque devise :
 *    encaissements et décaissements — la « caisse espèces » est la somme
 *    nette des mouvements especes.
 *
 * ⚠️ Rôles : TREASURER, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const transactions = await db.treasuryTransaction.findMany({
      select: {
        type: true,
        amount: true,
        currency: true,
        method: true,
        date: true,
      },
    });

    // Agrégat par devise.
    const parDevise = new Map<
      string,
      { recettes: number; depenses: number; solde: number; nbMouvements: number }
    >();
    // Agrégat par devise + méthode.
    const parMethode = new Map<
      string,
      { devise: string; methode: string; recettes: number; depenses: number; solde: number }
    >();

    for (const t of transactions) {
      // Devise.
      const devise =
        parDevise.get(t.currency) || {
          recettes: 0,
          depenses: 0,
          solde: 0,
          nbMouvements: 0,
        };
      if (t.type === "RECETTE") devise.recettes += t.amount;
      else devise.depenses += t.amount;
      devise.solde = devise.recettes - devise.depenses;
      devise.nbMouvements += 1;
      parDevise.set(t.currency, devise);

      // Devise + méthode.
      const cle = `${t.currency}:${t.method || "non_precise"}`;
      const ligne =
        parMethode.get(cle) || {
          devise: t.currency,
          methode: t.method || "non_precise",
          recettes: 0,
          depenses: 0,
          solde: 0,
        };
      if (t.type === "RECETTE") ligne.recettes += t.amount;
      else ligne.depenses += t.amount;
      ligne.solde = ligne.recettes - ligne.depenses;
      parMethode.set(cle, ligne);
    }

    return NextResponse.json({
      devises: Array.from(parDevise.entries()).map(([devise, v]) => ({
        devise,
        ...v,
      })),
      methodes: Array.from(parMethode.values()),
    });
  } catch (error) {
    console.error("[tresorerie/api/caisse] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul de la caisse" },
      { status: 500 }
    );
  }
}
