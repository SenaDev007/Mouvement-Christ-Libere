import { Suspense } from "react";
import type { Metadata } from "next";
import { RetraiteView } from "./retraite-view";

/**
 * ⭐ V4.43 — Page publique « Retraite spirituelle ».
 *
 * Le ministère accueille des retraites spirituelles sur un lieu aménagé
 * en Côte d'Ivoire. Toute personne désireuse de venir passer quelques
 * jours dépose D'ABORD sa demande ici : informations identitaires, durée
 * du séjour, photo de sa pièce d'identité et preuve du paiement des frais
 * de dossier (15 000 FCFA). La demande arrive DIRECTEMENT dans l'espace
 * de la secrétaire (/secretariat/retraites) qui l'examine et tranche —
 * aucun voyage ne doit être entrepris avant acceptation.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Retraite spirituelle | Christ Libère",
  description:
    "Venez vivre quelques jours de retraite spirituelle sur le lieu aménagé du Mouvement Christ Libère en Côte d'Ivoire. Déposez votre demande (identité, durée, pièce d'identité, preuve des frais de dossier) — la secrétaire l'examine puis vous recontacte.",
  alternates: { canonical: "/retraite-spirituelle" },
};

export default function RetraiteSpirituellePage() {
  return (
    <Suspense>
      <RetraiteView />
    </Suspense>
  );
}
