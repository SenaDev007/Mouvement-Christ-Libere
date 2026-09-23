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
  title: "Carte des dispersés — diaspora chrétienne | Christ Libère",
  description:
    "La carte du rassemblement des dispersés d'Israël : chrétiens d'Afrique et de la diaspora s'inscrivent au Mouvement Christ Libère. Inscrivez-vous sur la carte.",
  alternates: { canonical: "/disperses" },
};

export default async function DispersesPage() {
  const hero = await getHero("disperses");
  return <DispersesView hero={hero} />;
}
