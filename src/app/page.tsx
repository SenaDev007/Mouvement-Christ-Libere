import { db } from "@/lib/db";
import { HeroSection } from "@/components/premium/hero-section";
import { StatsGrid } from "@/components/premium/animated-stats";
import { ServantCard } from "@/components/premium/glass-card";
import { VideoCard } from "@/components/premium/video-card";
import { TestimonyCard } from "@/components/premium/testimony-card";
import { TeachingCard } from "@/components/premium/teaching-card";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { LiveBanner, NextLiveCard } from "@/components/premium/live-banner";
import Link from "next/link";
import { ChevronRight, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [servants, testimonies, teachings, videos, liveStreams] = await Promise.all([
    db.servant.findMany({ where: { isActive: true } }),
    db.testimony.findMany({
      where: { status: "CONFIRMED" },
      take: 3,
      orderBy: { publishedAt: "desc" },
      include: { servant: true },
    }),
    db.teaching.findMany({
      take: 1,
      orderBy: { publishedAt: "desc" },
      include: { servant: true },
    }),
    db.video.findMany({
      take: 4,
      orderBy: { publishedAt: "desc" },
      include: { servant: true },
    }),
    db.liveStream.findFirst({
      where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      include: { servant: true },
    }),
  ]);

  const pam = servants.find((s) => s.code === "pam");
  const kongo = servants.find((s) => s.code === "kongo");
  const liveVideo = videos.find((v) => v.isLive);
  const latestTeaching = teachings[0];

  const stats = [
    { value: "16", label: "jalons biographiques" },
    { value: "6", label: "témoignages authentiques" },
    { value: "6", label: "enseignements publiés" },
    { value: "24h", label: "délai de réponse" },
  ];

  return (
    <div>
      {/* HERO */}
      <HeroSection
        kicker="Un même appel, deux serviteurs"
        title={
          <>
            Afrika Alkebulane Pamela Dali
            <span className="block text-gold mt-2">& Pasteur Kongo</span>
          </>
        }
        subtitle="Témoignages, enseignements et vie de communauté, au service du rassemblement des fils d'Israël dispersés — en préparation au retour du Maître Yeshoua."
        primaryCta={{ label: "Découvrir le témoignage de PAM", href: "/temoignages" }}
        secondaryCta={{ label: "Le ministère du Pasteur Kongo", href: "/biographie" }}
        isLive={!!liveVideo}
      />

      {/* LIVE BANNER si actif */}
      {liveVideo && <LiveBanner title={liveVideo.title} href="/videos" isLive />}

      {/* STATS */}
      <StatsGrid stats={stats} title="Ce que cette plateforme rassemble aujourd'hui" />

      <SectionDivider variant="ornament" />

      {/* PRÉSENTATION DUALE */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <PremiumSectionHeading
            kicker="Deux ministères, une même vision"
            title="Deux voix, une même vision"
            subtitle="PAM et le Pasteur Kongo exercent chacun un ministère distinct, uni par le mariage et par une même conviction : préparer les cœurs, transmettre ce qui a été reçu, et rassembler ceux qui se reconnaissent dans cette parole."
            center
          />

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {pam && (
              <ServantCard
                portrait="AP"
                name={pam.shortName}
                fullName={pam.fullName}
                role={pam.role}
                bio={pam.bio}
                href="/biographie"
                ctaLabel="Lire la biographie de PAM"
                delay={0.1}
              />
            )}
            {kongo && (
              <ServantCard
                portrait="PK"
                name={kongo.shortName}
                fullName={kongo.fullName}
                role={kongo.role}
                bio={kongo.bio}
                href="/biographie"
                ctaLabel="Lire la biographie du Pasteur Kongo"
                delay={0.2}
              />
            )}
          </div>
        </div>
      </section>

      {/* DERNIER ENSEIGNEMENT + PROCHAIN LIVE */}
      <section className="bg-imperial py-20 md:py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-lavender/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative container mx-auto max-w-7xl px-4">
          <PremiumSectionHeading
            kicker="Le dernier enseignement"
            title="Pour approfondir la Parole"
            subtitle="Des études bibliques classées par thème, par livre et par niveau, pour approfondir à votre rythme."
            light
          />

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {latestTeaching && (
              <div className="md:col-span-2">
                <TeachingCard
                  title={latestTeaching.title}
                  excerpt={latestTeaching.excerpt}
                  theme={latestTeaching.theme}
                  book={latestTeaching.book}
                  level={latestTeaching.level}
                  readingTime={latestTeaching.readingTime || ""}
                  servantName={latestTeaching.servant.shortName}
                  href="/enseignements"
                  featured
                />
              </div>
            )}

            {liveStreams && (
              <NextLiveCard
                title={liveStreams.title}
                scheduledAt={liveStreams.scheduledAt.toISOString()}
                servantName={liveStreams.servant.shortName}
                href="/videos"
              />
            )}
          </div>

          {/* Bandeau permanent */}
          <div className="mt-10 p-4 border border-gold/15 rounded-card bg-imperial-dark/40">
            <p className="text-xs text-ivory/60 text-center leading-relaxed">
              Ce direct est aussi diffusé sur YouTube, Facebook et TikTok.
              Cette page reste la version de référence, conservée dans son
              intégralité — même en cas de suppression par les plateformes externes.
            </p>
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES À LA UNE */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <PremiumSectionHeading
            kicker="Témoignages"
            title="Des récits rapportés, offerts à la communauté"
            subtitle="Des récits d'expériences spirituelles authentiques, rapportés tels qu'ils ont été vécus et confiés à la communauté. Chaque témoignage est confronté à la Parole écrite."
            center
          />

          <div className="grid md:grid-cols-3 gap-6 mt-12">
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
                href={`/temoignages`}
                delay={i * 0.1}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/temoignages"
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-md border border-imperial/30 text-imperial font-semibold text-sm hover:bg-imperial/5 transition-all group"
            >
              Voir tous les témoignages
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* CITATION BIBLIQUE */}
      <section className="bg-imperial py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit."
            reference="Genèse 5:24"
            variant="dark"
          />
        </div>
      </section>

      {/* VIDÉOS RÉCENTES */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <PremiumSectionHeading
            kicker="Vidéos & Lives"
            title="Les derniers enseignements vidéo"
            subtitle="Retrouvez ici l'intégralité des enseignements vidéo et des directs, dans leur version originale et complète."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {videos.map((v, i) => (
              <VideoCard
                key={v.id}
                title={v.title}
                description={v.description}
                duration={v.duration}
                views={v.views}
                date={v.publishedAt?.toISOString() || v.createdAt.toISOString()}
                href="/videos"
                servantPortrait={v.servant.code === "pam" ? "AP" : "PK"}
                servantName={v.servant.shortName}
                isLive={v.isLive}
                delay={i * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* APPEL COMMUNAUTÉ */}
      <section className="bg-imperial py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative container mx-auto max-w-4xl px-4 text-center">
          <PremiumSectionHeading
            kicker="Communauté"
            title="Rejoignez les fils d'Israël dispersés"
            subtitle="Des espaces d'échange organisés par thème, modérés avec attention, pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints chiffrés, intercession — à chacun son rythme."
            light
            center
          />
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link
              href="/communaute"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-all hover:shadow-[0_0_30px_rgba(201,162,39,0.4)] group"
            >
              Rejoindre un canal
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contribuer"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md border border-gold/40 text-gold font-semibold text-sm hover:bg-gold/10 transition-all backdrop-blur-sm"
            >
              <BookOpen className="w-4 h-4" />
              Contribuer
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
