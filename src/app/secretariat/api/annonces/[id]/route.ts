import { NextRequest } from "next/server";
import { ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import { handlerModifierAnnonce, handlerSupprimerAnnonce } from "@/lib/staff-space/annonces-api";

/**
 * ⭐ V3.66/V3.67 — Secrétariat : mise à jour / suppression d'une annonce.
 * ⭐ V3.89 — Logique déplacée dans annonces-api.ts (partagée back-office).
 *
 *   PATCH  /secretariat/api/annonces/[id]
 *   DELETE /secretariat/api/annonces/[id]
 *
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handlerModifierAnnonce(request, ROLES_SECRETARIAT, id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handlerSupprimerAnnonce(request, ROLES_SECRETARIAT, id);
}
