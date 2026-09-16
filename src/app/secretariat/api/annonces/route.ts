import { NextRequest } from "next/server";
import { ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import { handlerListerAnnonces, handlerCreerAnnonce } from "@/lib/staff-space/annonces-api";

/**
 * ⭐ V3.66/V3.67 — Secrétariat : annonces officielles du ministère.
 * ⭐ V3.89 — Logique DÉPLACÉE dans le module partagé
 * src/lib/staff-space/annonces-api.ts (le back-office des super admins
 * crée et gère les MÊMES annonces via /admin/api/annonces).
 *
 *   GET   /secretariat/api/annonces?categorie=&statut=&limit=&offset=
 *   POST  /secretariat/api/annonces
 *         { title, content, category, isPublished, publishAt?, relayYeshua }
 *
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handlerListerAnnonces(request, ROLES_SECRETARIAT);
}

export async function POST(request: NextRequest) {
  return handlerCreerAnnonce(request, ROLES_SECRETARIAT);
}
