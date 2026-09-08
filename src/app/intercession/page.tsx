import { getHero } from "@/lib/heroes";
import { IntercessionView } from "@/components/site/intercession-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR /intercession.
 *
 * Charge la config du hero (back-office /admin/heroes) et la transmet
 * à la vue cliente (formulaire confidentiel — logique inchangée).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chaîne d'intercession | Christ Libère",
  description:
    "Déposez vos demandes de prière — elles arrivent en toute confidentialité entre les mains de l'équipe pastorale.",
};

export default async function IntercessionPage() {
  const hero = await getHero("intercession");
  return <IntercessionView hero={hero} />;
}
