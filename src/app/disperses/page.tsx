import { getHero } from "@/lib/heroes";
import { DispersesView } from "@/components/site/disperses-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR /disperses.
 *
 * Charge la config du hero (back-office /admin/heroes) et la transmet
 * à la vue cliente (carte des dispersés inchangée).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Carte des dispersés | Christ Libère",
  description:
    "La carte du rassemblement des dispersés — inscrivez-vous pour rejoindre la communauté.",
};

export default async function DispersesPage() {
  const hero = await getHero("disperses");
  return <DispersesView hero={hero} />;
}
