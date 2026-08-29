import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { TestimonyCard } from "@/components/premium/testimony-card";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { TestimoniesFilters } from "@/components/premium/testimonies-filters";
import { AutoRefresh } from "@/components/site/auto-refresh";

export const revalidate = 30; // Cache 30s au lieu de force-dynamic (évite cold start DB)

interface PageProps {
  searchParams: Promise<{ theme?: string; servant?: string }>;
}

export default async function TemoignagesPage({ searchParams }: PageProps) {
  const { theme, servant } = await searchParams;

  const where: Record<string, unknown> = {};
  if (theme && theme !== "Tous") {
    where.themes = { has: theme };
  }
  if (servant && servant !== "all") {
    where.servant = { code: servant };
  }

  const [testimonies, servants] = await Promise.all([
    db.testimony.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { servant: true },
    }),
    db.servant.findMany({ where: { isActive: true } }),
  ]);

  const allThemes = await db.testimony.findMany({
    select: { themes: true },
  });
  const themes = Array.from(new Set(allThemes.flatMap((t) => t.themes))).sort();

  return (
    <div>
      <AutoRefresh intervalMs={30000} />
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop"
        kicker="Récits rapportés"
        title="Témoignages"
        subtitle="Des récits d'expériences spirituelles authentiques, rapportés tels qu'ils ont été vécus et confiés à la communauté. Chaque témoignage est confronté à la Parole écrite."
        primaryCta={{ label: "Voir les enseignements", href: "/enseignements" }}
      />

      {/* Filtres */}
      <TestimoniesFilters
        themes={themes}
        servants={servants.map((s) => ({ code: s.code, name: s.shortName }))}
        currentTheme={theme || "Tous"}
        currentServant={servant || "all"}
      />

      {/* Liste témoignages */}
      <section className="bg-[#FAF6EF] py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          {testimonies.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#8A8378] italic text-lg">
                Aucun témoignage ne correspond à cette recherche pour l'instant.
                Essayez un autre filtre, ou parcourez tous les témoignages.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonies.map((t, i) => (
                <TestimonyCard
                  key={t.id}
                  title={t.title}
                  short={t.short}
                  themes={t.themes}
                  bookRef={t.bookRef || undefined}
                  servantName={t.servant.shortName}
                  readingTime={t.readingTime || ""}
                  status={t.status}
                  href={`/temoignages/${t.id}`}
                  delay={i * 0.05}
                />
              ))}
            </div>
          )}

          {/* Bandeau de bas de liste */}
          <div className="mt-16 p-6 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-2xl text-center">
            <p className="text-sm text-[#1E0F2B] mb-3">
              Un témoignage vous a marqué ? Partagez-le à une personne de confiance.
            </p>
            <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C9A227] hover:text-[#A3821C] transition-colors">
              Partager discrètement
            </button>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="bg-[#2A0E3D] py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Nous n'ignorons pas ses designs."
            reference="2 Corinthiens 2:11"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
