import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import { CAISSE_TYPE_VALEURS, DEVISE_CODES } from "@/lib/staff-space/constants";
import {
  calculerSituationMulticaisse,
  slugifierCaisse,
} from "@/lib/staff-space/multicaisse";

/**
 * ⭐ V3.67 — Trésorerie : MULTICAISSE.
 *
 *   GET  /tresorerie/api/caisses — liste des caisses + situation complète
 *          (soldes recalculés, non affecté, consolidation par devise).
 *   POST /tresorerie/api/caisses — création d'une caisse
 *          { name, type?, currency, openingBalance?, description? }
 *
 * Gouvernance : chaque création/modification est journalisée dans AuditLog
 * (qui a créé/modifié quoi, avec le détail avant/après).
 * ⚠️ Rôles : TREASURER, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();
    const situation = await calculerSituationMulticaisse();
    return NextResponse.json(situation);
  } catch (error) {
    console.error("[tresorerie/api/caisses] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul de la situation multicaisse" },
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
    const { name, type, currency, openingBalance, description } = body as {
      name?: string;
      type?: string;
      currency?: string;
      openingBalance?: number;
      description?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Le nom de la caisse est requis" },
        { status: 400 }
      );
    }
    if (name.trim().length > 80) {
      return NextResponse.json(
        { error: "Le nom de la caisse est trop long (80 caractères maximum)" },
        { status: 400 }
      );
    }
    const typeFinal =
      type && (CAISSE_TYPE_VALEURS as readonly string[]).includes(type)
        ? type
        : "especes";
    const deviseFinale =
      currency && DEVISE_CODES.includes(currency) ? currency : "EUR";
    const ouverture =
      typeof openingBalance === "number" && Number.isFinite(openingBalance)
        ? Math.round(openingBalance * 100) / 100
        : 0;

    // Code unique : slug du nom + suffixe si collision.
    let code = slugifierCaisse(name.trim());
    for (let i = 0; i < 6; i++) {
      const existante = await db.treasuryCashAccount.findFirst({
        where: { code },
        select: { id: true },
      });
      if (!existante) break;
      code = `${slugifierCaisse(name.trim())}-${i + 2}`;
    }

    const caisse = await db.treasuryCashAccount.create({
      data: {
        code,
        name: name.trim(),
        type: typeFinal,
        currency: deviseFinale,
        openingBalance: ouverture,
        description: description?.trim()?.substring(0, 300) || null,
        createdBy: userId,
      },
    });

    // Gouvernance : trace de création (avec le solde d'ouverture).
    try {
      await db.auditLog.create({
        data: {
          action: "TRESORERIE_CAISSE_CREATE",
          userId,
          targetId: caisse.id,
          metadata: {
            nom: caisse.name,
            type: caisse.type,
            devise: caisse.currency,
            soldeOuverture: caisse.openingBalance,
          },
        },
      });
    } catch (e) {
      console.warn("[tresorerie/api/caisses] AuditLog impossible :", e);
    }

    return NextResponse.json({ item: caisse }, { status: 201 });
  } catch (error) {
    console.error("[tresorerie/api/caisses] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la caisse" },
      { status: 500 }
    );
  }
}
