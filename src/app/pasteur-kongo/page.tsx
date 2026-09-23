import { db } from "@/lib/db";
import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import { PasteurKongoView } from "@/components/site/pasteur-kongo-view";
// ⭐ V3.47 — colonne Biography.photoUrl sélectionnée ci-dessous.
import { ensureBiographyPhotoColumn } from "@/lib/ensure-schema";
import { JsonLd } from "@/components/site/json-ld";

/**
 * ⭐ V3.45 — PAGE SERVEUR /pasteur-kongo.
 *
 * Charge la config hero + biographie (back-office /admin/heroes) et la
 * transmet à la vue cliente. force-dynamic : modifications visibles
 * immédiatement.
 *
 * ⭐ V3.47 — charge également la FRISE CHRONOLOGIQUE (jalons du module
 * « Biographies » du back-office, photos incluses) affichée sous la
 * biographie.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pasteur Kongo — enseignements & prédications | Christ Libère",
  description:
    "Pasteur Kongo, Voix de la Réforme Prophétique de la 11e Heure : enseignements bibliques, prédications et lives en français. Découvrez son ministère.",
  alternates: { canonical: "/pasteur-kongo" },
};

export default async function PasteurKongoPage() {
  // ⭐ V3.77 — photo de profil unifiée (« partout où il y a profil ») :
  // photosServiteurs() — module /admin/servants en priorité, sinon la
  // photo « cadre doré » déjà configurée (idempotent ici), repli statique.
  const [hero, photos] = await Promise.all([
    getHero("pasteur-kongo"),
    photosServiteurs(),
  ]);
  hero.data.bioPhoto = photos.kongo;

  // ⭐ V3.47 — jalons biographiques (frise chronologique publique).
  // Garde idempotente : la colonne photoUrl se crée à la volée si absente.
  let milestones: {
    id: string;
    date: string;
    title: string;
    description: string;
    verseRef: string | null;
    verseText: string | null;
    photoUrl: string | null;
    order: number;
  }[] = [];
  try {
    await ensureBiographyPhotoColumn().catch(() => {});
    milestones = await db.biography.findMany({
      where: { servant: { code: "kongo" } },
      orderBy: [{ order: "asc" }, { date: "asc" }],
      select: {
        id: true,
        date: true,
        title: true,
        description: true,
        verseRef: true,
        verseText: true,
        photoUrl: true,
        order: true,
      },
    });
  } catch (e) {
    // La frise ne doit JAMAIS casser la page.
    console.warn("[pasteur-kongo] Frise chronologique indisponible :", e instanceof Error ? e.message : e);
  }

  return (
    <>
      {/* ⭐ V3.93 — Spéc SEO : entité Person (schema.org) — renforce
          la reconnaissance du « Pasteur Kongo » par Google. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Pasteur Kongo",
          url: "https://www.mouvementchristlibere.com/pasteur-kongo",
          image: "https://www.mouvementchristlibere.com/pasteur-kongo.jpeg",
          jobTitle: "Pasteur",
          description:
            "Voix de la Réforme Prophétique de la 11e Heure — enseignements, prophéties et marche avec le Saint-Esprit.",
          worksFor: {
            "@type": "Organization",
            name: "Mouvement Christ Libère",
          },
          knowsAbout: [
            "Yeshoua",
            "Réforme prophétique",
            "retour de Yeshoua",
            "Saint-Esprit",
          ],
        }}
      />
      <PasteurKongoView hero={hero} milestones={milestones} />
    </>
  );
}
