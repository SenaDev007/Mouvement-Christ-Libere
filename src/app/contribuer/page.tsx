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
  title: "Faire un don en ligne | Mouvement Christ Libère",
  description:
    "Soutenez le Mouvement Christ Libère : dons sécurisés par carte bancaire ou Mobile Money (MTN, Moov). Votre offrande finance la mission.",
  alternates: { canonical: "/contribuer" },
};

export default async function ContribuerPage() {
  const hero = await getHero("contribuer");
  return <ContribuerView hero={hero} />;
}
