import { db } from "@/lib/db";
import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import { VideosView } from "@/components/videos/videos-view";
import { JsonLd } from "@/components/site/json-ld";

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
  title: "Vidéos & lives chrétiens en français | Christ Libère",
  description:
    "Regardez les lives et replays du Mouvement Christ Libère : enseignements, prédications et témoignages d'Afrika et du Pasteur Kongo, en vidéo et en français.",
  alternates: { canonical: "/videos" },
};

/** Convertit « 1:02:34 » / « 12:40 » en durée ISO 8601 (PT1H2M34S)
 * attendue par schema.org/VideoObject (null si format inattendu). */
function dureeIso(duree: string | null): string | undefined {
  if (!duree) return undefined;
  const parties = duree.split(":").map((n) => parseInt(n, 10));
  if (parties.some((n) => Number.isNaN(n))) return undefined;
  const [h, m, s] = parties.length === 3 ? parties : [0, ...parties];
  let iso = "PT";
  if (h) iso += `${h}H`;
  if (m) iso += `${m}M`;
  if (s) iso += `${s}S`;
  return iso === "PT" ? undefined : iso;
}

export default async function VideosPage() {
  const [hero, photos] = await Promise.all([getHero("videos"), photosServiteurs()]);

  // ⭐ V3.93 — Spéc SEO : VideoObject (schema.org) pour les 12 dernières
  // vidéos publiées — rendu SERVEUR (découvrabilité vidéo pour Google,
  // miniatures et durées incluses). Best-effort : la page s'affiche même
  // si la base est indisponible.
  let videosJsonLd: object[] = [];
  try {
    const videos = await db.video.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        title: true,
        description: true,
        duration: true,
        thumbnailUrl: true,
        videoUrl: true,
        publishedAt: true,
        createdAt: true,
        views: true,
        servant: { select: { shortName: true } },
      },
    });
    videosJsonLd = videos.map((v) => ({
      "@type": "VideoObject",
      name: v.title,
      description: v.description.slice(0, 200),
      thumbnailUrl: v.thumbnailUrl || undefined,
      uploadDate: (v.publishedAt ?? v.createdAt).toISOString(),
      duration: dureeIso(v.duration),
      contentUrl: v.videoUrl || undefined,
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: { "@type": "WatchAction" },
        userInteractionCount: v.views,
      },
      author: { "@type": "Person", name: v.servant.shortName },
      publisher: { "@type": "Organization", name: "Mouvement Christ Libère" },
    }));
  } catch (e) {
    console.warn(
      "[videos] VideoObject JSON-LD indisponible :",
      e instanceof Error ? e.message : e
    );
  }

  return (
    <>
      {videosJsonLd.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Vidéos & Lives — Mouvement Christ Libère",
            itemListElement: videosJsonLd.map((v, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: v,
            })),
          }}
        />
      )}
      <VideosView hero={hero} photos={photos} />
    </>
  );
}
