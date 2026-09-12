import { StaffClient } from "./staff-client";

/**
 * ⭐ V3.66 — Accréditation des espaces Secrétariat & Trésorerie.
 *
 * Page réservée aux super admins (Pam, Pasteur Kongo) : création des
 * comptes secrétaire / trésorier, réinitialisation de mot de passe,
 * révocation et réactivation. C'est LE point de contrôle des deux
 * sous-domaines (secretariat. / tresorerie.mouvementchristlibere.com).
 */
export const dynamic = "force-dynamic";

export default function AdminStaffPage() {
  return <StaffClient />;
}
