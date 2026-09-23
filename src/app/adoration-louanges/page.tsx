import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import { AdorationView } from "@/components/adoration/adoration-view";

/**
 * ⭐ V3.79 — PAGE SERVEUR /adoration-louanges.
 *
 * Page dédiée à Afrika, ARTISTE et CHANTRE de l'Éternel : ses clips,
 * ses adorations et ses louanges vivent ICI (catégorie « Adoration »
 * d'un côté, « Louanges » de l'autre — scission demandée par le
 * pasteur), et ne mélangent plus la médiathèque /videos.
 *
 * Même architecture que /videos (pattern V3.45/V3.77) :
 *  - la page serveur charge la config du hero (back-office
 *    /admin/heroes → page « adoration-louanges ») et les photos de
 *    profil des serviteurs (module /admin/servants) ;
 *  - la vue cliente charge les médias via /api/videos et n'affiche
 *    que les catégories Adoration / Louanges d'Afrika ;
 *  - les vidéos se jouent DIRECTEMENT sur la plateforme (lecteur
 *    TikTok, YouTube ou natif) — aucune sortie du site.
 *
 * force-dynamic : les médias publiés par Afrika depuis le back-office
 * (/admin/adoration) apparaissent immédiatement.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Adoration & louanges en français | Christ Libère",
  description:
    "Chants d'adoration et de louange en français par Afrika Alkebulane, chantre de l'Éternel — écoutez-les directement sur la plateforme.",
  alternates: { canonical: "/adoration-louanges" },
};

export default async function AdorationPage() {
  const [hero, photos] = await Promise.all([getHero("adoration-louanges"), photosServiteurs()]);
  return <AdorationView hero={hero} photos={photos} />;
}
