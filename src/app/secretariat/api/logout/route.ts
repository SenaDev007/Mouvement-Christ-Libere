import { handlerDeconnexionStaff } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — POST /secretariat/api/logout
 * Efface le cookie de session de l'hôte courant (secrétariat).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return handlerDeconnexionStaff();
}
