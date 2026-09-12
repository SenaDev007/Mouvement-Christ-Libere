import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import {
  MOUVEMENT_TYPE_VALEURS,
  RECETTE_CATEGORIES_VALEURS,
  DEPENSE_CATEGORIES_VALEURS,
  MOUVEMENT_METHOD_VALEURS,
} from "@/lib/staff-space/constants";

/**
 * ⭐ V3.66 — PATCH /tresorerie/api/transactions/[id]
 *
 * Correction d'une écriture du journal (libellé, catégorie, montant,
 * méthode, référence, note…). Le TYPE (recette/dépense) et la DEVISE ne
 * sont PAS modifiables : une correction qui change la nature du mouvement
 * exige de supprimer l'écriture et d'en saisir la bonne (principe
 * comptable : le journal conserve des écritures cohérentes, l'AuditLog
 * conserve la trace de la correction).
 *
 * ⚠️ Rôles : TREASURER, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

    const { id } = await params;
    const existante = await db.treasuryTransaction.findUnique({ where: { id } });
    if (!existante) {
      return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const { category, amount, method, label, reference, note, donorName, isAnonymous, date } =
      body as {
        category?: string;
        amount?: number;
        method?: string;
        label?: string;
        reference?: string;
        note?: string;
        donorName?: string;
        isAnonymous?: boolean;
        date?: string;
      };

    const data: Record<string, unknown> = { updatedBy: userId };

    if (category !== undefined) {
      const categoriesAdmises =
        existante.type === "RECETTE"
          ? RECETTE_CATEGORIES_VALEURS
          : DEPENSE_CATEGORIES_VALEURS;
      if (!(categoriesAdmises as readonly string[]).includes(category)) {
        return NextResponse.json(
          { error: "Catégorie invalide pour ce type de mouvement" },
          { status: 400 }
        );
      }
      data.category = category;
    }
    if (amount !== undefined) {
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Le montant doit être un nombre strictement positif" },
          { status: 400 }
        );
      }
      data.amount = Math.round(amount * 100) / 100;
    }
    if (method !== undefined) {
      if (method && !(MOUVEMENT_METHOD_VALEURS as readonly string[]).includes(method)) {
        return NextResponse.json({ error: "Méthode invalide" }, { status: 400 });
      }
      data.method = method || null;
    }
    if (label !== undefined) {
      if (!label?.trim()) {
        return NextResponse.json({ error: "Le libellé est requis" }, { status: 400 });
      }
      data.label = label.trim().substring(0, 200);
    }
    if (reference !== undefined) data.reference = reference?.trim()?.substring(0, 80) || null;
    if (note !== undefined) data.note = note?.trim()?.substring(0, 3000) || null;
    if (donorName !== undefined)
      data.donorName = existante.type === "RECETTE" ? donorName?.trim()?.substring(0, 120) || null : null;
    if (isAnonymous !== undefined) data.isAnonymous = Boolean(isAnonymous);
    if (date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = new Date(`${date}T12:00:00`);
      if (!Number.isNaN(d.getTime())) data.date = d;
    }

    // Garde : type/devise inchangés (directive métier).
    if (body.type !== undefined && body.type !== existante.type) {
      return NextResponse.json(
        { error: "Le type d'un mouvement ne peut pas être modifié — supprimez l'écriture et saisissez la bonne." },
        { status: 400 }
      );
    }

    const modifie = await db.treasuryTransaction.update({
      where: { id },
      data: data as never,
    });

    try {
      await db.auditLog.create({
        data: {
          action: "TRESORERIE_UPDATE",
          userId,
          targetId: id,
          metadata: {
            libelle: modifie.label,
            ancienMontant: existante.amount,
            nouveauMontant: modifie.amount,
            devise: modifie.currency,
          },
        },
      });
    } catch (e) {
      console.warn("[tresorerie/api/transactions] AuditLog impossible :", e);
    }

    return NextResponse.json({ item: modifie });
  } catch (error) {
    console.error("[tresorerie/api/transactions/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la correction du mouvement" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

    const { id } = await params;
    const existante = await db.treasuryTransaction.findUnique({ where: { id } });
    if (!existante) {
      return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 });
    }

    // Journal d'audit AVANT suppression (l'écriture disparaît du journal,
    // sa trace de suppression demeure).
    try {
      await db.auditLog.create({
        data: {
          action: "TRESORERIE_DELETE",
          userId,
          targetId: id,
          metadata: {
            type: existante.type,
            category: existante.category,
            amount: existante.amount,
            devise: existante.currency,
            libelle: existante.label,
          },
        },
      });
    } catch (e) {
      console.warn("[tresorerie/api/transactions] AuditLog impossible :", e);
    }

    await db.treasuryTransaction.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[tresorerie/api/transactions/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du mouvement" },
      { status: 500 }
    );
  }
}
