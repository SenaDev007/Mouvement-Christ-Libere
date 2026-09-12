import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { RendezVousView } from "./rendez-vous-view";

/**
 * ⭐ V3.66 — Page publique « Demander un rendez-vous ».
 *
 * Entrée publique du secrétariat : la demande déposée ici arrive
 * DIRECTEMENT dans le registre du secrétariat (statut « Reçue ») — la
 * secrétaire l'examine puis la transmet au serviteur de Dieu concerné
 * (Sœur Pam ou Pasteur Kongo).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demander un rendez-vous | Christ Libère",
  description:
    "Vous souhaitez rencontrer la sœur Pam ou le pasteur Kongo ? Déposez votre demande auprès du secrétariat du Mouvement Christ Libère — elle sera transmise au serviteur de Dieu concerné.",
};

export default function RendezVousPage() {
  return (
    <Suspense>
      <RendezVousView />
    </Suspense>
  );
}
