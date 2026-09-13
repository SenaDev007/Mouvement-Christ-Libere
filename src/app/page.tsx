import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import { LandingView } from "@/components/site/landing-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR / (landing).
 *
 * Charge la config du hero de la page d'accueil + les photos d'Afrika et
 * du Pasteur Kongo (back-office /admin/heroes) et la transmet à la vue
 * cliente. force-dynamic : modifications visibles immédiatement.
 *
 * ⭐ V3.77 — UNE SEULE photo de profil par serviteur « partout où il y a
 * profil » : photosServiteurs() (module /admin/servants en priorité,
 * puis photo « cadre doré » de la page du serviteur, repli statique)
 * écrase les photos des cartes serviteurs de la landing.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const [hero, photos] = await Promise.all([getHero("landing"), photosServiteurs()]);
  hero.data.pamPhoto = photos.afrika;
  hero.data.kongoPhoto = photos.kongo;
  return <LandingView hero={hero} />;
}
