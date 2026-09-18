import { Suspense } from "react";
import { LoginView } from "@/components/staff-space/login-view";

/**
 * ⭐ V3.66 — Connexion à l'espace Secrétariat
 * (secretariat.mouvementchristlibere.com/login → /secretariat/login).
 *
 * Rôles : SECRETARY (secrétaire accréditée) + SUPER_ADMIN (Afrika, Pasteur
 * Kongo). La page s'affiche SEULE (pas de sidebar) — cf. proxy V3.44.1.
 *
 * ⭐ V3.93 — Spéc GTmetrix : page STATIQUE (force-dynamic retiré — aucun
 * accès base ici, LoginView est un pur client component). L'HTML est
 * désormais servi depuis le cache CDN : TTFB de l'écran de connexion
 * ~400-700 ms → ~50-100 ms. Aligné sur le comportement historique de
 * /admin/login (également statique).
 */
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
