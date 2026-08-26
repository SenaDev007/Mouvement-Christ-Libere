import { db } from "@/lib/db";
import { PageHero } from "@/components/magic/page-hero";
import { VerticalTimeline } from "@/components/premium/vertical-timeline";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { SectionDivider } from "@/components/premium/section-divider";
import { QuoteBlock } from "@/components/premium/section-divider";
import { CTAButton } from "@/components/section-primitives/section-heading";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ servant?: string }>;
}

export default async function BiographiePage({ searchParams }: PageProps) {
  const { servant: servantParam } = await searchParams;
  const servantCode = servantParam === "kongo" ? "kongo" : "pam";

  const servant = await db.servant.findUnique({
    where: { code: servantCode },
  });

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
    <div>
      <PageHero
        kicker="Les étapes d'un appel"
        title={`Biographie de ${servant.shortName}`}
        subtitle="Un parcours retracé étape par étape, tel qu'il a été vécu et transmis — sans survente, sans embellissement. Les faits rapportés portent leur propre poids."
        primaryCta={{ label: "Lire les témoignages", href: "/temoignages" }}
        secondaryCta={{
          label: isPam ? "Voir le Pasteur Kongo" : "Voir PAM",
          href: isPam ? "/biographie?servant=kongo" : "/biographie?servant=pam",
        }}
      />

      {/* Switcher serviteur */}
      <section className="bg-[#FAF6EF] border-b border-[#8A8378]/15 py-6 sticky top-[120px] z-30 backdrop-blur-md bg-[#FAF6EF]/95">
        <div className="container mx-auto max-w-7xl px-4 flex items-center justify-center gap-4">
          <span className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold">
            Choisir le serviteur :
          </span>
          <div className="flex items-center gap-2">
            <ServantSwitcherLink
              code="pam"
              label="PAM"
              active={isPam}
            />
            <ServantSwitcherLink
              code="kongo"
              label="Pasteur Kongo"
              active={!isPam}
            />
          </div>
        </div>
      </section>

      {/* Timeline premium */}
      <section className="bg-[#FAF6EF] py-20 md:py-28">
        <div className="container mx-auto max-w-5xl px-4">
          <PremiumSectionHeading
            kicker="La frise chronologique"
            title={isPam ? "Marcher avec Dieu, comme Hénoch" : "Un cœur tourné vers Dieu"}
            subtitle={isPam
              ? "Le parcours de PAM — de l'enfance en Alkebulan aux enlèvements au ciel, des premières intuitions aux instructions reçues pour le rassemblement des dispersés d'Israël."
              : "Le parcours du Pasteur Kongo — de l'appel précoce au ministère pastoral, en alliance avec le ministère prophétique de PAM."
            }
            center
          />

          <div className="mt-20">
            <VerticalTimeline items={timelineItems} variant="light" />
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation biblique */}
      <section className="bg-[#2A0E3D] py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text={isPam
              ? "C'est par la foi qu'Hénoch fut enlevé afin d'échapper à la mort, et il ne fut plus retrouvé, parce que Dieu l'avait enlevé."
              : "Paissez le troupeau de Dieu qui est sous votre garde, non par contrainte, mais volontairement, selon Dieu."
            }
            reference={isPam ? "Hébreux 11:5" : "1 Pierre 5:2"}
            variant="dark"
          />
        </div>
      </section>

      {/* CTA fin */}
      <section className="bg-[#FAF6EF] py-20 text-center">
        <div className="container mx-auto max-w-2xl px-4">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#1E0F2B] mb-4">
            Aller plus loin
          </h2>
          <p className="text-sm text-[#8A8378] mb-8 leading-relaxed">
            La biographie n'est que le commencement. Les témoignages détaillent ce qui a été vécu.
            Les enseignements transmettent ce qui a été reçu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <CTAButton href="/temoignages">
              Lire les témoignages
            </CTAButton>
            <CTAButton href="/enseignements" variant="secondary">
              Voir les enseignements
            </CTAButton>
          </div>
        </div>
      </section>
    </div>
  );
}

function ServantSwitcherLink({
  code,
  label,
  active,
}: {
  code: string;
  label: string;
  active: boolean;
}) {
  const cls = active
    ? "bg-[#2A0E3D] text-[#FAF6EF] border-[#2A0E3D]"
    : "border-[#2A0E3D]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5";
  return (
    <a
      href={`/biographie?servant=${code}`}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${cls}`}
    >
      {label}
    </a>
  );
}
