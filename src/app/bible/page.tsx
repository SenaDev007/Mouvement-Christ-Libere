/**
 * ============================================================
 * PAGE /bible — Bible du Royaume
 * ============================================================
 *
 * ⭐ La logique complète vit désormais dans le composant réutilisable
 *    <BibleWorkspace /> (src/components/bible/BibleWorkspace.tsx)
 *    afin de pouvoir être EMBARQUÉE dans Yeshua Connect et dans la
 *    communauté (mode "embedded") sans quitter la conversation.
 *
 *    Cette page reste la version pleine page (navbar principale).
 *
 * ⭐ V3.45 — Section hero AJOUTÉE au-dessus de l'atelier (image
 *    d'arrière-plan, accroche, titre, sous-titre paramétrables depuis
 *    le back-office /admin/heroes → page « bible »).
 */

import { getHero } from "@/lib/heroes";
import { PageHero } from "@/components/site/page-hero";
import { BibleWorkspace } from "@/components/bible/BibleWorkspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bible du Royaume | Christ Libère",
  description:
    "6 versions de la Bible, concordance de Strong, hébreu originel et Peshitta — explorez les Écritures en profondeur.",
};

export default async function BiblePage() {
  // ⭐ V3.45 — Section hero paramétrable (back-office /admin/heroes)
  const hero = await getHero("bible");

  return (
    <div>
      <PageHero
        imageSrc={hero.backgroundImage}
        kicker={hero.kicker}
        title={hero.title}
        subtitle={hero.subtitle}
        primaryCta={hero.ctaLabel ? { label: hero.ctaLabel, href: hero.ctaHref } : undefined}
        secondaryCta={hero.cta2Label ? { label: hero.cta2Label, href: hero.cta2Href } : undefined}
      />
      <BibleWorkspace />
    </div>
  );
}
