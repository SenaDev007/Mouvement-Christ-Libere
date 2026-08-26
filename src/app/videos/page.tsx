import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { VideoCard } from "@/components/premium/video-card";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { LiveBanner, NextLiveCard } from "@/components/premium/live-banner";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { VideosFilters } from "@/components/premium/videos-filters";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ servant?: string }>;
}

export default async function VideosPage({ searchParams }: PageProps) {
  const { servant } = await searchParams;

  const where: Record<string, unknown> = {};
  if (servant && servant !== "all") {
    where.servant = { code: servant };
  }

  const [videos, servants, nextLive] = await Promise.all([
    db.video.findMany({
      where,
      orderBy: [{ isLive: "desc" }, { publishedAt: "desc" }],
      include: { servant: true },
    }),
    db.servant.findMany({ where: { isActive: true } }),
    db.liveStream.findFirst({
      where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      include: { servant: true },
    }),
  ]);

  const liveVideo = videos.find((v) => v.isLive);
  const regularVideos = videos.filter((v) => !v.isLive);

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1920&auto=format&fit=crop"
        kicker="Vidéos & Lives"
        title="Vidéos & Lives"
        subtitle="Retrouvez ici l'intégralité des enseignements vidéo et des directs, dans leur version originale et complète — même lorsque les plateformes externes suppriment."
        primaryCta={{ label: "Voir les enseignements", href: "/enseignements" }}
      />

      {/* Bandeau live si actif */}
      {liveVideo && (
        <LiveBanner
          title={liveVideo.title}
          href="#"
          isLive
        />
      )}

      {/* Filtres */}
      <VideosFilters
        servants={servants.map((s) => ({ code: s.code, name: s.shortName }))}
        currentServant={servant || "all"}
      />

      {/* Grille vidéos */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <PremiumSectionHeading
            kicker="Les dernières vidéos"
            title="Enseignements vidéo et lives enregistrés"
            subtitle="Chaque vidéo est conservée dans son intégralité, indépendamment des plateformes externes. La source de vérité reste ici."
          />

          {/* Mode étude toggle */}
          <div className="flex justify-end mt-6">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-imperial/30 text-imperial hover:bg-imperial/5 transition-colors"
              onClick={() => {
                // Toggle study mode (client-side — hides suggestions)
                const grid = document.querySelector('.videos-grid');
                if (grid) grid.classList.toggle('hidden');
              }}
            >
              Mode étude (masquer les suggestions)
            </button>
          </div>

          <div className="videos-grid grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-12">
            {regularVideos.map((v, i) => (
              <VideoCard
                key={v.id}
                title={v.title}
                description={v.description}
                duration={v.duration}
                views={v.views}
                date={v.publishedAt?.toISOString() || v.createdAt.toISOString()}
                href="#"
                servantPortrait={v.servant.code === "pam" ? "AP" : "PK"}
                servantName={v.servant.shortName}
                isLive={v.isLive}
                delay={i * 0.05}
              />
            ))}
          </div>

          {/* Bandeau permanent */}
          <div className="mt-16 p-6 bg-imperial/5 border border-gold/20 rounded-card">
            <p className="text-xs text-ink/70 leading-relaxed text-center">
              Ce direct est aussi diffusé sur YouTube, Facebook et TikTok.
              Cette page reste la version de référence, conservée dans son
              intégralité — même en cas de suppression par les plateformes externes.
            </p>
          </div>

          {/* Prochain live */}
          {nextLive && (
            <div className="mt-8 max-w-md mx-auto">
              <NextLiveCard
                title={nextLive.title}
                scheduledAt={nextLive.scheduledAt.toISOString()}
                servantName={nextLive.servant.shortName}
                href="#"
              />
            </div>
          )}
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="bg-imperial py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Ce qui est reçu du ciel doit être transmis avant que la nuit ne tombe."
            reference="Pam — Mouvement Christ Libère"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
