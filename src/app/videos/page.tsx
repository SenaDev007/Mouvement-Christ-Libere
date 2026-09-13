import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import { VideosView } from "@/components/videos/videos-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR /videos.
 *
 * Charge la config du hero (image d'arrière-plan, accroche, titre,
 * sous-titre — back-office /admin/heroes) et la transmet à la vue
 * cliente. force-dynamic : modifications visibles immédiatement.
 *
 * ⭐ V3.77 — charge également les PHOTOS DE PROFIL des serviteurs
 * (module /admin/servants → Servant.portraitUrl) : les onglets
 * Afrika / Kongo de la « barre de navigation » de la page vidéo, la
 * barre du lecteur et les avatars des cartes affichent désormais la
 * photo uploadée dans le back-office (repli : fichiers historiques).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vidéos & Lives | Christ Libère",
  description:
    "Enseignements vidéo et directs d'Afrika et du Pasteur Kongo, conservés intégralement.",
};

export default async function VideosPage() {
  const [hero, photos] = await Promise.all([getHero("videos"), photosServiteurs()]);
  return <VideosView hero={hero} photos={photos} />;
}
