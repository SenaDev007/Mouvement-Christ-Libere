import type { Metadata } from "next";
import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import { LandingView } from "@/components/site/landing-view";
import { JsonLd, ORGANISATION_MCL } from "@/components/site/json-ld";

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

// ⭐ V3.93 — Spéc SEO : URL canonique de la page d'accueil (une seule
// version indexée — l'apex redirige déjà en 308 vers www).
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [hero, photos] = await Promise.all([getHero("landing"), photosServiteurs()]);
  hero.data.pamPhoto = photos.afrika;
  hero.data.kongoPhoto = photos.kongo;
  return (
    <>
      {/* ⭐ V3.93 — Données structurées : Organization + WebSite
          (Google comprend l'entité « Mouvement Christ Libère » et le
          moteur de recherche interne du site). */}
      <JsonLd data={ORGANISATION_MCL} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Mouvement Christ Libère",
          url: "https://www.mouvementchristlibere.com",
          inLanguage: "fr",
          publisher: {
            "@type": "Organization",
            name: "Mouvement Christ Libère",
          },
        }}
      />
      <LandingView hero={hero} />
    </>
  );
}
