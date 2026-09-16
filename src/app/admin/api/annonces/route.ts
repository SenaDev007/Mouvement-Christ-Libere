import { NextRequest } from "next/server";
import { handlerListerAnnonces, handlerCreerAnnonce } from "@/lib/staff-space/annonces-api";

/**
 * ⭐ V3.89 — Back-office : annonces du ministère pour les SUPER ADMINS.
 *
 * Directive du pasteur : « même depuis le back-office, que les super
 * admins soient aussi capables de créer des annonces exactement comme le
 * secrétaire le fait depuis l'interface secrétariat ».
 *
 * MÊME table (MinistryAnnouncement), MÊME logique partagée que le
 * secrétariat (src/lib/staff-space/annonces-api.ts) — une annonce créée
 * ici apparaît immédiatement dans le registre du secrétariat et sur la
 * page publique /annonces (si publiée).
 *
 *   GET   /admin/api/annonces?categorie=&statut=&limit=&offset=
 *   POST  /admin/api/annonces
 *         { title, content, category, isPublished, publishAt?, relayYeshua }
 *
 * ⚠️ Rôles : SUPER_ADMIN uniquement (le back-office est l'espace des
 * pasteurs ; la secrétaire travaille depuis le sien). La garde
 * exigerSession répond 401/403 JSON (route déclarée dans
 * ADMIN_API_AVEC_GARDE_PROPRE du proxy).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rôles autorisés au back-office : les deux super admins. */
export const ROLES_ADMIN_ANNONCES = ["SUPER_ADMIN"] as const;

export async function GET(request: NextRequest) {
  return handlerListerAnnonces(request, ROLES_ADMIN_ANNONCES);
}

export async function POST(request: NextRequest) {
  return handlerCreerAnnonce(request, ROLES_ADMIN_ANNONCES);
}
