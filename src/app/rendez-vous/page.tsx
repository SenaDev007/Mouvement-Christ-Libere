import { Suspense } from "react";
import type { Metadata } from "next";
import { photosServiteurs } from "@/lib/servant-photos";
import { RendezVousView } from "./rendez-vous-view";

/**
 * ⭐ V3.66 — Page publique « Demander un rendez-vous ».
 *
 * Entrée publique du secrétariat : la demande déposée ici arrive
 * DIRECTEMENT dans le registre du secrétariat (statut « Reçue ») — la
 * secrétaire l'examine puis la transmet au serviteur de Dieu concerné
 * (Sœur Afrika ou Pasteur Kongo).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demander un rendez-vous | Christ Libère",
  description:
    "Vous souhaitez rencontrer la sœur Afrika ou le pasteur Kongo ? Déposez votre demande auprès du secrétariat du Mouvement Christ Libère — elle sera transmise au serviteur de Dieu concerné.",
  alternates: { canonical: "/rendez-vous" },
};

export default async function RendezVousPage() {
  // ⭐ V3.77 — photos de profil du module serviteur (back-office).
  const photos = await photosServiteurs();
  return (
    <Suspense>
      <RendezVousView photos={photos} />
    </Suspense>
  );
}
