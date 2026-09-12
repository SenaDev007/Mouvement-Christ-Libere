import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import { calculerSituationMulticaisse } from "@/lib/staff-space/multicaisse";

/**
 * ⭐ V3.67 — GET /tresorerie/api/caisse
 *
 * Situation de caisse MULTICAISSE calculée depuis le journal (jamais
 * stockée) :
 *  · par CAISSE : solde d'ouverture, recettes, dépenses, transferts
 *    sortants/entrants, solde courant ;
 *  · compartiment « non affecté » (écritures antérieures à la multicaisse) ;
 *  · consolidation PAR DEVISE : somme des caisses + non affecté — avec
 *    contrôle de cohérence interne (Σ soldes = Σ ouvertures + recettes −
 *    dépenses) ;
 *  · détail par MÉTHODE d'encaissement (espèces, mobile money, virement…).
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

    const [situation, transactions] = await Promise.all([
      calculerSituationMulticaisse(),
      db.treasuryTransaction.findMany({
        where: { type: { in: ["RECETTE", "DEPENSE"] } },
        select: { type: true, amount: true, currency: true, method: true },
      }),
    ]);

    // Agrégat par devise + méthode (hors transferts : mouvements réels).
    const parMethode = new Map<
      string,
      { devise: string; methode: string; recettes: number; depenses: number; solde: number }
    >();
    for (const t of transactions) {
      const cle = `${t.currency}:${t.method || "non_precise"}`;
      const ligne =
        parMethode.get(cle) ||
        {
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
      ...situation,
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
