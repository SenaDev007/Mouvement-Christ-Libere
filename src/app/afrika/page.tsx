import { db } from "@/lib/db";
import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import { AfrikaView } from "@/components/site/afrika-view";
// ⭐ V3.47 — colonne Biography.photoUrl sélectionnée ci-dessous.
import { ensureBiographyPhotoColumn } from "@/lib/ensure-schema";

/**
 * ⭐ V3.45 — PAGE SERVEUR /afrika.
 *
 * Charge la config de la section hero + biographie (paramétrable dans
 * le back-office /admin/heroes) et la transmet à la vue cliente.
 * force-dynamic : les modifications du back-office sont visibles
 * immédiatement (pas de cache statique).
 *
 * ⭐ V3.47 — charge également la FRISE CHRONOLOGIQUE (jalons du module
 * « Biographies » du back-office, photos incluses) affichée sous la
 * biographie.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Afrika Alkebulane Pamela Dali | Christ Libère",
  description:
    "Servante de Dieu marquée dès le sein maternel — biographie, frise chronologique, témoignages et enseignements d'Afrika.",
};

export default async function AfrikaPage() {
  // ⭐ V3.77 — photo de profil unifiée (« partout où il y a profil ») :
  // photosServiteurs() — module /admin/servants en priorité, sinon la
  // photo « cadre doré » déjà configurée (idempotent ici), repli statique.
  const [hero, photos] = await Promise.all([getHero("afrika"), photosServiteurs()]);
  hero.data.bioPhoto = photos.afrika;

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
      where: { servant: { code: "afrika" } },
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
    console.warn("[afrika] Frise chronologique indisponible :", e instanceof Error ? e.message : e);
  }

  return <AfrikaView hero={hero} milestones={milestones} />;
}
