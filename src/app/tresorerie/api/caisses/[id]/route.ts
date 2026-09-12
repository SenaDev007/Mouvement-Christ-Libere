import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import { CAISSE_TYPE_VALEURS } from "@/lib/staff-space/constants";

/**
 * ⭐ V3.67 — Trésorerie : MULTICAISSE.
 *
 *   PATCH  /tresorerie/api/caisses/[id] — correction d'une caisse
 *          { name?, type?, description?, openingBalance?, isActive? }
 *          ⚠️ La DEVISE ne change JAMAIS après création (les écritures de
 *          la caisse resteraient dans l'ancienne devise).
 *   DELETE /tresorerie/api/caisses/[id] — uniquement si AUCUNE écriture ne
 *          la référence (sinon : la désactiver). Toute action est
 *          journalisée dans l'AuditLog (gouvernance).
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
    const existante = await db.treasuryCashAccount.findUnique({ where: { id } });
    if (!existante) {
      return NextResponse.json({ error: "Caisse introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const { name, type, description, openingBalance, isActive } = body as {
      name?: string;
      type?: string;
      description?: string;
      openingBalance?: number;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = { updatedBy: userId };
    const changements: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Le nom de la caisse est requis" },
          { status: 400 }
        );
      }
      data.name = name.trim().substring(0, 80);
      changements.nom = { avant: existante.name, apres: data.name };
    }
    if (type !== undefined) {
      if (!(CAISSE_TYPE_VALEURS as readonly string[]).includes(type)) {
        return NextResponse.json({ error: "Type de caisse invalide" }, { status: 400 });
      }
      data.type = type;
      changements.type = { avant: existante.type, apres: type };
    }
    if (description !== undefined) {
      data.description = description?.trim()?.substring(0, 300) || null;
      changements.description = true;
    }
    if (openingBalance !== undefined) {
      if (
        typeof openingBalance !== "number" ||
        !Number.isFinite(openingBalance)
      ) {
        return NextResponse.json(
          { error: "Solde d'ouverture invalide" },
          { status: 400 }
        );
      }
      const arrondi = Math.round(openingBalance * 100) / 100;
      data.openingBalance = arrondi;
      changements.soldeOuverture = {
        avant: existante.openingBalance,
        apres: arrondi,
      };
    }
    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
      changements.active = { avant: existante.isActive, apres: data.isActive };
    }

    // La devise d'une caisse ne change jamais (écritures liées).
    if (body.currency !== undefined && body.currency !== existante.currency) {
      return NextResponse.json(
        {
          error:
            "La devise d'une caisse ne peut pas être modifiée — créez une nouvelle caisse.",
        },
        { status: 400 }
      );
    }

    const modifiee = await db.treasuryCashAccount.update({
      where: { id },
      data: data as never,
    });

    // Gouvernance : trace de correction (avant/après).
    try {
      await db.auditLog.create({
        data: {
          action: "TRESORERIE_CAISSE_UPDATE",
          userId,
          targetId: id,
          metadata: {
            caisse: modifiee.name,
            changements,
          } as never,
        },
      });
    } catch (e) {
      console.warn("[tresorerie/api/caisses] AuditLog impossible :", e);
    }

    return NextResponse.json({ item: modifiee });
  } catch (error) {
    console.error("[tresorerie/api/caisses/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la correction de la caisse" },
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
    const existante = await db.treasuryCashAccount.findUnique({ where: { id } });
    if (!existante) {
      return NextResponse.json({ error: "Caisse introuvable" }, { status: 404 });
    }

    // Une caisse référencée par des écritures ne s'efface pas : on la
    // désactive (le journal doit rester rattachable).
    const nbEcritures = await db.treasuryTransaction.count({
      where: {
        OR: [{ caisseId: id }, { caisseDestinationId: id }],
      },
    });
    if (nbEcritures > 0) {
      return NextResponse.json(
        {
          error: `Cette caisse porte ${nbEcritures} écriture(s) au journal — désactivez-la plutôt que de l'effacer (l'historique doit rester rattachable).`,
        },
        { status: 409 }
      );
    }

    // Journal d'audit AVANT suppression (la caisse disparaît, sa trace demeure).
    try {
      await db.auditLog.create({
        data: {
          action: "TRESORERIE_CAISSE_DELETE",
          userId,
          targetId: id,
          metadata: {
            caisse: existante.name,
            devise: existante.currency,
            soldeOuverture: existante.openingBalance,
          },
        },
      });
    } catch (e) {
      console.warn("[tresorerie/api/caisses] AuditLog impossible :", e);
    }

    await db.treasuryCashAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[tresorerie/api/caisses/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la caisse" },
      { status: 500 }
    );
  }
}
