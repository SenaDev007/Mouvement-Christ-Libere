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
 * ⭐ V3.66/V3.67 — PATCH & DELETE /tresorerie/api/transactions/[id]
 *
 * PATCH — correction d'une écriture du journal (libellé, catégorie, montant,
 * méthode, référence, note, caisse de rattachement…). Le TYPE (recette/
 * dépense/transfert) et la DEVISE ne sont PAS modifiables : une correction
 * qui change la nature du mouvement exige de supprimer l'écriture et d'en
 * saisir la bonne (principe comptable : le journal conserve des écritures
 * cohérentes, l'AuditLog conserve la trace de la correction).
 *
 * DELETE — ⭐ V3.67 gouvernance : un MOTIF de suppression est désormais
 * OBLIGATOIRE (≥ 3 caractères). L'écriture disparaît du journal mais sa
 * trace complète (contenu + motif + auteure/auteur) demeure dans l'AuditLog.
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
    const { category, amount, method, label, reference, note, donorName, isAnonymous, date, caisseId } =
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
        caisseId?: string | null;
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

    // ⭐ V3.67 — Changement de caisse de rattachement (devise compatible).
    if (caisseId !== undefined) {
      if (caisseId === null || caisseId === "") {
        data.caisseId = null;
      } else {
        const caisse = await db.treasuryCashAccount.findUnique({
          where: { id: caisseId },
        });
        if (!caisse || !caisse.isActive) {
          return NextResponse.json(
            { error: "Caisse introuvable ou désactivée" },
            { status: 400 }
          );
        }
        if (existante.type === "TRANSFERT") {
          return NextResponse.json(
            { error: "La caisse source d'un transfert ne se corrige pas — supprimez le transfert et refaites-le." },
            { status: 400 }
          );
        }
        if (caisse.currency !== existante.currency) {
          return NextResponse.json(
            {
              error: `La caisse « ${caisse.name} » tient la devise ${caisse.currency} — incompatible avec cette écriture en ${existante.currency}.`,
            },
            { status: 400 }
          );
        }
        data.caisseId = caisse.id;
      }
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

    // ⭐ V3.67 — Gouvernance : motif de suppression OBLIGATOIRE.
    // L'écriture disparaît du journal, mais l'AuditLog conserve son
    // contenu complet + le motif déclaré + l'auteure ou l'auteur.
    let motif = "";
    try {
      const body = await request.json();
      motif = String((body as { motif?: string }).motif || "").trim();
    } catch {
      // corps absent ou non-JSON → motif vide → refus ci-dessous.
    }
    if (motif.length < 3) {
      return NextResponse.json(
        {
          error:
            "Un motif de suppression est obligatoire (au moins 3 caractères) — il est consigné dans le journal d'audit.",
        },
        { status: 400 }
      );
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
            caisseId: existante.caisseId,
            caisseDestinationId: existante.caisseDestinationId,
            motif,
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
