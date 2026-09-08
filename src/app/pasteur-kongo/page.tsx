import { db } from "@/lib/db";
import { getHero } from "@/lib/heroes";
import { PasteurKongoView } from "@/components/site/pasteur-kongo-view";
// ⭐ V3.47 — colonne Biography.photoUrl sélectionnée ci-dessous.
import { ensureBiographyPhotoColumn } from "@/lib/ensure-schema";

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
  title: "Pasteur Kongo | Christ Libère",
  description:
    "La Voix de la Réforme Prophétique de la 11e Heure — biographie, frise chronologique, enseignements et ministère du Pasteur Kongo.",
};

export default async function PasteurKongoPage() {
  const hero = await getHero("pasteur-kongo");

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

  return <PasteurKongoView hero={hero} milestones={milestones} />;
}
