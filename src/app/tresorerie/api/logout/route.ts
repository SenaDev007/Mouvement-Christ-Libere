import { handlerDeconnexionStaff } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — POST /tresorerie/api/logout
 * Efface le cookie de session de l'hôte courant (trésorerie).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return handlerDeconnexionStaff();
}
