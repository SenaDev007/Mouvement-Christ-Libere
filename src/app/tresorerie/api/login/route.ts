import { NextRequest, NextResponse } from "next/server";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { handlerConnexionStaff, ROLES_TRESORERIE } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — POST /tresorerie/api/login
 *
 * Connexion à l'espace Trésorerie. Rôles autorisés :
 *  - TREASURER (trésorier / comptable accrédité via /admin/staff)
 *  - SUPER_ADMIN (Pam, Pasteur Kongo — contrôle total sur la trésorerie)
 *
 * Même logique que /admin/api/login (cf. handlerConnexionStaff) ; le
 * cookie « admin_session » posé ici est HOST-SCOPED à
 * tresorerie.mouvementchristlibere.com.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await ensureStaffSpaces();
  return handlerConnexionStaff(request, ROLES_TRESORERIE);
}
