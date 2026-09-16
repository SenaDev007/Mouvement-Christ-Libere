import { NextRequest } from "next/server";
import { handlerModifierAnnonce, handlerSupprimerAnnonce } from "@/lib/staff-space/annonces-api";

/**
 * ⭐ V3.89 — Back-office : mise à jour / suppression d'une annonce
 * (super admins). Même logique partagée que le secrétariat.
 *
 *   PATCH  /admin/api/annonces/[id]
 *          { title?, content?, category?, isPublished?, publishAt?, relayYeshua? }
 *   DELETE /admin/api/annonces/[id]
 *
 * ⚠️ Rôles : SUPER_ADMIN (garde JSON 401/403 — cf. proxy).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES_ADMIN_ANNONCES = ["SUPER_ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handlerModifierAnnonce(request, ROLES_ADMIN_ANNONCES, id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handlerSupprimerAnnonce(request, ROLES_ADMIN_ANNONCES, id);
}
