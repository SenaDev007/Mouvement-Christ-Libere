import { getHero } from "@/lib/heroes";
import { ContribuerView } from "@/components/site/contribuer-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR /contribuer.
 *
 * Charge la config du hero (back-office /admin/heroes) et la transmet
 * à la vue cliente (formulaire de don inchangé).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contribuer | Christ Libère",
  description:
    "Vos dons soutiennent le fonctionnement de la plateforme et la diffusion des enseignements — usage publié chaque année.",
};

export default async function ContribuerPage() {
  const hero = await getHero("contribuer");
  return <ContribuerView hero={hero} />;
}
