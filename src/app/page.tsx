import { getHero } from "@/lib/heroes";
import { LandingView } from "@/components/site/landing-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR / (landing).
 *
 * Charge la config du hero de la page d'accueil + les photos de Pam et
 * du Pasteur Kongo (back-office /admin/heroes) et la transmet à la vue
 * cliente. force-dynamic : modifications visibles immédiatement.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const hero = await getHero("landing");
  return <LandingView hero={hero} />;
}
