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
  title: "Demande de prière & intercession | Christ Libère",
  description:
    "Déposez votre demande de prière en toute confidentialité : l'équipe pastorale du Mouvement Christ Libère intercède pour vous. La prière des saints agit.",
  alternates: { canonical: "/intercession" },
};

export default async function IntercessionPage() {
  const hero = await getHero("intercession");
  return <IntercessionView hero={hero} />;
}
