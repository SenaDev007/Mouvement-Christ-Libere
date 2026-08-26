import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { ChannelCard, SecureBanner } from "@/components/premium/channel-card";
import { QuoteBlock } from "@/components/premium/section-divider";
import Link from "next/link";
import { ChevronRight, MessageSquare, ArrowRight } from "lucide-react";

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
    { role: "Super-admin", holder: "Pam / Pasteur Kongo", color: "bg-[#C9A227]" },
    { role: "Modérateur", holder: "Bénévoles validés", color: "bg-[#8C5FA8]" },
    { role: "Membre", holder: "Croyant inscrit", color: "bg-[#8A8378]" },
  ];

  return (
    <div className="min-h-screen">
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1511632765486-a0a80de485a5?q=80&w=1920&auto=format&fit=crop"
        kicker="Espaces d'échange"
        title="Communauté"
        subtitle="Des espaces d'échange organisés par thème, modérés avec attention, pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints chiffrés, intercession — à chacun son rythme."
        primaryCta={{ label: "Ouvrir Yeshua Connect", href: "/yeshua-connect" }}
      />

      {/* Rôles */}
      <section className="py-20 bg-[#FAF6EF] border-b border-[#8A8378]/10">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-6 text-center">
            Rôles dans la communauté
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {roles.map((r) => (
              <div key={r.role} className="flex items-center gap-3 p-4 rounded-2xl border border-[#8A8378]/20 bg-white">
                <span className={`w-3 h-3 rounded-full ${r.color}`} />
                <div>
                  <p className="text-sm font-semibold text-[#1E0F2B]">{r.role}</p>
                  <p className="text-xs text-[#8A8378]">{r.holder}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Canaux */}
      <section className="py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">Les canaux</p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E0F2B] leading-tight">
              Rejoignez l'espace qui vous correspond
            </h2>
            <p className="text-base text-[#8A8378] mt-4 max-w-2xl mx-auto">
              Que vous soyez nouveau dans la foi, pasteur affilié, ou membre régulier — il y a un canal pour vous.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {channels.map((c, i) => (
              <ChannelCard
                key={c.id}
                name={c.name}
                description={c.description || ""}
                type={c.type}
                members={c._count.members}
                isEncrypted={c.isEncrypted}
                href="/yeshua-connect"
                delay={i * 0.05}
              />
            ))}
          </div>

          {/* Bandeau confidentialité */}
          <div className="mt-12 max-w-3xl mx-auto">
            <SecureBanner
              title="Canaux restreints chiffrés"
              description="Les échanges des canaux restreints sont chiffrés de bout en bout : ni l'équipe technique ni les hébergeurs n'y ont accès. Seuls les participants du canal disposent des clés de déchiffrement."
            />
          </div>
        </div>
      </section>

      {/* CTA Yeshua Connect */}
      <section className="py-24 bg-[#2A0E3D] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-semibold mb-4">Yeshua Connect</p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#FAF6EF] leading-tight mb-6">
            Le chat en temps réel
          </h2>
          <p className="text-base md:text-lg text-[#FAF6EF]/60 leading-relaxed max-w-2xl mx-auto mb-10">
            Messagerie type WhatsApp, appels audio/vidéo, canaux d'annonces, partage de versets bibliques,
            intercession communautaire — tout est centralisé dans Yeshua Connect.
          </p>
          <Link
            href="/yeshua-connect"
            className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300"
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Ouvrir Yeshua Connect
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>

      {/* Citation */}
      <section className="py-20 bg-[#2A0E3D] border-t border-[#C9A227]/20">
        <div className="max-w-3xl mx-auto px-4">
          <QuoteBlock
            text="Voici, oh qu'il est agréable, qu'il est doux pour des frères de demeurer ensemble !"
            reference="Psaume 133:1"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
