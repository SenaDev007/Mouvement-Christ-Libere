import type { Metadata } from "next";
import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import { AppHomeView } from "@/components/app/app-home-view";

/**
 * ⭐ V4.09 — PAGE PRINCIPALE DE L'APPLICATION MOBILE (/app).
 *
 * Charge la MÊME configuration que la landing du site public
 * (back-office /admin/heroes → « landing ») + les photos des
 * serviteurs (/admin/servants) : ce que le pasteur publie au
 * back-office s'affiche immédiatement ici, comme sur le site.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accueil",
  robots: { index: false, follow: false },
};

export default async function AppHomePage() {
  const [hero, photos] = await Promise.all([
    getHero("landing"),
    photosServiteurs(),
  ]);
  hero.data.pamPhoto = photos.afrika;
  hero.data.kongoPhoto = photos.kongo;
  return <AppHomeView hero={hero} />;
}
