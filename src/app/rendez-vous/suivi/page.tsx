import { Suspense } from "react";
import type { Metadata } from "next";
import { SuiviDemandeView } from "./suivi-view";

/**
 * ⭐ V3.67 — Page publique « Suivre ma demande ».
 *
 * Le demandeur entre le code de suivi remis au dépôt (MCL-XXXXXX) et
 * consulte l'AVANCEMENT de sa demande : statut, serviteur, dates clés —
 * JAMAIS le contenu (message/contact restent au secrétariat).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suivre ma demande de rendez-vous | Christ Libère",
  description:
    "Consultez l'avancement de votre demande de rencontre avec un serviteur de Dieu du Mouvement Christ Libère à l'aide de votre code de suivi.",
};

export default function RendezVousSuiviPage() {
  return (
    <Suspense>
      <SuiviDemandeView />
    </Suspense>
  );
}
