import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { TeachingCard } from "@/components/premium/teaching-card";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { TeachingsSearch } from "@/components/premium/teachings-search";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; level?: string; servant?: string }>;
}

export default async function EnseignementsPage({ searchParams }: PageProps) {
  const { q, level, servant } = await searchParams;

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { excerpt: { contains: q, mode: "insensitive" } },
      { theme: { contains: q, mode: "insensitive" } },
      { book: { contains: q, mode: "insensitive" } },
    ];
  }
  if (level && level !== "Tous") {
    where.level = level;
  }
  if (servant && servant !== "all") {
    where.servant = { code: servant };
  }

  const [teachings, servants] = await Promise.all([
    db.teaching.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { servant: true },
    }),
    db.servant.findMany({ where: { isActive: true } }),
  ]);

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1920&auto=format&fit=crop"
        kicker="Études bibliques"
        title="Enseignements"
        subtitle="Des études bibliques classées par thème, par livre et par niveau, pour approfondir à votre rythme. Transmis avec rigueur, confrontés à la Parole."
        primaryCta={{ label: "Voir les témoignages", href: "/temoignages" }}
      />

      {/* Recherche + filtres */}
      <TeachingsSearch
        servants={servants.map((s) => ({ code: s.code, name: s.shortName }))}
        currentQuery={q || ""}
        currentLevel={level || "Tous"}
        currentServant={servant || "all"}
      />

      {/* Liste */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          {teachings.length === 0 ? (
            <div className="text-center py-20 max-w-md mx-auto">
              <p className="text-stone italic leading-relaxed">
                Aucun enseignement ne correspond à cette recherche pour l'instant.
                Essayez un autre mot-clé, ou parcourez les enseignements par thème.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teachings.map((t, i) => (
                <TeachingCard
                  key={t.id}
                  title={t.title}
                  excerpt={t.excerpt}
                  theme={t.theme}
                  book={t.book}
                  level={t.level}
                  readingTime={t.readingTime || ""}
                  servantName={t.servant.shortName}
                  href="/enseignements"
                  delay={i * 0.05}
                />
              ))}
            </div>
          )}

          {/* Bandeau RSS / Email */}
          <div className="mt-16 p-6 bg-imperial/5 border border-gold/20 rounded-card">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink mb-1">
                  Pour ne rien manquer des nouveaux enseignements
                </p>
                <p className="text-xs text-stone">
                  Flux RSS, email à un proche, ou export PDF — plusieurs canaux pour préserver et diffuser.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-imperial/30 text-imperial hover:bg-imperial/5 transition-colors">
                  Flux RSS
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-imperial/30 text-imperial hover:bg-imperial/5 transition-colors">
                  Email à un proche
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="bg-imperial py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Toute Écriture est inspirée de Dieu, et utile pour enseigner, pour convaincre, pour corriger, pour instruire dans la justice."
            reference="2 Timothée 3:16"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
