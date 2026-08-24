import { db } from "@/lib/db";
import { PageHero } from "@/components/magic/page-hero";
import { ChannelCard, SecureBanner } from "@/components/premium/channel-card";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";

export const dynamic = "force-dynamic";

export default async function CommunautePage() {
  const channels = await db.channel.findMany({
    orderBy: [{ communityId: "asc" }, { order: "asc" }],
    include: {
      community: true,
      _count: { select: { members: true } },
    },
  });

  const roles = [
    { role: "Super-admin", holder: "PAM / Pasteur Kongo", color: "bg-gold" },
    { role: "Modérateur", holder: "Bénévoles validés", color: "bg-lavender" },
    { role: "Membre", holder: "Croyant inscrit", color: "bg-stone" },
  ];

  return (
    <div>
      <PageHero
        kicker="Espaces d'échange"
        title="Communauté"
        subtitle="Des espaces d'échange organisés par thème, modérés avec attention, pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints chiffrés, intercession — à chacun son rythme."
        primaryCta={{ label: "Rejoindre un canal", href: "#canaux" }}
        secondaryCta={{ label: "Lire la charte", href: "#" }}
      />

      {/* Rôles */}
      <section className="bg-ivory border-b border-stone/15 py-12">
        <div className="container mx-auto max-w-7xl px-4">
          <p className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-6 text-center">
            Rôles dans la communauté
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {roles.map((r) => (
              <div key={r.role} className="flex items-center gap-3 p-4 rounded-card border border-stone/20 bg-ivory">
                <span className={`w-3 h-3 rounded-full ${r.color}`} />
                <div>
                  <p className="text-sm font-semibold text-ink">{r.role}</p>
                  <p className="text-xs text-stone">{r.holder}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Canaux */}
      <section id="canaux" className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <PremiumSectionHeading
            kicker="Les canaux"
            title="Rejoignez l'espace qui vous correspond"
            subtitle="Que vous soyez nouveau dans la foi, pasteur affilié, ou membre régulier de la communauté — il y a un canal pour vous. Certains canaux sont chiffrés de bout en bout pour protéger les échanges sensibles."
            center
          />

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {channels.map((c, i) => (
              <ChannelCard
                key={c.id}
                name={c.name}
                description={c.description || ""}
                type={c.type}
                members={c._count.members}
                isEncrypted={c.isEncrypted}
                href="#"
                delay={i * 0.05}
              />
            ))}
          </div>

          {/* Bandeau confidentialité */}
          <div className="mt-16">
            <SecureBanner
              title="Confidentialité des échanges"
              description="Les échanges des canaux restreints sont chiffrés de bout en bout : ni l'équipe technique ni les hébergeurs n'y ont accès. Seuls les participants du canal disposent des clés de déchiffrement. Cette exigence n'est pas optionnelle — elle est de l'ordre de la protection des ministres et des croyants situés dans des contextes sensibles."
            />
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="bg-imperial py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Voici, oh ! qu'il est agréable, qu'il est doux pour des frères de demeurer ensemble."
            reference="Psaume 133:1"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
