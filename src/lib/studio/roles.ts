/**
 * ⭐ V3.89 — Rôles d'accès au MCL Creative Studio.
 *
 * Directive du pasteur : « le back-office, le super admin ainsi que le
 * secrétariat vont partager ce même composant Studio Design » —
 *   · /admin/api/studio/*       → SUPER_ADMIN ;
 *   · /secretariat/api/studio/* → SECRETARY + SUPER_ADMIN.
 */

/** Back-office : super admins (Pasteur Kongo & Sœur Afrika). */
export const ROLES_ADMIN_STUDIO = ["SUPER_ADMIN"] as const;

/** Secrétariat : la secrétaire + les super admins (même garde que l'espace). */
export const ROLES_SECRETARIAT_STUDIO = ["SECRETARY", "SUPER_ADMIN"] as const;

/** Alias historique — le secrétariat partage la garde de son espace. */
export const ROLES_SECRETARIAT = ROLES_SECRETARIAT_STUDIO;
