import { Suspense } from "react";
import { LoginView } from "@/components/staff-space/login-view";

/**
 * ⭐ V3.66 — Connexion à l'espace Trésorerie
 * (tresorerie.mouvementchristlibere.com/login → /tresorerie/login).
 *
 * Rôles : TREASURER (trésorier accrédité) + SUPER_ADMIN (Pam, Pasteur
 * Kongo). Journal financier du ministère — accès hautement restreint.
 */
export const dynamic = "force-dynamic";

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
