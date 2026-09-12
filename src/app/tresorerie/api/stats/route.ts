import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — GET /tresorerie/api/stats
 *
 * KPIs du tableau de bord trésorerie — TOUT EST CALCULÉ depuis le journal
 * (jamais stocké : aucune divergence possible) :
 *  · soldes par devise (recettes − dépenses, sur TOUTE la période) ;
 *  · mois courant : total recettes / dépenses ;
 *  · 6 derniers mois : séries mensuelles (graphe) ;
 *  · répartition par catégorie (recettes / dépenses) ;
 *  · dernières transactions.
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

    // Le paramètre devise filtre les KPIs (multi-devises : EUR / XOF / USD).
    const url = new URL(request.url);
    const devise = url.searchParams.get("devise") || "EUR";

    const maintenant = new Date();
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const debut6Mois = new Date(maintenant.getFullYear(), maintenant.getMonth() - 5, 1);

    const [recettesTotal, depensesTotal, recettesMois, depensesMois, transactions, dernieres] =
      await Promise.all([
        db.treasuryTransaction.aggregate({
          where: { type: "RECETTE", currency: devise },
          _sum: { amount: true },
          _count: true,
        }),
        db.treasuryTransaction.aggregate({
          where: { type: "DEPENSE", currency: devise },
          _sum: { amount: true },
          _count: true,
        }),
        db.treasuryTransaction.aggregate({
          where: { type: "RECETTE", currency: devise, date: { gte: debutMois } },
          _sum: { amount: true },
        }),
        db.treasuryTransaction.aggregate({
          where: { type: "DEPENSE", currency: devise, date: { gte: debutMois } },
          _sum: { amount: true },
        }),
        db.treasuryTransaction.findMany({
          where: { currency: devise, date: { gte: debut6Mois } },
          select: { type: true, amount: true, category: true, date: true },
        }),
        db.treasuryTransaction.findMany({
          where: { currency: devise },
          orderBy: { date: "desc" },
          take: 8,
        }),
      ]);

    // ── Séries mensuelles (6 derniers mois) ──
    const moisSerie: { mois: string; recettes: number; depenses: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 5 + i, 1);
      const fin = new Date(maintenant.getFullYear(), maintenant.getMonth() - 4 + i, 1);
      const recettes = transactions
        .filter((t) => t.type === "RECETTE" && t.date >= debut && t.date < fin)
        .reduce((s, t) => s + t.amount, 0);
      const depenses = transactions
        .filter((t) => t.type === "DEPENSE" && t.date >= debut && t.date < fin)
        .reduce((s, t) => s + t.amount, 0);
      moisSerie.push({
        mois: debut.toLocaleDateString("fr-FR", { month: "short" }),
        recettes,
        depenses,
      });
    }

    // ── Répartition par catégorie (toute la période, devise courante) ──
    const categories = new Map<string, { recettes: number; depenses: number }>();
    for (const t of transactions) {
      const entree = categories.get(t.category) || { recettes: 0, depenses: 0 };
      if (t.type === "RECETTE") entree.recettes += t.amount;
      else entree.depenses += t.amount;
      categories.set(t.category, entree);
    }

    const totalRecettes = recettesTotal._sum.amount || 0;
    const totalDepenses = depensesTotal._sum.amount || 0;

    return NextResponse.json({
      devise,
      total: {
        recettes: totalRecettes,
        depenses: totalDepenses,
        solde: totalRecettes - totalDepenses,
        nbMouvements: recettesTotal._count + depensesTotal._count,
      },
      moisCourant: {
        recettes: recettesMois._sum.amount || 0,
        depenses: depensesMois._sum.amount || 0,
      },
      serie6Mois: moisSerie,
      categories: Array.from(categories.entries()).map(([categorie, v]) => ({
        categorie,
        ...v,
      })),
      dernieres,
    });
  } catch (error) {
    console.error("[tresorerie/api/stats] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des statistiques" },
      { status: 500 }
    );
  }
}
