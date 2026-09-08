import { getHero } from "@/lib/heroes";
import { VideosView } from "@/components/videos/videos-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR /videos.
 *
 * Charge la config du hero (image d'arrière-plan, accroche, titre,
 * sous-titre — back-office /admin/heroes) et la transmet à la vue
 * cliente. force-dynamic : modifications visibles immédiatement.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vidéos & Lives | Christ Libère",
  description:
    "Enseignements vidéo et directs de Pam et du Pasteur Kongo, conservés intégralement.",
};

export default async function VideosPage() {
  const hero = await getHero("videos");
  return <VideosView hero={hero} />;
}
