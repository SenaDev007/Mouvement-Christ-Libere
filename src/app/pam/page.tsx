import { getHero } from "@/lib/heroes";
import { PamView } from "@/components/site/pam-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR /pam.
 *
 * Charge la config de la section hero + biographie (paramétrable dans
 * le back-office /admin/heroes) et la transmet à la vue cliente.
 * force-dynamic : les modifications du back-office sont visibles
 * immédiatement (pas de cache statique).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pam — Afrika Alkebulane Pamela Dali | Christ Libère",
  description:
    "Servante de Dieu marquée dès le sein maternel — biographie, témoignages et enseignements de Pam.",
};

export default async function PamPage() {
  const hero = await getHero("pam");
  return <PamView hero={hero} />;
}
