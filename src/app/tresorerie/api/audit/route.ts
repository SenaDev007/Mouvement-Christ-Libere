import { NextRequest, NextResponse } from "next/server";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import {
  lireJournalAudit,
  PREFIXES_AUDIT_TRESORERIE,
} from "@/lib/staff-space/audit";

/**
 * ⭐ V3.67 — GET /tresorerie/api/audit?limit=&offset=
 *
 * Journal d'audit de l'espace trésorerie (gouvernance) : créations/
 * corrections/suppressions d'écritures, transferts, caisses (création/
 * modification/suppression), reçus PDF émis, connexions.
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
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const { items, total } = await lireJournalAudit(
      PREFIXES_AUDIT_TRESORERIE,
      limit,
      offset
    );

    return NextResponse.json({ items, total });
  } catch (error) {
    console.error("[tresorerie/api/audit] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la lecture du journal d'audit" },
      { status: 500 }
    );
  }
}
