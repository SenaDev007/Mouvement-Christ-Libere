import { db } from "@/lib/db";
import { getHero } from "@/lib/heroes";
import { PamView } from "@/components/site/pam-view";
// ⭐ V3.47 — colonne Biography.photoUrl sélectionnée ci-dessous.
import { ensureBiographyPhotoColumn } from "@/lib/ensure-schema";

/**
 * ⭐ V3.45 — PAGE SERVEUR /pam.
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
  title: "Pam — Afrika Alkebulane Pamela Dali | Christ Libère",
  description:
    "Servante de Dieu marquée dès le sein maternel — biographie, frise chronologique, témoignages et enseignements de Pam.",
};

export default async function PamPage() {
  const hero = await getHero("pam");

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
      where: { servant: { code: "pam" } },
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
    console.warn("[pam] Frise chronologique indisponible :", e instanceof Error ? e.message : e);
  }

  return <PamView hero={hero} milestones={milestones} />;
}
