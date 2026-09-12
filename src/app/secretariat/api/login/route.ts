import { NextRequest, NextResponse } from "next/server";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { handlerConnexionStaff, ROLES_SECRETARIAT } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — POST /secretariat/api/login
 *
 * Connexion à l'espace Secrétariat. Rôles autorisés :
 *  - SECRETARY (compte créé par un super admin via /admin/staff)
 *  - SUPER_ADMIN (Pam, Pasteur Kongo — « ils ont le contrôle… ils ont accès »)
 *
 * Même logique que /admin/api/login (bcrypt, recherche nom OU email) :
 * cf. handlerConnexionStaff — le cookie « admin_session » posé ici est
 * HOST-SCOPED (secretariat.mouvementchristlibere.com), indépendant de la
 * session du back-office et de la trésorerie.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Valeurs d'enum + tables de l'espace — AVANT tout filtrage par rôle.
  await ensureStaffSpaces();
  // V3.67 gouvernance : trace de connexion dans le journal d'audit.
  return handlerConnexionStaff(request, ROLES_SECRETARIAT, "SECRETARIAT_LOGIN");
}
