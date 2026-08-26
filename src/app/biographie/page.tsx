import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { VerticalTimeline } from "@/components/premium/vertical-timeline";
import { QuoteBlock } from "@/components/premium/section-divider";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ servant?: string }>;
}

export default async function BiographiePage({ searchParams }: PageProps) {
  const { servant: servantParam } = await searchParams;
  const servantCode = servantParam === "kongo" ? "kongo" : "pam";

  const servant = await db.servant.findUnique({ where: { code: servantCode } });
  if (!servant) notFound();

  const biographies = await db.biography.findMany({
    where: { servantId: servant.id },
    orderBy: { order: "asc" },
  });

  const timelineItems = biographies.map((b) => ({
    date: b.date,
    title: b.title,
    description: b.description,
    verseRef: b.verseRef || undefined,
    verseText: b.verseText || undefined,
  }));

  const isPam = servant.code === "pam";

  return (
    <div className="min-h-screen">
      {/* ═══ HERO ═══ */}
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1504052434549-ac899cf98a43?q=80&w=1920&auto=format&fit=crop"
        kicker="Les étapes d'un appel"
        title={`Biographie de ${servant.shortName}`}
        subtitle="Un parcours retracé étape par étape, tel qu'il a été vécu et transmis — sans survente, sans embellissement."
        primaryCta={{ label: "Lire les témoignages", href: "/temoignages" }}
        secondaryCta={{
          label: isPam ? "Voir le Pasteur Kongo" : "Voir Pam",
          href: isPam ? "/biographie?servant=kongo" : "/biographie?servant=pam",
        }}
      />

      {/* ═══ SWITCHER (non sticky, à sa place) ═══ */}
      <section className="py-8 bg-[#FAF6EF] border-b border-[#8A8378]/10">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4">
          <span className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold">Choisir le serviteur :</span>
          <div className="flex items-center gap-2">
            <a href="/biographie?servant=pam" className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border ${isPam ? "bg-[#2A0E3D] text-[#FAF6EF] border-[#2A0E3D]" : "border-[#8A8378]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"}`}>Pam</a>
            <a href="/biographie?servant=kongo" className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border ${!isPam ? "bg-[#2A0E3D] text-[#FAF6EF] border-[#2A0E3D]" : "border-[#8A8378]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"}`}>Pasteur Kongo</a>
          </div>
        </div>
      </section>

      {/* ═══ TIMELINE (centrée, pleine largeur) ═══ */}
      <section className="py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">La frise chronologique</p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E0F2B] leading-tight">
              {isPam ? "Marcher avec Dieu, comme Hénoch" : "Un cœur tourné vers Dieu"}
            </h2>
            <p className="text-base text-[#8A8378] mt-4 max-w-2xl mx-auto">
              {isPam
                ? "Le parcours de Pam — de l'enfance en Alkebulan aux enlèvements au ciel, des premières intuitions aux instructions reçues."
                : "Le parcours du Pasteur Kongo — de l'appel au ministère pastoral, en alliance avec le ministère prophétique de Pam."}
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <VerticalTimeline items={timelineItems} variant="light" />
          </div>
        </div>
      </section>

      {/* ═══ CITATION ═══ */}
      <section className="py-24 bg-[#2A0E3D] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4">
          <QuoteBlock
            text={isPam
              ? "C'est par la foi qu'Hénoch fut enlevé afin d'échapper à la mort, et il ne fut plus retrouvé, parce que Dieu l'avait enlevé."
              : "Paissez le troupeau de Dieu qui est sous votre garde, non par contrainte, mais volontairement, selon Dieu."}
            reference={isPam ? "Hébreux 11:5" : "1 Pierre 5:2"}
            variant="dark"
          />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">Aller plus loin</p>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1E0F2B] leading-tight mb-4">
            Découvrez les témoignages et enseignements
          </h2>
          <p className="text-base text-[#8A8378] mb-10 max-w-xl mx-auto">
            La biographie n'est que le commencement. Les témoignages détaillent ce qui a été vécu. Les enseignements transmettent ce qui a été reçu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/temoignages" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300">
              Lire les témoignages <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
            <Link href="/enseignements" className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-[#C9A227]/40 text-[#C9A227] font-sans font-bold text-base hover:bg-[#C9A227]/10 transition-all duration-300">
              Voir les enseignements <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
