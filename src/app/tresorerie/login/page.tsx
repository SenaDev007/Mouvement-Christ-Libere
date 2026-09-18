import { Suspense } from "react";
import { LoginView } from "@/components/staff-space/login-view";

/**
 * ⭐ V3.66 — Connexion à l'espace Trésorerie
 * (tresorerie.mouvementchristlibere.com/login → /tresorerie/login).
 *
 * Rôles : TREASURER (trésorier accrédité) + SUPER_ADMIN (Afrika, Pasteur
 * Kongo). Journal financier du ministère — accès hautement restreint.
 *
 * ⭐ V3.93 — Spéc GTmetrix : page STATIQUE (force-dynamic retiré — aucun
 * accès base ici). TTFB de l'écran de connexion réduit (mesuré avant :
 * 675 ms sur l'URL publique, dépassant le seuil cible de 600 ms).
 */
export default function TresorerieLoginPage() {
  return (
    <Suspense>
      <LoginView
        titreEspace="Trésorerie"
        soustitre="Journal financier du Mouvement Christ Libère — recettes, dépenses et situation de caisse."
        endpointLogin="/tresorerie/api/login"
        prefixeEspace="/tresorerie"
        libelleSousDomaine="tresorerie"
        sousDomaine="tresorerie.mouvementchristlibere.com"
      />
    </Suspense>
  );
}
