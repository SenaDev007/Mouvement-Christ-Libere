import { getHero } from "@/lib/heroes";
import { PasteurKongoView } from "@/components/site/pasteur-kongo-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR /pasteur-kongo.
 *
 * Charge la config hero + biographie (back-office /admin/heroes) et la
 * transmet à la vue cliente. force-dynamic : modifications visibles
 * immédiatement.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pasteur Kongo | Christ Libère",
  description:
    "La Voix de la Réforme Prophétique de la 11e Heure — biographie, enseignements et ministère du Pasteur Kongo.",
};

export default async function PasteurKongoPage() {
  const hero = await getHero("pasteur-kongo");
  return <PasteurKongoView hero={hero} />;
}
