import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import {
  MOUVEMENT_TYPE_VALEURS,
  RECETTE_CATEGORIES_VALEURS,
  DEPENSE_CATEGORIES_VALEURS,
  MOUVEMENT_METHOD_VALEURS,
  DEVISE_CODES,
} from "@/lib/staff-space/constants";

/**
 * ⭐ V3.66 — Trésorerie : journal des recettes et dépenses.
 *
 *   GET   /tresorerie/api/transactions?type=&categorie=&devise=&du=&au=&q=&limit=&offset=
 *   POST  /tresorerie/api/transactions — création d'un mouvement
 *         { type, category, amount, currency, method?, label, date?,
 *           reference?, donorName?, isAnonymous?, note? }
 *
 * Chaque écriture est journalisée dans AuditLog (traçabilité financière :
 * qui a enregistré quoi, quand — la modification/suppression passe par
 * PATCH/DELETE /tresorerie/api/transactions/[id]).
 * ⚠️ Rôles : TREASURER, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    const categorie = url.searchParams.get("categorie") || "";
    const devise = url.searchParams.get("devise") || "";
    const du = url.searchParams.get("du") || "";
    const au = url.searchParams.get("au") || "";
    const recherche = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (type && MOUVEMENT_TYPE_VALEURS.includes(type)) where.type = type;
    if (categorie) where.category = categorie;
    if (devise) where.currency = devise;
    if (du && /^\d{4}-\d{2}-\d{2}$/.test(du) || au && /^\d{4}-\d{2}-\d{2}$/.test(au)) {
      const filtreDate: Record<string, Date> = {};
      if (du && /^\d{4}-\d{2}-\d{2}$/.test(du)) filtreDate.gte = new Date(`${du}T00:00:00`);
      if (au && /^\d{4}-\d{2}-\d{2}$/.test(au)) filtreDate.lte = new Date(`${au}T23:59:59`);
      where.date = filtreDate;
    }
    if (recherche) {
      where.OR = [
        { label: { contains: recherche, mode: "insensitive" } },
        { reference: { contains: recherche, mode: "insensitive" } },
        { donorName: { contains: recherche, mode: "insensitive" } },
        { note: { contains: recherche, mode: "insensitive" } },
      ];
    }

    const [items, total, sommeRecettes, sommeDepenses] = await Promise.all([
      db.treasuryTransaction.findMany({
        where,
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      db.treasuryTransaction.count({ where }),
      db.treasuryTransaction.aggregate({
        where: { ...where, type: "RECETTE" },
        _sum: { amount: true },
      }),
      db.treasuryTransaction.aggregate({
        where: { ...where, type: "DEPENSE" },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      items,
      total,
      totaux: {
        recettes: sommeRecettes._sum.amount || 0,
        depenses: sommeDepenses._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error("[tresorerie/api/transactions] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du journal" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

    const body = await request.json();
    const {
      type,
      category,
      amount,
      currency,
      method,
      label,
      date,
      reference,
      donorName,
      isAnonymous,
      note,
    } = body as {
      type?: string;
      category?: string;
      amount?: number;
      currency?: string;
      method?: string;
      label?: string;
      date?: string;
      reference?: string;
      donorName?: string;
      isAnonymous?: boolean;
      note?: string;
    };

    // Validations métier strictes : le journal doit être propre dès la saisie.
    if (!type || !(MOUVEMENT_TYPE_VALEURS as readonly string[]).includes(type)) {
      return NextResponse.json(
        { error: "Type invalide (RECETTE ou DEPENSE)" },
        { status: 400 }
      );
    }
    const categoriesAdmises =
      type === "RECETTE" ? RECETTE_CATEGORIES_VALEURS : DEPENSE_CATEGORIES_VALEURS;
    if (!category || !(categoriesAdmises as readonly string[]).includes(category)) {
      return NextResponse.json(
        { error: "Catégorie invalide pour ce type de mouvement" },
        { status: 400 }
      );
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Le montant doit être un nombre strictement positif" },
        { status: 400 }
      );
    }
    const deviseFinale = currency && DEVISE_CODES.includes(currency) ? currency : "EUR";
    if (method && !(MOUVEMENT_METHOD_VALEURS as readonly string[]).includes(method)) {
      return NextResponse.json({ error: "Méthode invalide" }, { status: 400 });
    }
    if (!label?.trim()) {
      return NextResponse.json({ error: "Le libellé est requis" }, { status: 400 });
    }

    let dateFinale = new Date();
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = new Date(`${date}T12:00:00`);
      if (!Number.isNaN(d.getTime())) dateFinale = d;
    }

    const mouvement = await db.treasuryTransaction.create({
      data: {
        type,
        category,
        amount: Math.round(amount * 100) / 100,
        currency: deviseFinale,
        method: method || null,
        label: label.trim().substring(0, 200),
        date: dateFinale,
        reference: reference?.trim()?.substring(0, 80) || null,
        donorName: type === "RECETTE" ? donorName?.trim()?.substring(0, 120) || null : null,
        isAnonymous: Boolean(isAnonymous),
        note: note?.trim()?.substring(0, 3000) || null,
        createdBy: userId,
      },
    });

    // Traçabilité financière.
    try {
      await db.auditLog.create({
        data: {
          action: "TRESORERIE_CREATE",
          userId,
          targetId: mouvement.id,
          metadata: {
            type,
            category,
            amount,
            currency: deviseFinale,
            label: mouvement.label,
          },
        },
      });
    } catch (e) {
      console.warn("[tresorerie/api/transactions] AuditLog impossible :", e);
    }

    return NextResponse.json({ item: mouvement }, { status: 201 });
  } catch (error) {
    console.error("[tresorerie/api/transactions] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du mouvement" },
      { status: 500 }
    );
  }
}
