import { Suspense } from "react";
import { LoginView } from "@/components/staff-space/login-view";

/**
 * ⭐ V3.66 — Connexion à l'espace Secrétariat
 * (secretariat.mouvementchristlibere.com/login → /secretariat/login).
 *
 * Rôles : SECRETARY (secrétaire accréditée) + SUPER_ADMIN (Pam, Pasteur
 * Kongo). La page s'affiche SEULE (pas de sidebar) — cf. proxy V3.44.1.
 */
export const dynamic = "force-dynamic";

export default function SecretariatLoginPage() {
  return (
    <Suspense>
      <LoginView
        titreEspace="Secrétariat"
        soustitre="Central du Mouvement Christ Libère — demandes de rencontre, annonces et registres du ministère."
        endpointLogin="/secretariat/api/login"
        prefixeEspace="/secretariat"
        libelleSousDomaine="secretariat"
        sousDomaine="secretariat.mouvementchristlibere.com"
      />
    </Suspense>
  );
}
