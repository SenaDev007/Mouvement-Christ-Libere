import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import { calculerSituationMulticaisse } from "@/lib/staff-space/multicaisse";
import {
  DEVISE_PAR_DEFAUT,
  convertirMontant,
  deviseAdmise,
} from "@/lib/staff-space/devises";

/**
 * ⭐ V3.66/V3.67 — GET /tresorerie/api/stats
 *
 * KPIs du tableau de bord trésorerie — TOUT EST CALCULÉ depuis le journal
 * (jamais stocké : aucune divergence possible) :
 *  · soldes par devise (recettes − dépenses, sur TOUTE la période) ;
 *  · ⭐ V3.67 — situation MULTICAISSE : solde réel par devise (ouvertures
 *    + journal), soldes par caisse, compartiment non affecté, cohérence ;
 *  · mois courant : total recettes / dépenses ;
 *  · 6 derniers mois : séries mensuelles (graphe) ;
 *  · répartition par catégorie (recettes / dépenses) ;
 *  · dernières transactions.
 *
 * ⭐ V3.88 — CONVERSION AUTOMATIQUE + DÉFAUT XOF :
 *  · le paramètre « devise » devient la devise D'AFFICHAGE (défaut XOF,
 *    plus EUR) ;
 *  · les KPIs, séries mensuelles, catégories et derniers mouvements
 *    regroupent TOUTES les devises puis convertissent vers la devise
 *    d'affichage (taux de référence : parité fixe €/F + $ de référence) —
 *    plus aucun « 0 € » quand le journal est tenu en francs CFA ;
 *  · le détail natif par devise accompagne chaque grand total
 *    (transparence : le montant d'origine reste toujours visible).
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

    // ⭐ V3.88 — devise d'AFFICHAGE (défaut XOF) : on agrège TOUTES les
    // devises puis on convertit, au lieu de filtrer une seule devise.
    const url = new URL(request.url);
    const paramDevise = url.searchParams.get("devise") || "";
    const devise = deviseAdmise(paramDevise)
      ? paramDevise
      : DEVISE_PAR_DEFAUT;

    const maintenant = new Date();
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const debut6Mois = new Date(maintenant.getFullYear(), maintenant.getMonth() - 5, 1);

    // Tous les mouvements réels (RECETTE/DEPENSE, toutes devises) + les
    // derniers mouvements pour l'affichage, + situation multicaisse.
    const [transactions, dernieres, situation] = await Promise.all([
      db.treasuryTransaction.findMany({
        where: { date: { gte: debut6Mois } },
        select: { type: true, amount: true, currency: true, category: true, date: true },
      }),
      db.treasuryTransaction.findMany({
        orderBy: { date: "desc" },
        take: 8,
      }),
      calculerSituationMulticaisse(),
    ]);

    // ⭐ V3.67 — les TRANSFERTS sont internes : ils n'entrent ni dans les
    // KPIs ni dans les séries ni dans les catégories.
    const mouvementsReels = transactions.filter(
      (t) => t.type === "RECETTE" || t.type === "DEPENSE"
    );

    // Total « toute la période » : agrégat groupé par type + devise sur
    // TOUT l'historique (les montants ne se mélangent qu'après conversion).
    const historique = await db.treasuryTransaction.groupBy({
      by: ["type", "currency"],
      _sum: { amount: true },
      _count: true,
    });

    // KPIs « toute la période » : chaque groupe est converti vers la devise
    // d'affichage AVANT addition (les séries 6 mois utilisent, elles, la
    // requête « transactions » ci-dessus — aucun double comptage).
    let totalRecettesConverti = 0;
    let totalDepensesConverti = 0;
    let nbMouvements = 0;
    const detailParDevise = new Map<string, { recettes: number; depenses: number }>();
    for (const ligne of historique) {
      if (ligne.type !== "RECETTE" && ligne.type !== "DEPENSE") continue;
      const montant = ligne._sum.amount || 0;
      if (montant === 0 && ligne._count === 0) continue;
      const converti = convertirMontant(montant, ligne.currency, devise);
      const entree =
        detailParDevise.get(ligne.currency) || { recettes: 0, depenses: 0 };
      if (ligne.type === "RECETTE") {
        totalRecettesConverti += converti;
        entree.recettes += montant;
      } else {
        totalDepensesConverti += converti;
        entree.depenses += montant;
      }
      detailParDevise.set(ligne.currency, entree);
      nbMouvements += ligne._count;
    }

    // ── Mois courant : recettes / dépenses converties vers l'affichage.
    let recettesMois = 0;
    let depensesMois = 0;
    for (const t of mouvementsReels) {
      if (t.date < debutMois) continue;
      if (t.type === "RECETTE")
        recettesMois += convertirMontant(t.amount, t.currency, devise);
      else if (t.type === "DEPENSE")
        depensesMois += convertirMontant(t.amount, t.currency, devise);
    }

    // ── Séries mensuelles (6 derniers mois) — converties ──
    const moisSerie: { mois: string; recettes: number; depenses: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 5 + i, 1);
      const fin = new Date(maintenant.getFullYear(), maintenant.getMonth() - 4 + i, 1);
      let recettes = 0;
      let depenses = 0;
      for (const t of mouvementsReels) {
        if (t.date < debut || t.date >= fin) continue;
        if (t.type === "RECETTE")
          recettes += convertirMontant(t.amount, t.currency, devise);
        else if (t.type === "DEPENSE")
          depenses += convertirMontant(t.amount, t.currency, devise);
      }
      moisSerie.push({
        mois: debut.toLocaleDateString("fr-FR", { month: "short" }),
        recettes,
        depenses,
      });
    }

    // ── Répartition par catégorie (toute la période) — convertie ──
    // L'historique groupé ci-dessus ne porte pas la catégorie : on
    // regroupe à nouveau par catégorie sur TOUTE la période via le
    // journal complet (catégories + devise), requête dédiée.
    const parCategorie = await db.treasuryTransaction.groupBy({
      by: ["category", "type", "currency"],
      _sum: { amount: true },
    });
    const categories = new Map<string, { recettes: number; depenses: number }>();
    for (const g of parCategorie) {
      if (g.type !== "RECETTE" && g.type !== "DEPENSE") continue;
      const entree = categories.get(g.category) || { recettes: 0, depenses: 0 };
      const converti = convertirMontant(g._sum.amount || 0, g.currency, devise);
      if (g.type === "RECETTE") entree.recettes += converti;
      else entree.depenses += converti;
      categories.set(g.category, entree);
    }

    // ⭐ V3.67 — solde réel : situation multicaisse (ouvertures incluses)
    // consolidée TOUTES devises, convertie vers la devise d'affichage.
    let soldeReelToutesDevises = 0;
    for (const c of situation.consolide) {
      soldeReelToutesDevises += convertirMontant(c.solde, c.devise, devise);
    }
    let soldeNonAffecteToutesDevises = 0;
    for (const c of situation.consolide) {
      soldeNonAffecteToutesDevises += convertirMontant(c.soldeNonAffecte, c.devise, devise);
    }

    return NextResponse.json({
      devise,
      total: {
        recettes: totalRecettesConverti,
        depenses: totalDepensesConverti,
        solde: totalRecettesConverti - totalDepensesConverti,
        nbMouvements,
      },
      // ⭐ V3.88 — détail natif par devise (transparence des conversions).
      detailParDevise: Array.from(detailParDevise.entries()).map(
        ([code, v]) => ({ devise: code, ...v })
      ),
      multicaisse: {
        nbCaisses: situation.caisses.filter((c) => c.isActive).length,
        soldeReel: soldeReelToutesDevises,
        soldeNonAffecte: soldeNonAffecteToutesDevises,
        coherent: situation.coherent,
        caisses: situation.caisses.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          isActive: c.isActive,
          devise: c.currency,
          solde: c.solde,
          soldeConverti: convertirMontant(c.solde, c.currency, devise),
        })),
      },
      moisCourant: {
        recettes: recettesMois,
        depenses: depensesMois,
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
